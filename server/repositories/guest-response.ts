import type { RsvpStatus } from "@prisma/client";
import type { prisma } from "@/server/db/client";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * ÚNICO ESCRITOR del estado de respuesta de un invitado (docs/DATABASE_SCHEMA.md §13).
 *  - `Rsvp.status` es la respuesta persistente; `Guest.status` es el estado VIGENTE del invitado (lo que
 *    cuentan el dashboard y el Guest Manager) y se mantiene IGUAL en la misma transacción. Sin esta
 *    función no puede haber divergencias silenciosas: la usan el RSVP público y la edición del Guest Manager.
 *  - Con `response` (RSVP público) se crea o actualiza la respuesta completa (`upsert` por `guestId`, único:
 *    un invitado nunca tiene dos respuestas, ni siquiera con peticiones simultáneas).
 *  - Sin `response` (el anfitrión cambia el estado a mano) solo se actualiza la respuesta que ya exista.
 * `attendeeCount` incluye al invitado principal: DECLINED = 0, MAYBE/PENDING = null.
 */
export interface GuestResponse {
  attendeeCount: number | null;
  message: string | null;
  submittedAt: Date;
}

export const attendeeCountFor = (status: RsvpStatus): number | null | undefined => (status === "DECLINED" ? 0 : status === "MAYBE" || status === "PENDING" ? null : undefined);

export async function writeGuestResponse(tx: Tx, params: { eventId: string; guestId: string; status: RsvpStatus; response?: GuestResponse }): Promise<{ rsvpId: string | null }> {
  const { eventId, guestId, status, response } = params;
  await tx.guest.updateMany({ where: { id: guestId, eventId }, data: { status } });

  if (response) {
    const data = { status, attendeeCount: response.attendeeCount, message: response.message, submittedAt: response.submittedAt };
    const rsvp = await tx.rsvp.upsert({ where: { guestId }, create: { eventId, guestId, ...data }, update: data, select: { id: true } });
    return { rsvpId: rsvp.id };
  }

  const count = attendeeCountFor(status);
  await tx.rsvp.updateMany({ where: { guestId, eventId }, data: { status, ...(count !== undefined ? { attendeeCount: count } : {}) } });
  return { rsvpId: null };
}
