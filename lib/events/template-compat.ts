import type { EventCategoryId } from "@/types/marketing";
import type { Template } from "@/types/templates";

/**
 * COMPATIBILIDAD plantilla ↔ tipo de evento (D-28). Regla actual: una plantilla solo sirve para SU tipo de
 * evento (`Template.eventType`; Magnolia = boda) y solo si su diseño está aprobado (`status = implemented`).
 * No se crea todavía un campo `supportedEventTypes`: cuando una plantilla soporte varios tipos bastará con
 * ampliar `supports` (una sola función) sin tocar el flujo de creación.
 */
export type TemplateEligibility =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_available" | "incompatible"; message: string };

type TemplateLike = Pick<Template, "name" | "status" | "eventType">;

/** ¿La plantilla admite este tipo de evento? */
export const supports = (template: Pick<Template, "eventType">, eventType: EventCategoryId): boolean => template.eventType === eventType;

export function checkTemplateForEvent(template: TemplateLike | undefined, eventType: EventCategoryId, typeLabel: string): TemplateEligibility {
  if (!template) return { ok: false, reason: "not_found", message: "No encontramos esa plantilla." };
  if (template.status !== "implemented") return { ok: false, reason: "not_available", message: "Esta plantilla estará disponible próximamente." };
  if (!supports(template, eventType)) return { ok: false, reason: "incompatible", message: `${template.name} todavía no está disponible para ${typeLabel.toLowerCase()}. Elige otra plantilla.` };
  return { ok: true };
}

/** Plantillas que se pueden usar para crear un evento de este tipo. */
export const templatesFor = <T extends TemplateLike>(templates: readonly T[], eventType: EventCategoryId): T[] => templates.filter((template) => template.status === "implemented" && supports(template, eventType));
