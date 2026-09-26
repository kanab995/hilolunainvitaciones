import { PAID_PLAN_IDS, PLAN_IDS, FREE_PLAN, getPlanConfig, isPaidPlanId, planConfigs, planIncludes, type PaidPlanId, type PlanId } from "@/lib/billing/plans";

/**
 * COMPRAS POR EVENTO (D-32). Lógica pura, sin proveedor ni base de datos:
 *  - qué plan tiene un evento (`getEffectiveEventPlan`),
 *  - qué se puede comprar y cuánto cuesta (`quoteEventPurchase`),
 *  - hasta cuándo dura el acceso de un evento de pago (`computePaidAccessEnd`, `extendPaidAccessEnd`, `getEventAccessState`).
 *
 * POLÍTICA (documentada en docs/BILLING.md):
 *  - El plan de un evento es el MAYOR plan de sus compras `PAID`. Sin compras pagadas → FREE. `PENDING`, `FAILED`, `CANCELED` y
 *    `REFUNDED` nunca conceden nada (un pago fallido conserva el plan actual; un reembolso lo retira).
 *  - Mejoras permitidas: Gratis → Esencial, Gratis → Premium, Esencial → Premium (solo la diferencia). Sin bajar de plan ni recomprar.
 *  - Acceso de pago: hasta 30 días después de la fecha del evento (o de la compra, si es posterior). Solo crece.
 *  - El acceso vencido NO borra nada; hoy solo se calcula el estado (`expired`) y se prepara `isEventAccessActive`.
 */
export const BILLING_PROVIDERS = ["STRIPE", "MERCADO_PAGO"] as const;
export type BillingProviderId = (typeof BILLING_PROVIDERS)[number];

export const PURCHASE_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELED"] as const;
export type PurchaseStatusId = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_KINDS = ["INITIAL", "UPGRADE"] as const;
export type PurchaseKindId = (typeof PURCHASE_KINDS)[number];

/** Días de acceso completo después de la fecha del evento. */
export const PAID_ACCESS_DAYS = 30;
const DAY_MS = 86_400_000;

export const isPurchaseStatus = (value: unknown): value is PurchaseStatusId => typeof value === "string" && (PURCHASE_STATUSES as readonly string[]).includes(value);

/** Lo mínimo de una compra que necesita la política. */
export interface PurchaseSnapshot {
  plan: PlanId;
  status: PurchaseStatusId;
}

/** Plan efectivo de un evento: el mayor plan `PAID`; si no hay ninguno, FREE. */
export function getEffectiveEventPlan(purchases: readonly PurchaseSnapshot[]): PlanId {
  let best: PlanId = FREE_PLAN;
  for (const purchase of purchases) {
    if (purchase.status !== "PAID" || !(PLAN_IDS as readonly string[]).includes(purchase.plan)) continue;
    if (planConfigs[purchase.plan].rank > planConfigs[best].rank) best = purchase.plan;
  }
  return best;
}

/** Unidades menores (centavos) de un importe en unidades enteras. */
export const toMinorUnits = (amount: number): number => Math.round(amount * 100);

/**
 * Presupuesto de una compra para un evento cuyo plan actual es `current`. Devuelve el tipo (`INITIAL` / `UPGRADE`), el importe
 * esperado y la variable de entorno del precio del proveedor. La mejora Esencial → Premium cuesta la DIFERENCIA
 * (`Premium − Esencial`, calculada de la configuración: nunca un número escrito a mano).
 */
export type PurchaseQuote =
  | { ok: true; kind: PurchaseKindId; plan: PaidPlanId; from: PlanId; amount: number; amountMinor: number; currency: string; priceEnvKey: string }
  | { ok: false; reason: "not_paid_plan" | "already_at_plan" | "downgrade" | "upgrade_unavailable" };

export function quoteEventPurchase(current: PlanId, target: unknown): PurchaseQuote {
  if (!isPaidPlanId(target)) return { ok: false, reason: "not_paid_plan" };
  if (current === target) return { ok: false, reason: "already_at_plan" };
  if (planIncludes(current, target)) return { ok: false, reason: "downgrade" };

  const targetConfig = getPlanConfig(target);
  const { currency } = targetConfig.pricing;
  if (current === FREE_PLAN) {
    const key = targetConfig.pricing.stripePriceEnvKey;
    if (!key) return { ok: false, reason: "not_paid_plan" };
    const amount = targetConfig.pricing.displayPrice;
    return { ok: true, kind: "INITIAL", plan: target, from: current, amount, amountMinor: toMinorUnits(amount), currency, priceEnvKey: key };
  }
  const upgrade = targetConfig.pricing.upgradeFrom[current];
  if (!upgrade) return { ok: false, reason: "upgrade_unavailable" };
  const amount = targetConfig.pricing.displayPrice - getPlanConfig(current).pricing.displayPrice;
  if (amount <= 0) return { ok: false, reason: "upgrade_unavailable" };
  return { ok: true, kind: "UPGRADE", plan: target, from: current, amount, amountMinor: toMinorUnits(amount), currency, priceEnvKey: upgrade.stripePriceEnvKey };
}

/** ¿Qué compra representa una variable de precio? (para mapear un `price_…` del proveedor a plan y tipo). */
export function purchaseForPriceKey(envKey: string): { plan: PaidPlanId; kind: PurchaseKindId; from: PlanId } | undefined {
  for (const plan of PAID_PLAN_IDS) {
    const { stripePriceEnvKey, upgradeFrom } = planConfigs[plan].pricing;
    if (stripePriceEnvKey === envKey) return { plan, kind: "INITIAL", from: FREE_PLAN };
    for (const [from, upgrade] of Object.entries(upgradeFrom)) if (upgrade.stripePriceEnvKey === envKey) return { plan, kind: "UPGRADE", from: from as PlanId };
  }
  return undefined;
}

/**
 * Importe esperado (unidades menores) de una compra ya identificada: `INITIAL` = precio del plan; `UPGRADE` = diferencia con el
 * plan de origen. Es lo que el webhook exige que coincida con lo cobrado.
 */
export function expectedPurchaseAmountMinor(purchase: { plan: PaidPlanId; kind: PurchaseKindId; from: PlanId }): number {
  const target = getPlanConfig(purchase.plan).pricing.displayPrice;
  const origin = purchase.kind === "UPGRADE" ? getPlanConfig(purchase.from).pricing.displayPrice : 0;
  return toMinorUnits(target - origin);
}

// ───────── Ventana de acceso ─────────

const plusDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

/**
 * Fin del acceso de una compra: `max(compra + 30 días, fecha del evento + 30 días, fin actual)`. Así comprar un evento que ya pasó
 * da como mínimo 30 días desde la compra, y una compra posterior (mejora) nunca acorta el acceso ya pagado.
 */
export function computePaidAccessEnd(input: { startsAt: Date; paidAt: Date; currentEnd?: Date | null }): Date {
  const candidates = [plusDays(input.paidAt, PAID_ACCESS_DAYS), plusDays(input.startsAt, PAID_ACCESS_DAYS)];
  if (input.currentEnd) candidates.push(input.currentEnd);
  return new Date(Math.max(...candidates.map((date) => date.getTime())));
}

/**
 * Al CAMBIAR la fecha de un evento de pago: `max(fin actual, nueva fecha + 30 días)`. Mover el evento hacia adelante extiende el
 * acceso; hacia atrás nunca lo acorta. Un evento sin acceso de pago (`null`, Gratis) no tiene ventana que extender.
 */
export function extendPaidAccessEnd(currentEnd: Date | null | undefined, newStartsAt: Date): Date | null {
  if (!currentEnd) return null;
  return new Date(Math.max(currentEnd.getTime(), plusDays(newStartsAt, PAID_ACCESS_DAYS).getTime()));
}

export type EventAccessState = "free" | "active" | "expired";

/** Estado del acceso: `free` (sin compra), `active` (dentro de la ventana) o `expired` (pasó `paidAccessEndsAt`). */
export function getEventAccessState(input: { plan: PlanId; paidAccessEndsAt: Date | null | undefined; now: Date }): EventAccessState {
  if (input.plan === FREE_PLAN) return "free";
  if (!input.paidAccessEndsAt) return "active";
  return input.now.getTime() <= input.paidAccessEndsAt.getTime() ? "active" : "expired";
}

/**
 * ¿La invitación de este evento sigue disponible según su acceso? (`free` y `active` → sí). PREPARADO, no aplicado todavía: la
 * página pública aún no consulta esto (documentado en docs/BILLING.md como siguiente paso de enforcement); vencer nunca borra datos.
 */
export const isEventAccessActive = (input: { plan: PlanId; paidAccessEndsAt: Date | null | undefined; now: Date }): boolean => getEventAccessState(input) !== "expired";
