import { auroraXvTemplate } from "@/lib/invitation/templates/aurora-xv";
import { celesteTemplate } from "@/lib/invitation/templates/celeste";
import { etoileTemplate } from "@/lib/invitation/templates/etoile";
import { ivoryTemplate } from "@/lib/invitation/templates/ivory";
import { level12Template } from "@/lib/invitation/templates/level-12";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * Registro de plantillas de invitación. Único lugar que conoce las plantillas por nombre: el
 * renderizador y las secciones reciben un `InvitationTemplate` y nunca preguntan cuál es.
 */
export const invitationTemplates: readonly InvitationTemplate[] = [magnoliaTemplate, ivoryTemplate, etoileTemplate, level12Template, auroraXvTemplate, celesteTemplate];

/** Plantilla usada cuando el slug no está registrado (nunca rompe una invitación). */
export const defaultInvitationTemplate: InvitationTemplate = magnoliaTemplate;

export function getInvitationTemplate(slug: string): InvitationTemplate | undefined {
  return invitationTemplates.find((template) => template.slug === slug);
}
