import { createHash } from "node:crypto";
import { billingCopy } from "@/lib/billing/copy";
import { getPlanConfig, isPaidPlanId, PAID_PLAN_IDS, type PaidPlanId, type PlanId } from "@/lib/billing/plans";
import { getEffectiveEventPlan, getEventAccessState, quoteEventPurchase, type EventAccessState, type PurchaseKindId, type PurchaseStatusId } from "@/lib/billing/purchase";
import { getServerNow } from "@/lib/invitation/server-time";
import { routes } from "@/lib/routes";
import { getSiteUrl } from "@/lib/site-url";
import { getBillingProviderState } from "@/server/billing";
import type { BillingProvider, BillingProviderState, ProviderPayment } from "@/server/billing/provider";
import { StoreUnavailableError } from "@/server/db/errors";
import {
  createPendingPurchase,
  findOwnedEventBilling,
  findProviderCustomerId,
  listOwnedEventsBilling,
  prismaBillingStore,
  saveProviderCustomer,
  type BillingStore,
  type EventBillingState,
  type OwnedEventBillingRow,
} from "@/server/repositories/billing";
import { confirmPayment } from "@/server/services/purchase-sync";
import type { AppUser } from "@/server/services/user-sync";
import { logger } from "@/server/observability/logger";

/**
 * CASOS DE USO DE FACTURACIÓN (D-32: pago único por evento): iniciar el pago de UN evento, ver sus opciones de mejora, el resumen de
 * «Compras y planes» y la reconciliación. Toda función recibe el USUARIO ya autenticado (`AppUser` de la sesión): el cliente solo
 * aporta un id de evento y un plan del enum, nunca precios, clientes, importes ni ids de usuario. El evento se resuelve SIEMPRE con
 * propiedad en la consulta. El proveedor se toca solo a través de `BillingProvider`.
 */
export interface BillingServiceDeps {
  getProviderState: () => BillingProviderState;
  /** Estado de facturación de un evento DEL usuario (propiedad en la consulta), o `null`. */
  findOwnedEventBilling: (userId: string, eventId: string) => Promise<EventBillingState | null>;
  listOwnedEventsBilling: (userId: string) => Promise<OwnedEventBillingRow[]>;
  findCustomer: (userId: string, provider: BillingProvider["id"]) => Promise<string | null>;
  saveCustomer: (userId: string, provider: BillingProvider["id"], providerCustomerId: string) => Promise<string>;
  createPending: typeof createPendingPurchase;
  store: BillingStore;
  siteUrl: () => string;
  now: () => Date;
}

const defaultDeps: BillingServiceDeps = {
  getProviderState: getBillingProviderState,
  findOwnedEventBilling,
  listOwnedEventsBilling,
  findCustomer: findProviderCustomerId,
  saveCustomer: saveProviderCustomer,
  createPending: createPendingPurchase,
  store: prismaBillingStore,
  siteUrl: () => getSiteUrl(),
  now: () => new Date(getServerNow()),
};

export type BillingActionCode = "invalid_plan" | "not_found" | "not_configured" | "invalid_config" | "already_at_plan" | "downgrade" | "no_customer" | "payment_pending" | "unavailable" | "error";
export type BillingActionResult = { ok: true; url: string } | { ok: false; code: BillingActionCode; message: string };

const fail = (code: BillingActionCode, message: string): { ok: false; code: BillingActionCode; message: string } => ({ ok: false, code, message });
const EVENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Vida de una sesión de cobro (Stripe exige ≥ 30 min) y ventana de la clave de idempotencia. */
export const CHECKOUT_SESSION_TTL_MS = 31 * 60 * 1000;
export const CHECKOUT_IDEMPOTENCY_BUCKET_MS = 30 * 60 * 1000;
/** Compras pendientes más antiguas que esto ya no pueden tener una sesión abierta (las sesiones caducan a lo sumo a las 24 h). */
const PENDING_LOOKBACK_MS = 25 * 60 * 60 * 1000;

/**
 * Clave de idempotencia ESTABLE por intento: usuario + evento + plan + tipo + ventana de 30 min + nº de compras del evento. Dos peticiones
 * simultáneas (doble clic) coinciden y reciben la MISMA sesión del proveedor; cuando cambia algo relevante (otra ventana, otra compra ya
 * registrada) la clave cambia y nunca se devuelve una sesión caducada. Hash: no lleva ids en claro al proveedor.
 */
export function checkoutIdempotencyKey(input: { userId: string; eventId: string; plan: string; kind: string; now: Date; purchaseCount: number }): string {
  const bucket = Math.floor(input.now.getTime() / CHECKOUT_IDEMPOTENCY_BUCKET_MS);
  return `hl-co-${createHash("sha256").update(`${input.userId}|${input.eventId}|${input.plan}|${input.kind}|${bucket}|${input.purchaseCount}`).digest("hex").slice(0, 40)}`;
}

/** Traduce cualquier fallo a un resultado seguro. Solo se registran etiquetas (nombre, tipo y código del proveedor), nunca su mensaje. */
function unexpected(error: unknown, fallbackMessage: string): { ok: false; code: BillingActionCode; message: string } {
  if (error instanceof StoreUnavailableError) return fail("unavailable", billingCopy.unavailable);
  const label = (key: "type" | "code") => (typeof error === "object" && error !== null && typeof (error as Record<string, unknown>)[key] === "string" ? String((error as Record<string, unknown>)[key]) : "");
  const detail = [label("type"), label("code")].filter(Boolean).join(" ");
  logger.error("billing.failure", error, { detail });
  return fail("error", fallbackMessage);
}

const notReady = (state: Exclude<BillingProviderState, { status: "ready" }>) => (state.status === "invalid" ? fail("invalid_config", billingCopy.invalidConfig) : fail("not_configured", billingCopy.notConfigured));

/**
 * 1. PAGO DE UN EVENTO. El cliente envía `eventId` y `plan` (ESSENTIAL | PREMIUM). El servidor: valida el plan → resuelve el evento
 * DEL usuario (uno ajeno = no encontrado) → calcula qué se compra (inicial o mejora Esencial → Premium, solo la diferencia) y rechaza
 * lo que no procede (mismo plan, plan inferior) → resuelve el precio desde la configuración del servidor → crea o reutiliza el
 * cliente del proveedor → crea la sesión de pago ÚNICO (`mode: payment`) y anota la compra `PENDING`. Devuelve la URL a la que
 * redirigir. El regreso (`?payment=success`) NO activa nada: solo el webhook verificado concede el plan.
 */
export async function startEventCheckout(user: Pick<AppUser, "id" | "email" | "name">, rawEventId: unknown, rawPlan: unknown, deps: BillingServiceDeps = defaultDeps): Promise<BillingActionResult> {
  try {
    if (!isPaidPlanId(rawPlan)) return fail("invalid_plan", billingCopy.planNotAvailable);
    if (typeof rawEventId !== "string" || !EVENT_ID.test(rawEventId)) return fail("not_found", billingCopy.eventNotFound);

    const state = deps.getProviderState();
    if (state.status !== "ready") return notReady(state);
    const { provider } = state;

    const billing = await deps.findOwnedEventBilling(user.id, rawEventId);
    if (!billing) return fail("not_found", billingCopy.eventNotFound);

    const quote = quoteEventPurchase(getEffectiveEventPlan(billing.purchases), rawPlan);
    if (!quote.ok) {
      if (quote.reason === "already_at_plan") return fail("already_at_plan", billingCopy.alreadyAtPlan);
      if (quote.reason === "downgrade") return fail("downgrade", billingCopy.downgrade);
      return fail("invalid_plan", billingCopy.planNotAvailable);
    }
    if (!provider.priceRefFor(quote.priceEnvKey)) return fail("invalid_plan", billingCopy.planNotAvailable);

    // ANTI DOBLE COBRO. Antes de abrir una sesión nueva se revisan las compras PENDIENTES del evento (más reciente primero):
    //  · misma compra con sesión ABIERTA → se REUTILIZA (mismo enlace de pago; no se crea otra),
    //  · sesión ya COMPLETADA (pago hecho, webhook en camino) → no se abre otra; se avisa que se está confirmando,
    //  · sesión abierta de OTRO plan → se caduca (best-effort) para que no puedan pagarse dos planes a la vez,
    //  · sesión caducada o inexistente → la compra pendiente se cierra (`CANCELED`) y se puede reintentar sin obstáculos.
    const now = deps.now();
    const pendingPurchases = billing.purchases
      // FAILED incluida: un intento fallido puede seguir dentro de una sesión aún abierta que todavía podría pagarse.
      .filter((purchase) => (purchase.status === "PENDING" || purchase.status === "FAILED") && purchase.provider === provider.id && now.getTime() - purchase.createdAt.getTime() < PENDING_LOOKBACK_MS)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const pending of pendingPurchases) {
      const existing = await provider.getCheckoutSession(pending.checkoutSessionId);
      if (existing?.status === "complete") return fail("payment_pending", billingCopy.paymentProcessing);
      if (existing?.status === "open" && existing.url) {
        if (pending.plan === quote.plan && pending.kind === quote.kind) return { ok: true, url: existing.url };
        await provider.expireCheckoutSession(pending.checkoutSessionId).catch(() => undefined);
      }
      if (pending.status === "PENDING") await deps.store.apply(async (ops) => ops.setPurchaseStatus(pending.id, "CANCELED"));
    }

    // El Price real del proveedor debe ser el que se pretende cobrar (activo, pago único, importe y moneda de `lib/billing/plans.ts`): si no, el
    // cliente pagaría y el webhook rechazaría el cobro. Falla de forma segura ANTES de abrir el pago.
    if (!(await provider.verifyPrice(quote.priceEnvKey, { amountMinor: quote.amountMinor, currency: quote.currency }))) {
      logger.error("billing.price_mismatch", undefined, { priceKey: quote.priceEnvKey });
      return fail("invalid_config", billingCopy.invalidConfig);
    }

    let customerId = await deps.findCustomer(user.id, provider.id);
    if (!customerId) {
      const created = await provider.createCustomer({ userId: user.id, email: user.email, name: user.name });
      customerId = await deps.saveCustomer(user.id, provider.id, created.providerCustomerId);
    }

    const base = deps.siteUrl();
    const eventUrl = `${base}${routes.event(billing.eventId)}`;
    const session = await provider.createEventCheckout({
      providerCustomerId: customerId,
      priceKey: quote.priceEnvKey,
      plan: quote.plan,
      eventId: billing.eventId,
      userId: user.id,
      successUrl: `${eventUrl}?payment=success`,
      cancelUrl: `${eventUrl}?payment=canceled`,
      idempotencyKey: checkoutIdempotencyKey({ userId: user.id, eventId: billing.eventId, plan: quote.plan, kind: quote.kind, now, purchaseCount: billing.purchases.length }),
      expiresAt: new Date(now.getTime() + CHECKOUT_SESSION_TTL_MS),
    });
    await deps.createPending({ eventId: billing.eventId, userId: user.id, provider: provider.id, checkoutSessionId: session.checkoutSessionId, plan: quote.plan, kind: quote.kind, amount: quote.amountMinor, currency: quote.currency });
    return { ok: true, url: session.url };
  } catch (error) {
    return unexpected(error, billingCopy.checkoutFailed);
  }
}

/** 2. PORTAL del cliente (recibos y datos de pago). Solo el cliente guardado PARA ESTE USUARIO. No gestiona el plan de ningún evento y hoy ninguna pantalla lo ofrece. */
export async function createBillingPortal(user: Pick<AppUser, "id">, deps: BillingServiceDeps = defaultDeps): Promise<BillingActionResult> {
  try {
    const state = deps.getProviderState();
    if (state.status !== "ready") return notReady(state);
    const customerId = await deps.findCustomer(user.id, state.provider.id);
    if (!customerId) return fail("no_customer", billingCopy.noCustomer);
    const session = await state.provider.createPortalSession({ providerCustomerId: customerId, returnUrl: `${deps.siteUrl()}${routes.billing}` });
    return { ok: true, url: session.url };
  } catch (error) {
    return unexpected(error, billingCopy.checkoutFailed);
  }
}

// ───────── Vistas para la interfaz ─────────

export interface EventPlanOption {
  plan: PaidPlanId;
  /** `available` = se puede comprar; `current` = es el plan del evento; `included` = el evento ya tiene uno superior. */
  state: "available" | "current" | "included";
  /** `INITIAL` (precio completo) o `UPGRADE` (solo la diferencia). `null` si no se puede comprar. */
  kind: PurchaseKindId | null;
  /** Importe en unidades enteras (pesos) a pagar ahora; `null` si no se puede comprar. */
  amount: number | null;
}

/** Todo lo que necesita el panel «Mejorar evento» de un evento. */
export interface EventUpgradeView {
  eventId: string;
  title: string;
  plan: PlanId;
  accessState: EventAccessState;
  paidAccessEndsAt: Date | null;
  options: EventPlanOption[];
  /** ¿Se pueden pagar planes en este entorno? */
  payments: BillingProviderState["status"];
  /** Hay un pago iniciado recientemente y aún sin confirmar (para «Estamos confirmando tu pago…»). */
  pendingPayment: boolean;
}

const PENDING_WINDOW_MS = 60 * 60 * 1000;

export async function getEventUpgradeView(user: Pick<AppUser, "id">, eventId: string, deps: BillingServiceDeps = defaultDeps): Promise<EventUpgradeView | undefined> {
  const billing = await deps.findOwnedEventBilling(user.id, eventId);
  if (!billing) return undefined;
  const now = deps.now();
  const plan = getEffectiveEventPlan(billing.purchases);
  const options: EventPlanOption[] = PAID_PLAN_IDS.map((target) => {
    const quote = quoteEventPurchase(plan, target);
    if (quote.ok) return { plan: target, state: "available", kind: quote.kind, amount: quote.amount };
    return { plan: target, state: quote.reason === "already_at_plan" ? "current" : "included", kind: null, amount: null };
  });
  return {
    eventId: billing.eventId,
    title: billing.title,
    plan,
    accessState: getEventAccessState({ plan, paidAccessEndsAt: billing.paidAccessEndsAt, now }),
    paidAccessEndsAt: billing.paidAccessEndsAt,
    options,
    payments: deps.getProviderState().status,
    pendingPayment: billing.purchases.some((purchase) => purchase.status === "PENDING" && now.getTime() - purchase.createdAt.getTime() < PENDING_WINDOW_MS),
  };
}

/** Una fila de «Compras y planes»: un evento, su plan, su acceso, su uso y su historial de pagos. */
export interface BillingEventRow {
  eventId: string;
  slug: string;
  title: string;
  startsAt: Date;
  plan: PlanId;
  accessState: EventAccessState;
  paidAccessEndsAt: Date | null;
  guests: { count: number; max: number | null };
  gallery: { count: number; max: number | null };
  purchases: { id: string; plan: PlanId; kind: PurchaseKindId; status: PurchaseStatusId; amount: number; currency: string; paidAt: Date | null }[];
  canUpgrade: boolean;
}

export interface BillingOverview {
  events: BillingEventRow[];
  payments: BillingProviderState["status"];
}

export async function getBillingOverview(user: Pick<AppUser, "id">, deps: BillingServiceDeps = defaultDeps): Promise<BillingOverview> {
  const rows = await deps.listOwnedEventsBilling(user.id);
  const now = deps.now();
  const events = rows.map((row): BillingEventRow => {
    const plan = getEffectiveEventPlan(row.purchases);
    const { limits } = getPlanConfig(plan);
    return {
      eventId: row.eventId,
      slug: row.slug,
      title: row.title,
      startsAt: row.startsAt,
      plan,
      accessState: getEventAccessState({ plan, paidAccessEndsAt: row.paidAccessEndsAt, now }),
      paidAccessEndsAt: row.paidAccessEndsAt,
      guests: { count: row.guestCount, max: limits.maxGuestsPerEvent },
      gallery: { count: row.galleryCount, max: limits.maxGalleryImages },
      // Solo el historial financiero real: lo cobrado y lo reembolsado (los intentos pendientes o fallidos no son compras).
      purchases: row.purchases.filter((purchase) => purchase.status === "PAID" || purchase.status === "REFUNDED").map((purchase) => ({ id: purchase.id, plan: purchase.plan, kind: purchase.kind, status: purchase.status, amount: purchase.amount, currency: purchase.currency, paidAt: purchase.paidAt })),
      canUpgrade: PAID_PLAN_IDS.some((target) => quoteEventPurchase(plan, target).ok),
    };
  });
  return { events, payments: deps.getProviderState().status };
}

/**
 * 3. RECONCILIACIÓN (regreso del pago / soporte): vuelve a leer del proveedor los pagos PENDIENTES de ESTE evento del usuario y los
 * aplica con las MISMAS verificaciones que el webhook. No sustituye al webhook ni cambia nada si el proveedor no está configurado.
 */
export async function reconcileEventPayments(user: Pick<AppUser, "id">, eventId: string, deps: BillingServiceDeps = defaultDeps): Promise<{ granted: number }> {
  const state = deps.getProviderState();
  if (state.status !== "ready") return { granted: 0 };
  const { provider } = state;
  const billing = await deps.findOwnedEventBilling(user.id, eventId);
  if (!billing) return { granted: 0 };

  const payments: ProviderPayment[] = [];
  for (const purchase of billing.purchases.filter((candidate) => candidate.status === "PENDING")) {
    const payment = await provider.getPayment(purchase.checkoutSessionId);
    if (payment) payments.push(payment);
  }
  let granted = 0;
  const now = deps.now();
  await deps.store.apply(async (ops) => {
    for (const payment of payments) if ((await confirmPayment(ops, provider, payment, now)) === "granted") granted += 1;
  });
  return { granted };
}
