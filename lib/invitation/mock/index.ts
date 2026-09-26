import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { changeTemplate } from "@/lib/invitation/change-template";
import type { Invitation } from "@/types/invitation";

/**
 * Acceso MOCK a invitaciones (sin base de datos). Las invitaciones de demostración
 * `demo-<plantilla>` son SIEMPRE los mismos datos de Andrea & Fernando con la plantilla indicada:
 * así se ve que los datos no dependen de la plantilla. Solo `demo-magnolia` (`status = implemented`)
 * se enlaza desde la interfaz; `demo-ivory` y `demo-etoile` (`concept`) existen temporalmente para
 * probar el motor y NO se enlazan (`getTemplateCapabilities`). Las plantillas `comingSoon` no tienen
 * demo. La aplicación YA NO lo usa (lee la BD: `server/repositories/invitations.ts` y
 * `lib/invitation/demo.ts`); queda para las pruebas del motor.
 */
export function getMockInvitation(slug: string): Invitation | undefined {
  if (slug === andreaFernandoInvitation.slug) return andreaFernandoInvitation;

  const match = /^demo-(.+)$/.exec(slug);
  const templateSlug = match?.[1];
  if (templateSlug && getInvitationTemplate(templateSlug)) {
    return { ...changeTemplate(andreaFernandoInvitation, templateSlug), slug };
  }
  return undefined;
}
