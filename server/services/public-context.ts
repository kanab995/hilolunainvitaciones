import type { PublicInvitationRecord } from "@/server/repositories/public-invitations";
import type { Personalization } from "@/types/public-rsvp";

/**
 * Del registro INTERNO (con ids) al contexto PÚBLICO que llega al navegador. Solo pasan: nombre para
 * mostrar, nombre del grupo, `maxCompanions`, la respuesta vigente y las preguntas. Nunca `Guest.id`,
 * `eventId`, `groupId`, email, teléfono ni marcas de tiempo internas. `undefined` = la URL no traía `guest`.
 */
export function toPersonalization(record: PublicInvitationRecord, invitationSlug: string, token: string): Personalization | undefined {
  if (record.tokenStatus === "none") return undefined;
  if (record.tokenStatus === "invalid" || !record.guest) return { kind: "invalid" };
  const { guest } = record;
  return {
    kind: "guest",
    invitationSlug,
    token,
    guest: {
      displayName: guest.name,
      ...(guest.groupName ? { groupName: guest.groupName } : {}),
      maxCompanions: guest.maxCompanions,
      ...(guest.current ? { currentRsvp: guest.current } : {}),
    },
    questions: record.questions.map(({ id, label, type, required, options }) => ({ id, label, type, required, options })),
  };
}
