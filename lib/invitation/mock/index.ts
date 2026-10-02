import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { babyMateoBabyBloomInvitation } from "@/lib/invitation/mock/baby-mateo-baby-bloom";
import { mateoCelesteInvitation } from "@/lib/invitation/mock/mateo-celeste";
import { nicoSpiderFriendsInvitation } from "@/lib/invitation/mock/nico-spider-friends";
import { santiagoLevel12Invitation } from "@/lib/invitation/mock/santiago-level-12";
import { valentinaAuroraXvInvitation } from "@/lib/invitation/mock/valentina-aurora-xv";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { changeTemplate } from "@/lib/invitation/change-template";
import type { Invitation } from "@/types/invitation";

/**
 * Invitaciones base de demostración que NO reutilizan los datos de Andrea & Fernando: la plantilla
 * es de otro `eventType` (p. ej. Level 12 es un cumpleaños, Aurora XV son XV años, Celeste es un
 * bautizo) y reskinar una boda bajo ese tema no tendría sentido para quien la ve. Cada entrada es la
 * plantilla cuya demo debe mostrar ESTE contenido en vez del de Andrea & Fernando; cualquier plantilla
 * no listada aquí sigue el comportamiento por defecto (reskin de Andrea & Fernando,
 * docs/ARCHITECTURE.md §4.9). Étoile también es `quinceanera` pero sigue sin entrada aquí a propósito:
 * es `concept`, su demo no se enlaza desde la interfaz y solo existe para probar el motor (ver
 * comentario de `getMockInvitation`).
 */
export const STANDALONE_DEMO_BASES: Readonly<Record<string, Invitation>> = {
  "level-12": santiagoLevel12Invitation,
  "aurora-xv": valentinaAuroraXvInvitation,
  celeste: mateoCelesteInvitation,
  "spider-friends": nicoSpiderFriendsInvitation,
  "baby-bloom": babyMateoBabyBloomInvitation,
};

/**
 * Acceso MOCK a invitaciones (sin base de datos). Las invitaciones de demostración
 * `demo-<plantilla>` son SIEMPRE el mismo contenido para el `eventType` de esa plantilla: las de boda
 * (Magnolia, Ivory, Étoile) comparten los datos de Andrea & Fernando con la plantilla indicada —así
 * se ve que los datos no dependen de la plantilla—; las de otro tipo de evento (`STANDALONE_DEMO_BASES`)
 * usan su propio contenido base. Solo `demo-magnolia`, `demo-level-12`, `demo-aurora-xv`,
 * `demo-celeste`, `demo-spider-friends` y `demo-baby-bloom` (`status = implemented`) se enlazan
 * desde la interfaz; `demo-ivory` y `demo-etoile` (`concept`) existen temporalmente para probar el
 * motor y NO se enlazan (`getTemplateCapabilities`).
 * Las plantillas `comingSoon` no tienen demo. La aplicación YA NO lo usa (lee la BD:
 * `server/repositories/invitations.ts` y `lib/invitation/demo.ts`); queda para las pruebas del motor.
 */
export function getMockInvitation(slug: string): Invitation | undefined {
  if (slug === andreaFernandoInvitation.slug) return andreaFernandoInvitation;
  if (slug === santiagoLevel12Invitation.slug) return santiagoLevel12Invitation;
  if (slug === valentinaAuroraXvInvitation.slug) return valentinaAuroraXvInvitation;
  if (slug === mateoCelesteInvitation.slug) return mateoCelesteInvitation;
  if (slug === nicoSpiderFriendsInvitation.slug) return nicoSpiderFriendsInvitation;
  if (slug === babyMateoBabyBloomInvitation.slug) return babyMateoBabyBloomInvitation;

  const match = /^demo-(.+)$/.exec(slug);
  const templateSlug = match?.[1];
  if (!templateSlug || !getInvitationTemplate(templateSlug)) return undefined;
  const base = STANDALONE_DEMO_BASES[templateSlug] ?? andreaFernandoInvitation;
  return { ...changeTemplate(base, templateSlug), slug };
}
