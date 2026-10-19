import { ADDONS, hasPaidAddon, isAddonEligiblePlan, isAddonSaleEnabled, quoteAddonPurchase, type AddonId } from "@/lib/billing/addons";
import type { PlanId } from "@/lib/billing/plans";
import { getEffectiveEventPlan } from "@/lib/billing/purchase";
import { getServerNow } from "@/lib/invitation/server-time";
import { isPrintableEventType } from "@/lib/print/data";
import { printCopy } from "@/lib/print/copy";
import { routes } from "@/lib/routes";
import { getSiteUrl } from "@/lib/site-url";
import { getBillingProviderState } from "@/server/billing";
import type { BillingProvider, BillingProviderState, ProviderPayment } from "@/server/billing/provider";
import { StoreUnavailableError } from "@/server/db/errors";
import { logger } from "@/server/observability/logger";
import { createPendingAddonPurchase, findOwnedEventAddonPurchases, type AddonPurchaseRecord } from "@/server/repositories/addon-purchases";
import { findOwnedEventBilling, findProviderCustomerId, prismaBillingStore, saveProviderCustomer, type BillingStore, type EventBillingState } from "@/server/repositories/billing";
import { loadOwnedPublication, type OwnedPublication } from "@/server/repositories/publishing";
import { confirmAddonPayment } from "@/server/services/addon-sync";
import { CHECKOUT_SESSION_TTL_MS, checkoutIdempotencyKey } from "@/server/services/billing-service";
import type { AppUser } from "@/server/services/user-sync";

/**
 * COMPRA DEL COMPLEMENTO «Archivo listo para imprimir» (D-48). Compra OPCIONAL e INDEPENDIENTE del plan: vive en su propia tabla, nunca toca
 * el plan del evento ni la mejora Esencial → Premium, y usa el mismo proveedor, el mismo cliente, el mismo webhook firmado y la misma
 * idempotencia que los planes. El cliente solo envía el id del evento; todo lo demás (precio, importe, elegibilidad) lo decide el servidor.
 *
 * Barreras contra cobros duplicados, en orden: el botón no aparece si ya está comprado → el servicio lo rechaza (`already_purchased`) →
 * una sesión ABIERTA del mismo complemento se REUTILIZA (mismo enlace) y una ya COMPLETADA solo avisa «confirmando» → clave de
 * idempotencia estable (doble clic = la MISMA sesión de Stripe) → el webhook es idempotente → la base de datos impide dos desbloqueos
 * (`unlockKey` única).
 */
const ADDON: AddonId = "PRINT_FILE";
const EVENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PENDING_LOOKBACK_MS = 25 * 60 * 60 * 1000;
const PENDING_WINDOW_MS = 60 * 60 * 1000;

export interface AddonServiceDeps {
  getProviderState: () => BillingProviderState;
  saleEnabled: () => boolean;
  findOwnedEventBilling: (userId: string, eventId: string) => Promise<EventBillingState | null>;
  findOwnedAddonPurchases: (userId: string, eventId: string) => Promise<AddonPurchaseRecord[] | null>;
  loadPublication: (userId: string, eventId: string) => Promise<OwnedPublication | undefined>;
  findCustomer: (userId: string, provider: BillingProvider["id"]) => Promise<string | null>;
  saveCustomer: (userId: string, provider: BillingProvider["id"], providerCustomerId: string) => Promise<string>;
  createPending: typeof createPendingAddonPurchase;
  store: BillingStore;
  siteUrl: () => string;
  now: () => Date;
}

const defaultDeps: AddonServiceDeps = {
  getProviderState: getBillingProviderState,
  saleEnabled: () => isAddonSaleEnabled(ADDON, process.env),
  findOwnedEventBilling,
  findOwnedAddonPurchases: findOwnedEventAddonPurchases,
  loadPublication: loadOwnedPublication,
  findCustomer: findProviderCustomerId,
  saveCustomer: saveProviderCustomer,
  createPending: createPendingAddonPurchase,
  store: prismaBillingStore,
  siteUrl: () => getSiteUrl(),
  now: () => new Date(getServerNow()),
};

export type AddonCheckoutCode = "not_found" | "not_available" | "not_printable" | "ineligible_plan" | "already_purchased" | "payment_pending" | "invalid_config" | "unavailable" | "error";
export type AddonCheckoutResult = { ok: true; url: string } | { ok: false; code: AddonCheckoutCode; message: string };

const copy = printCopy.page.checkout;
const fail = (code: AddonCheckoutCode, message: string): { ok: false; code: AddonCheckoutCode; message: string } => ({ ok: false, code, message });

/** ¿Se puede vender el complemento en este entorno? Interruptor encendido + pagos configurados + precio del complemento configurado. */
function saleOpen(deps: AddonServiceDeps): { open: true; provider: BillingProvider } | { open: false } {
  if (!deps.saleEnabled()) return { open: false };
  const state = deps.getProviderState();
  if (state.status !== "ready" || !state.provider.priceRefFor(ADDONS[ADDON].stripePriceEnvKey)) return { open: false };
  return { open: true, provider: state.provider };
}

export async function startPrintAddonCheckout(user: Pick<AppUser, "id" | "email" | "name">, rawEventId: unknown, deps: AddonServiceDeps = defaultDeps): Promise<AddonCheckoutResult> {
  try {
    if (typeof rawEventId !== "string" || !EVENT_ID.test(rawEventId)) return fail("not_found", copy.notFound);
    const sale = saleOpen(deps);
    if (!sale.open) return fail("not_available", copy.notAvailable);
    const { provider } = sale;

    const billing = await deps.findOwnedEventBilling(user.id, rawEventId);
    const addons = billing ? await deps.findOwnedAddonPurchases(user.id, rawEventId) : null;
    if (!billing || !addons) return fail("not_found", copy.notFound);

    // Nunca se cobra algo que no se puede generar: hace falta la invitación publicada y un tipo de evento con diseño impreso.
    const publication = await deps.loadPublication(user.id, billing.eventId);
    if (!publication || publication.state !== "published" || !isPrintableEventType(publication.invitation.eventType)) return fail("not_printable", copy.notPrintable);

    const quote = quoteAddonPurchase(ADDON, getEffectiveEventPlan(billing.purchases), addons);
    if (!quote.ok) return quote.reason === "already_purchased" ? fail("already_purchased", copy.alreadyPurchased) : fail("ineligible_plan", copy.ineligiblePlan);

    // Sesiones pendientes del complemento (más reciente primero): abierta → se reutiliza; completada → «confirmando»; caducada → se cierra.
    const now = deps.now();
    const pending = addons
      .filter((purchase) => purchase.addon === ADDON && (purchase.status === "PENDING" || purchase.status === "FAILED") && purchase.provider === provider.id && now.getTime() - purchase.createdAt.getTime() < PENDING_LOOKBACK_MS)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const purchase of pending) {
      const existing = await provider.getCheckoutSession(purchase.checkoutSessionId);
      if (existing?.status === "complete") return fail("payment_pending", copy.paymentPending);
      if (existing?.status === "open" && existing.url) return { ok: true, url: existing.url };
      if (purchase.status === "PENDING") await deps.store.apply(async (ops) => ops.addons.setAddonStatus(purchase.id, "CANCELED"));
    }

    // El precio real de Stripe debe ser el aprobado (activo, pago único, 19 900 centavos MXN): si no, se falla ANTES de cobrar.
    if (!(await provider.verifyPrice(quote.priceEnvKey, { amountMinor: quote.amountMinor, currency: quote.currency }))) {
      logger.error("billing.price_mismatch", undefined, { priceKey: quote.priceEnvKey });
      return fail("invalid_config", copy.invalidConfig);
    }

    let customerId = await deps.findCustomer(user.id, provider.id);
    if (!customerId) {
      const created = await provider.createCustomer({ userId: user.id, email: user.email, name: user.name });
      customerId = await deps.saveCustomer(user.id, provider.id, created.providerCustomerId);
    }

    const printUrl = `${deps.siteUrl()}${routes.eventPrint(billing.eventId)}`;
    const session = await provider.createAddonCheckout({
      providerCustomerId: customerId,
      priceKey: quote.priceEnvKey,
      addon: ADDON,
      eventId: billing.eventId,
      userId: user.id,
      successUrl: `${printUrl}?payment=success`,
      cancelUrl: `${printUrl}?payment=canceled`,
      idempotencyKey: checkoutIdempotencyKey({ userId: user.id, eventId: billing.eventId, plan: `ADDON_${ADDON}`, kind: "ADDON", now, purchaseCount: addons.length }),
      expiresAt: new Date(now.getTime() + CHECKOUT_SESSION_TTL_MS),
    });
    await deps.createPending({ eventId: billing.eventId, userId: user.id, addon: ADDON, provider: provider.id, checkoutSessionId: session.checkoutSessionId, amount: quote.amountMinor, currency: quote.currency });
    return { ok: true, url: session.url };
  } catch (error) {
    if (error instanceof StoreUnavailableError) return fail("unavailable", copy.unavailable);
    logger.error("billing.addon_checkout_failed", error);
    return fail("error", copy.failed);
  }
}

/**
 * Regreso del pago (`?payment=success`): vuelve a leer del proveedor las compras PENDIENTES del complemento de ESTE evento del usuario y las
 * aplica con las MISMAS verificaciones que el webhook. No sustituye al webhook.
 */
export async function reconcilePrintAddon(user: Pick<AppUser, "id">, eventId: string, deps: AddonServiceDeps = defaultDeps): Promise<{ granted: number }> {
  const state = deps.getProviderState();
  if (state.status !== "ready") return { granted: 0 };
  const addons = await deps.findOwnedAddonPurchases(user.id, eventId);
  if (!addons) return { granted: 0 };
  const payments: ProviderPayment[] = [];
  for (const purchase of addons.filter((candidate) => candidate.status === "PENDING")) {
    const payment = await state.provider.getPayment(purchase.checkoutSessionId);
    if (payment) payments.push(payment);
  }
  let granted = 0;
  const now = deps.now();
  if (payments.length > 0)
    await deps.store.apply(async (ops) => {
      for (const payment of payments) if ((await confirmAddonPayment(ops, state.provider, payment, now)) === "granted") granted += 1;
    });
  return { granted };
}

/** Estado del complemento para la página «Versión para imprimir». */
export interface PrintAddonState {
  plan: PlanId;
  eligible: boolean;
  /** ¿Se puede comprar ahora en este entorno? (interruptor + Stripe + precio). */
  saleOpen: boolean;
  purchased: boolean;
  paidAt: Date | null;
  /** Hay un pago iniciado hace poco y aún sin confirmar. */
  pendingPayment: boolean;
  /** Hasta cuándo funciona el QR impreso (fin del acceso de pago del evento). */
  qrValidUntil: Date | null;
}

export async function getPrintAddonState(user: Pick<AppUser, "id">, eventId: string, deps: AddonServiceDeps = defaultDeps): Promise<PrintAddonState | undefined> {
  const billing = await deps.findOwnedEventBilling(user.id, eventId);
  const addons = (await deps.findOwnedAddonPurchases(user.id, eventId)) ?? [];
  const plan = getEffectiveEventPlan(billing?.purchases ?? []);
  const now = deps.now();
  const paid = addons.find((purchase) => purchase.addon === ADDON && purchase.status === "PAID");
  return {
    plan,
    eligible: isAddonEligiblePlan(ADDON, plan),
    saleOpen: saleOpen(deps).open,
    purchased: Boolean(paid),
    paidAt: paid?.paidAt ?? null,
    pendingPayment: addons.some((purchase) => purchase.addon === ADDON && purchase.status === "PENDING" && now.getTime() - purchase.createdAt.getTime() < PENDING_WINDOW_MS),
    qrValidUntil: billing?.paidAccessEndsAt ?? null,
  };
}

/** ¿Este evento DEL usuario tiene el complemento PAGADO? (Reembolsado = no.) Base de la descarga del PDF limpio. */
export async function hasPaidPrintAddon(userId: string, eventId: string, deps: Pick<AddonServiceDeps, "findOwnedAddonPurchases"> = defaultDeps): Promise<boolean> {
  return hasPaidAddon((await deps.findOwnedAddonPurchases(userId, eventId)) ?? [], ADDON);
}
