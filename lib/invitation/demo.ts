import { changeTemplate } from "@/lib/invitation/change-template";
import { STANDALONE_DEMO_BASES } from "@/lib/invitation/mock";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { getDemoEventInvitation } from "@/server/repositories/invitations";
import type { Invitation } from "@/types/invitation";

/**
 * `isDemoInvitation` vive en `lib/invitation/is-demo.ts`, NO aquí (D-41): este archivo importa
 * `server/repositories/invitations.ts` (Prisma, `logger`, `@sentry/node`…), y `isDemoInvitation` la usan
 * componentes que llegan al bundle del navegador (la vista previa en vivo del editor). A propósito NO se
 * reexporta desde aquí — ni siquiera por conveniencia — para que sea imposible importarla por error desde
 * un módulo que arrastraría todo ese árbol de servidor a un Client Component.
 */

/**
 * Invitaciones de demostración `demo-<plantilla>`: para plantillas de boda, los datos persistidos
 * del evento demo (Andrea & Fernando) con la plantilla indicada (los datos no dependen de la
 * plantilla, no se guardan: se derivan al vuelo). Para plantillas de otro `eventType`
 * (`STANDALONE_DEMO_BASES`, p. ej. Level 12) se sirve su propio contenido estático, sin tocar la
 * base de datos: reskinar el evento demo de una boda bajo un tema de cumpleaños no tendría sentido.
 * Solo existen para plantillas con tema en el motor (`getInvitationTemplate`).
 */
export async function getDemoInvitation(slug: string): Promise<Invitation | undefined> {
  const templateSlug = /^demo-(.+)$/.exec(slug)?.[1];
  if (!templateSlug || !getInvitationTemplate(templateSlug)) return undefined;
  const standalone = STANDALONE_DEMO_BASES[templateSlug];
  if (standalone) return { ...changeTemplate(standalone, templateSlug), slug };
  const base = await getDemoEventInvitation();
  return base ? { ...changeTemplate(base, templateSlug), slug } : undefined;
}
