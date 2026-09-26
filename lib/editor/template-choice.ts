import { getTemplateBySlug } from "@/lib/content/templates";
import { getInvitationTemplate, invitationTemplates } from "@/lib/invitation/templates";
import type { TemplateStatus } from "@/types/templates";

/**
 * Plantillas que el editor ofrece y cuáles se pueden elegir (docs/ARCHITECTURE.md §4.9):
 *  - `implemented` (Magnolia): seleccionable.
 *  - `concept` (Ivory, Étoile): se muestran como "Próximamente" y NO son seleccionables.
 *  - `comingSoon`: no aporta valor en el editor (no tienen tema): no se listan.
 */
export interface TemplateChoice {
  slug: string;
  name: string;
  status: TemplateStatus;
  selectable: boolean;
}

export function getTemplateStatus(slug: string): TemplateStatus | undefined {
  return getTemplateBySlug(slug)?.status;
}

/** ¿Se puede activar esta plantilla desde el editor? Requiere estado `implemented` y tema en el motor. */
export function canSelectTemplate(slug: string): boolean {
  return getTemplateStatus(slug) === "implemented" && getInvitationTemplate(slug) !== undefined;
}

export function getTemplateChoices(): TemplateChoice[] {
  return invitationTemplates.flatMap((engine) => {
    const entry = getTemplateBySlug(engine.slug);
    if (!entry || entry.status === "comingSoon") return [];
    return [{ slug: engine.slug, name: entry.name, status: entry.status, selectable: entry.status === "implemented" }];
  });
}
