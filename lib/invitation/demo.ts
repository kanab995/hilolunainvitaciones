import { changeTemplate } from "@/lib/invitation/change-template";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { getDemoEventInvitation } from "@/server/repositories/invitations";
import type { Invitation } from "@/types/invitation";

/**
 * Invitaciones de demostración `demo-<plantilla>`: los datos persistidos del evento demo con la
 * plantilla indicada (los datos no dependen de la plantilla). No se guardan: se derivan al vuelo.
 * Solo existen para plantillas con tema en el motor (`getInvitationTemplate`).
 */
export async function getDemoInvitation(slug: string): Promise<Invitation | undefined> {
  const templateSlug = /^demo-(.+)$/.exec(slug)?.[1];
  if (!templateSlug || !getInvitationTemplate(templateSlug)) return undefined;
  const base = await getDemoEventInvitation();
  return base ? { ...changeTemplate(base, templateSlug), slug } : undefined;
}
