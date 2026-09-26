import { billingCopy } from "@/lib/billing/copy";
import { canUseTemplate, checkLimit, entitlementsForPlan, type Entitlements } from "@/lib/billing/entitlements";
import { FREE_PLAN, planLabel, type LimitId, type PlanId } from "@/lib/billing/plans";
import { countEventGalleryImages, countEventGuests } from "@/server/repositories/usage";
import { getEventEntitlements } from "@/server/services/entitlement-service";

/**
 * APLICACIÓN DE LÍMITES EN EL SERVIDOR (D-32), POR EVENTO. Los casos de uso (alta de invitado, añadir imagen a la galería, elegir
 * plantilla) llaman a estas funciones ANTES de escribir, con el plan DEL EVENTO (no de la cuenta). La interfaz deshabilitada mejora
 * la experiencia, pero esta comprobación es la autoridad: nunca se confía en el estado del plan que envíe el cliente.
 * No hay límite de eventos por plan: cada evento se compra por separado y nace Gratis.
 *
 * Política de excedentes: nada se borra jamás. Si un evento ya supera un límite (p. ej. tras un reembolso), todo lo existente se puede
 * ver, editar y recibir RSVP; solo se bloquea AÑADIR hasta volver a estar por debajo o mejorar el evento.
 * Nota de concurrencia: la comprobación es «contar y luego escribir»; dos altas simultáneas pueden pasar el límite por una unidad
 * (deuda documentada; el excedente nunca borra nada).
 */
export type LimitDecision = { ok: true } | { ok: false; code: "limit_reached"; limit: LimitId; max: number; current: number; message: string };
export type TemplatePlanDecision = { ok: true } | { ok: false; code: "plan_required"; minimumPlan: PlanId; message: string };

export interface PlanLimitDeps {
  /** Derechos del plan de ESTE evento. */
  eventEntitlements: (eventId: string) => Promise<Entitlements>;
  countGuests: (userId: string, eventId: string) => Promise<number>;
  countGalleryImages: (userId: string, eventId: string) => Promise<number>;
}

const defaultDeps: PlanLimitDeps = {
  eventEntitlements: (eventId) => getEventEntitlements(eventId),
  countGuests: countEventGuests,
  countGalleryImages: countEventGalleryImages,
};

function decide(entitlements: Entitlements, limit: LimitId, current: number): LimitDecision {
  const check = checkLimit(entitlements, limit, current);
  return check.ok ? { ok: true } : { ok: false, code: "limit_reached", limit, max: check.limit, current: check.current, message: billingCopy.limitReached[limit] };
}

export async function checkGuestLimit(userId: string, eventId: string, deps: PlanLimitDeps = defaultDeps): Promise<LimitDecision> {
  const entitlements = await deps.eventEntitlements(eventId);
  // Sin límite no hace falta contar.
  if (entitlements.limits.maxGuestsPerEvent === null) return { ok: true };
  return decide(entitlements, "maxGuestsPerEvent", await deps.countGuests(userId, eventId));
}

/** Solo la galería: la portada y las imágenes de sedes NO cuentan para este límite. */
export async function checkGalleryLimit(userId: string, eventId: string, deps: PlanLimitDeps = defaultDeps): Promise<LimitDecision> {
  const entitlements = await deps.eventEntitlements(eventId);
  if (entitlements.limits.maxGalleryImages === null) return { ok: true };
  return decide(entitlements, "maxGalleryImages", await deps.countGalleryImages(userId, eventId));
}

const templateDecision = (entitlements: Entitlements, minimumPlan: PlanId): TemplatePlanDecision =>
  canUseTemplate(entitlements, minimumPlan) ? { ok: true } : { ok: false, code: "plan_required", minimumPlan, message: billingCopy.planRequired(planLabel(minimumPlan)) };

/** ¿Puede ESTE evento usar una plantilla con ese plan mínimo? (`Template.minimumPlan` es un plan mínimo DE EVENTO.) */
export async function checkTemplatePlanForEvent(eventId: string, minimumPlan: PlanId, deps: Pick<PlanLimitDeps, "eventEntitlements"> = defaultDeps): Promise<TemplatePlanDecision> {
  return templateDecision(await deps.eventEntitlements(eventId), minimumPlan);
}

/** Un evento nuevo nace Gratis: solo puede usar plantillas de plan Gratis. */
export function checkTemplatePlanForNewEvent(minimumPlan: PlanId): TemplatePlanDecision {
  return templateDecision(entitlementsForPlan(FREE_PLAN), minimumPlan);
}
