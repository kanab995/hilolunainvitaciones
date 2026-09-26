import { billingCopy } from "@/lib/billing/copy";
import { canUse, canUseTemplate, checkLimit, EntitlementError, entitlementsForPlan, limitOf, type Entitlements } from "@/lib/billing/entitlements";
import { planLabel, type FeatureId, type LimitId, type PlanId } from "@/lib/billing/plans";
import { getEffectiveEventPlan, getEventAccessState, type EventAccessState } from "@/lib/billing/purchase";
import { getServerNow } from "@/lib/invitation/server-time";
import { findEventBillingById, findOwnedEventBilling, type EventBillingState, type PurchaseRecord } from "@/server/repositories/billing";

/**
 * SERVICIO DE DERECHOS POR EVENTO (D-32): la ÚNICA puerta para saber qué puede hacer UN EVENTO. El plan pertenece al evento, no a la
 * cuenta: una misma persona puede tener un evento Gratis, otro Esencial y otro Premium. El dominio pregunta
 * `canUseEventFeature(eventId, "customMedia")` o `getEventLimit(eventId, "maxGuestsPerEvent")`, jamás «¿tiene Stripe?».
 *
 * El plan efectivo sale de las compras `PAID` del evento en la BASE DE DATOS (sincronizada por webhook): no se llama al proveedor
 * en cada petición. Sin compras pagadas, con una compra fallida/pendiente/reembolsada, o sin base de datos → FREE (nunca se
 * concede un plan de pago por defecto). Una lectura indexada por petición; sin caché, así que un webhook se refleja de inmediato.
 *
 * Propiedad: las funciones `…ById` NO comprueban propietario (las usan servicios que ya resolvieron `resolveOwnedEvent`);
 * `getOwnedEventEntitlements(userId, eventId)` sí, en la propia consulta.
 */
export interface EntitlementDeps {
  findEventBilling: (eventId: string) => Promise<EventBillingState | null>;
  findOwnedEventBilling: (userId: string, eventId: string) => Promise<EventBillingState | null>;
  now: () => Date;
}

const defaultDeps: EntitlementDeps = { findEventBilling: findEventBillingById, findOwnedEventBilling, now: () => new Date(getServerNow()) };

/** Plan, ventana de acceso y compras de un evento. */
export interface EventPlanState {
  plan: PlanId;
  paidAccessEndsAt: Date | null;
  accessState: EventAccessState;
  purchases: PurchaseRecord[];
}

function toPlanState(billing: EventBillingState | null, now: Date): EventPlanState {
  const purchases = billing?.purchases ?? [];
  const plan = getEffectiveEventPlan(purchases);
  const paidAccessEndsAt = billing?.paidAccessEndsAt ?? null;
  return { plan, paidAccessEndsAt, accessState: getEventAccessState({ plan, paidAccessEndsAt, now }), purchases };
}

export async function getEventPlanState(eventId: string, deps: EntitlementDeps = defaultDeps): Promise<EventPlanState> {
  return toPlanState(await deps.findEventBilling(eventId), deps.now());
}

export async function getEventPlan(eventId: string, deps: EntitlementDeps = defaultDeps): Promise<PlanId> {
  return (await getEventPlanState(eventId, deps)).plan;
}

export async function getEventEntitlements(eventId: string, deps: EntitlementDeps = defaultDeps): Promise<Entitlements> {
  return entitlementsForPlan(await getEventPlan(eventId, deps));
}

/** Derechos de un evento DEL usuario. Evento ajeno o inexistente → `undefined` (indistinguible). */
export async function getOwnedEventEntitlements(userId: string, eventId: string, deps: EntitlementDeps = defaultDeps): Promise<Entitlements | undefined> {
  const billing = await deps.findOwnedEventBilling(userId, eventId);
  return billing ? entitlementsForPlan(toPlanState(billing, deps.now()).plan) : undefined;
}

export async function canUseEventFeature(eventId: string, feature: FeatureId, deps: EntitlementDeps = defaultDeps): Promise<boolean> {
  return canUse(await getEventEntitlements(eventId, deps), feature);
}

/** Cuota de un evento para un límite (`null` = sin límite). */
export async function getEventLimit(eventId: string, limit: LimitId, deps: EntitlementDeps = defaultDeps): Promise<number | null> {
  return limitOf(await getEventEntitlements(eventId, deps), limit);
}

export type EntitlementRequirement =
  | { feature: FeatureId }
  | { limit: LimitId; current: number; adding?: number }
  | { minimumPlan: PlanId };

/** Lanza `EntitlementError` si el evento no cumple el requisito. Con `limit`, `current` es lo que ya existe en ese evento. */
export async function assertEventEntitlement(eventId: string, requirement: EntitlementRequirement, deps: EntitlementDeps = defaultDeps): Promise<Entitlements> {
  const entitlements = await getEventEntitlements(eventId, deps);
  if ("feature" in requirement) {
    if (!canUse(entitlements, requirement.feature)) throw new EntitlementError("feature_unavailable", billingCopy.featureUnavailable[requirement.feature], { feature: requirement.feature });
  } else if ("limit" in requirement) {
    if (!checkLimit(entitlements, requirement.limit, requirement.current, requirement.adding ?? 1).ok) throw new EntitlementError("limit_reached", billingCopy.limitReached[requirement.limit], { limit: requirement.limit });
  } else if (!canUseTemplate(entitlements, requirement.minimumPlan)) {
    throw new EntitlementError("plan_required", billingCopy.planRequired(planLabel(requirement.minimumPlan)));
  }
  return entitlements;
}
