import { FEATURE_IDS, getPlanConfig, planIncludes, type FeatureId, type PlanId } from "@/lib/billing/plans";

/**
 * Filas de comparación de un plan para la página de precios (D-32). Se DERIVAN de `planConfigs` (una sola fuente): cambiar una
 * cuota o una feature en `plans.ts` actualiza el texto sin tocar la interfaz. Solo se listan capacidades que EXISTEN; lo futuro
 * va aparte como «Próximamente» y nunca como algo que ya funciona. Las cuotas son POR EVENTO (no hay límite de eventos).
 */
export interface PlanRow {
  id: string;
  label: string;
  /** `false` = el plan no lo incluye (se muestra atenuado, con texto «No incluido»: no depende solo del color). */
  included: boolean;
}

const featureLabels: Record<FeatureId, string> = {
  publish: "Publicación con enlace propio",
  personalizedGuestLinks: "Enlaces personalizados para cada invitado",
  qr: "Código QR de tu invitación",
  calendar: "Agregar al calendario",
  customMedia: "Tus propias fotos y portada",
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * `templatesAvailable`: plantillas listas para usar que este plan permite (se calcula con el catálogo real y el plan mínimo de
 * cada plantilla; así la cifra sigue siendo cierta cuando una plantilla pase a un plan superior).
 */
export function planRows(plan: PlanId, templatesAvailable: number): PlanRow[] {
  const { limits, features } = getPlanConfig(plan);
  const rows: PlanRow[] = [
    { id: "guests", label: limits.maxGuestsPerEvent === null ? "Invitados sin límite" : `Hasta ${limits.maxGuestsPerEvent} invitados`, included: true },
    { id: "gallery", label: limits.maxGalleryImages === null ? "Galería sin límite de imágenes" : `Galería de hasta ${limits.maxGalleryImages} imágenes`, included: true },
    { id: "publicRsvp", label: limits.maxPublicRsvpResponses === null ? "Respuestas sin límite por tu enlace general" : `Hasta ${limits.maxPublicRsvpResponses} respuestas por tu enlace general`, included: true },
    { id: "templates", label: `${templatesAvailable} ${plural(templatesAvailable, "plantilla disponible hoy", "plantillas disponibles hoy")}`, included: templatesAvailable > 0 },
  ];
  for (const feature of FEATURE_IDS) rows.push({ id: feature, label: featureLabels[feature], included: features[feature] });
  return rows;
}

/** Cuántas de las plantillas dadas (ya listas para usar) permite el plan. */
export const templatesAllowedFor = (plan: PlanId, templates: readonly { minimumPlan: PlanId }[]): number => templates.filter((template) => planIncludes(plan, template.minimumPlan)).length;
