import { planConfigs, planIncludes, type FeatureId, type LimitId, type PlanId } from "@/lib/billing/plans";

/**
 * DERECHOS EFECTIVOS de un EVENTO (D-32): lo que el dominio pregunta («¿puede usar X?», «¿cuánto de Y?») sin saber
 * nada del proveedor de cobro. Módulo puro: convierte un plan en derechos y decide límites; no accede a datos.
 */
export interface Entitlements {
  plan: PlanId;
  features: Readonly<Record<FeatureId, boolean>>;
  /** `null` = sin límite. */
  limits: Readonly<Record<LimitId, number | null>>;
}

export function entitlementsForPlan(plan: PlanId): Entitlements {
  const config = planConfigs[plan];
  return { plan, features: { ...config.features }, limits: { ...config.limits } };
}

export const canUse = (entitlements: Entitlements, feature: FeatureId): boolean => entitlements.features[feature];
export const limitOf = (entitlements: Entitlements, limit: LimitId): number | null => entitlements.limits[limit];

/**
 * Resultado de comprobar una cuota. `current` es lo que YA existe. Añadir `adding` elementos cabe si
 * `current + adding <= límite`. Estar por encima del límite (p. ej. tras un reembolso) no borra nada: solo impide añadir.
 */
export type LimitCheck = { ok: true; limit: number | null; current: number } | { ok: false; limit: number; current: number };

export function checkLimit(entitlements: Entitlements, limit: LimitId, current: number, adding = 1): LimitCheck {
  const max = entitlements.limits[limit];
  if (max === null) return { ok: true, limit: null, current };
  return current + adding <= max ? { ok: true, limit: max, current } : { ok: false, limit: max, current };
}

/** ¿Puede usar una plantilla cuyo plan mínimo es `minimumPlan`? */
export const canUseTemplate = (entitlements: Entitlements, minimumPlan: PlanId): boolean => planIncludes(entitlements.plan, minimumPlan);

export type EntitlementFailureCode = "feature_unavailable" | "limit_reached" | "plan_required";

/** Lo lanza `assertEntitlement`. El mensaje es apto para mostrar (sin datos internos). */
export class EntitlementError extends Error {
  readonly code: EntitlementFailureCode;
  readonly feature?: FeatureId;
  readonly limit?: LimitId;

  constructor(code: EntitlementFailureCode, message: string, detail: { feature?: FeatureId; limit?: LimitId } = {}) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
    if (detail.feature) this.feature = detail.feature;
    if (detail.limit) this.limit = detail.limit;
  }
}
