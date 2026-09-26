import Stripe from "stripe";
import type { PaidPlanId } from "@/lib/billing/plans";
import type { BillingProvider, NormalizedWebhookEvent, ProviderPayment } from "@/server/billing/provider";
import { WebhookSignatureError } from "@/server/billing/provider";
import type { StripeConfig } from "@/server/billing/stripe/config";

/**
 * ADAPTADOR DE STRIPE (D-32): el ÚNICO módulo (junto a su configuración) que importa el SDK de Stripe. Traduce las formas de Stripe a
 * las neutrales de `BillingProvider` y viceversa. Reglas:
 *  - PAGO ÚNICO: las sesiones se crean con `mode: "payment"` (nunca `subscription`): no hay renovaciones ni mensualidades.
 *  - Los precios se resuelven desde la configuración del servidor (variable → `price_…`); el cliente nunca aporta un precio.
 *  - Nunca se registran cuerpos de webhook ni datos de pago; Hilo Luna no recibe ni guarda datos de tarjeta (Stripe los gestiona en su
 *    página de pago).
 *  - `metadata` mínima (`hiloLunaUserId`, `eventId`, `targetPlan`) solo como pista: la autoridad es el precio, el importe y la moneda
 *    verificados por el servicio, no la metadata.
 */
const asId = (value: string | { id: string } | null | undefined): string | null => (typeof value === "string" ? value : (value?.id ?? null));

/** Sesión de cobro de Stripe → pago neutral. Necesita `line_items` expandido para conocer los precios cobrados. */
export function normalizeStripeSession(session: Stripe.Checkout.Session): ProviderPayment {
  const status: ProviderPayment["status"] = session.payment_status === "paid" ? "PAID" : session.status === "expired" ? "EXPIRED" : "PENDING";
  const metadata = session.metadata ?? {};
  return {
    checkoutSessionId: session.id,
    paymentIntentId: asId(session.payment_intent),
    providerCustomerId: asId(session.customer),
    status,
    amountMinor: typeof session.amount_total === "number" ? session.amount_total : -1,
    currency: (session.currency ?? "").toUpperCase(),
    priceRefs: (session.line_items?.data ?? []).map((item) => item.price?.id).filter((id): id is string => typeof id === "string"),
    metadata: {
      ...(metadata.hiloLunaUserId ? { userId: metadata.hiloLunaUserId } : {}),
      ...(metadata.eventId ? { eventId: metadata.eventId } : {}),
      ...(metadata.targetPlan ? { targetPlan: metadata.targetPlan } : {}),
    },
  };
}

/** Evento de Stripe (ya verificado) → evento neutral. Los tipos que no se usan —incluidos los de suscripción (`customer.subscription.*`, modelo anterior)— se ignoran. */
export function normalizeStripeEvent(event: Stripe.Event): NormalizedWebhookEvent {
  const base = { id: event.id, type: event.type, createdAt: new Date(event.created * 1000) };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      return session.mode === "payment" ? { ...base, action: "confirm_payment", checkoutSessionId: session.id } : { ...base, action: "ignore" };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment") return { ...base, action: "ignore" };
      return { ...base, action: "close_payment", outcome: event.type === "checkout.session.expired" ? "CANCELED" : "FAILED", checkoutSessionId: session.id };
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      return { ...base, action: "confirm_payment", paymentIntentId: intent.id };
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const metadata = intent.metadata ?? {};
      return {
        ...base,
        action: "close_payment",
        outcome: "FAILED",
        paymentIntentId: intent.id,
        metadata: { ...(metadata.eventId ? { eventId: metadata.eventId } : {}), ...(metadata.targetPlan ? { targetPlan: metadata.targetPlan } : {}) },
      };
    }
    case "charge.refunded": {
      // Solo un reembolso TOTAL retira el plan; uno parcial no cambia nada.
      const charge = event.data.object as Stripe.Charge;
      const intent = asId(charge.payment_intent);
      return charge.refunded === true && intent ? { ...base, action: "refund_payment", paymentIntentId: intent } : { ...base, action: "ignore" };
    }
    default:
      return { ...base, action: "ignore" };
  }
}

export class StripeBillingProvider implements BillingProvider {
  readonly id = "STRIPE" as const;
  private readonly keysByPrice = new Map<string, string>();

  constructor(
    private readonly stripe: Stripe,
    private readonly config: Pick<StripeConfig, "webhookSecret" | "prices">,
  ) {
    for (const [key, price] of config.prices) this.keysByPrice.set(price, key);
  }

  priceRefFor(priceKey: string): string | undefined {
    return this.config.prices.get(priceKey);
  }

  priceKeyFor(priceRef: string): string | undefined {
    return this.keysByPrice.get(priceRef);
  }

  /** Precios ya verificados (referencia → válido hasta). Solo se recuerdan los CORRECTOS y por poco tiempo: un precio editado en Stripe se detecta en minutos. */
  private readonly verifiedPrices = new Map<string, number>();
  private static readonly PRICE_CACHE_MS = 5 * 60 * 1000;

  async verifyPrice(priceKey: string, expected: { amountMinor: number; currency: string }) {
    const ref = this.priceRefFor(priceKey);
    if (!ref) return false;
    const cacheKey = `${ref}|${expected.amountMinor}|${expected.currency}`;
    if ((this.verifiedPrices.get(cacheKey) ?? 0) > Date.now()) return true;
    let price: Stripe.Price;
    try {
      price = await this.stripe.prices.retrieve(ref);
    } catch (error) {
      // Un precio inexistente (o de otro modo/cuenta) es un desajuste de configuración; cualquier otro fallo es transitorio y se propaga.
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return false;
      throw error;
    }
    const valid = price.active === true && price.type === "one_time" && price.unit_amount === expected.amountMinor && price.currency.toUpperCase() === expected.currency.toUpperCase();
    if (valid) this.verifiedPrices.set(cacheKey, Date.now() + StripeBillingProvider.PRICE_CACHE_MS);
    return valid;
  }

  async createCustomer(input: { userId: string; email: string; name: string | null }) {
    // La clave de idempotencia hace que dos peticiones simultáneas del mismo usuario obtengan el MISMO cliente.
    const customer = await this.stripe.customers.create(
      { email: input.email, ...(input.name ? { name: input.name } : {}), metadata: { hiloLunaUserId: input.userId } },
      { idempotencyKey: `hiloluna-customer-${input.userId}` },
    );
    return { providerCustomerId: customer.id };
  }

  async createEventCheckout(input: { providerCustomerId: string; priceKey: string; plan: PaidPlanId; eventId: string; userId: string; successUrl: string; cancelUrl: string; idempotencyKey: string; expiresAt: Date }) {
    const price = this.priceRefFor(input.priceKey);
    if (!price) throw new Error("Precio no configurado.");
    const metadata = { hiloLunaUserId: input.userId, eventId: input.eventId, targetPlan: input.plan };
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: input.providerCustomerId,
        line_items: [{ price, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.eventId,
        metadata,
        payment_intent_data: { metadata },
        locale: "es-419",
        // Stripe exige entre 30 minutos y 24 horas. Una sesión abandonada caduca sola (y su webhook `expired` cierra la compra pendiente).
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
      },
      // Misma clave = misma sesión: protege contra doble clic y peticiones simultáneas (ver `startEventCheckout`).
      { idempotencyKey: input.idempotencyKey },
    );
    if (!session.url) throw new Error("Stripe no devolvió la URL de pago.");
    return { url: session.url, checkoutSessionId: session.id };
  }

  async getCheckoutSession(checkoutSessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(checkoutSessionId);
      return { status: session.status === "complete" ? ("complete" as const) : session.status === "expired" ? ("expired" as const) : ("open" as const), url: session.url ?? null };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return undefined;
      throw error;
    }
  }

  async expireCheckoutSession(checkoutSessionId: string) {
    await this.stripe.checkout.sessions.expire(checkoutSessionId);
  }

  async getPayment(checkoutSessionId: string) {
    try {
      return normalizeStripeSession(await this.stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ["line_items"] }));
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return undefined;
      throw error;
    }
  }

  async findPaymentByIntent(paymentIntentId: string) {
    const list = await this.stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
    const session = list.data[0];
    return session ? this.getPayment(session.id) : undefined;
  }

  async createPortalSession(input: { providerCustomerId: string; returnUrl: string }) {
    const session = await this.stripe.billingPortal.sessions.create({ customer: input.providerCustomerId, return_url: input.returnUrl });
    return { url: session.url };
  }

  parseWebhook(rawBody: string, signature: string | null): NormalizedWebhookEvent {
    if (!signature) throw new WebhookSignatureError();
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
    } catch {
      throw new WebhookSignatureError();
    }
    return normalizeStripeEvent(event);
  }
}
