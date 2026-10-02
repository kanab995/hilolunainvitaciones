import type { Guest } from "@prisma/client";
import { statusGroupOf } from "@/lib/guests/filter";
import { getGuestInvitationUrl } from "@/lib/site-url";
import type { GuestRow } from "@/types/guests";

/** Un invitado tal como sale de la BD (con el nombre de su grupo). Nunca llega a un componente. */
export type GuestRecord = Pick<Guest, "id" | "name" | "email" | "phone" | "groupId" | "maxCompanions" | "status" | "inviteToken" | "createdAt" | "source"> & {
  groupName: string | null;
  /** `Rsvp.attendeeCount` (incluye al invitado principal); nulo si no hay respuesta. */
  attendeeCount: number | null;
};

/** Fila de BD → fila de la interfaz. El enlace personalizado usa el token opaco, jamás el id. */
export function guestRecordToRow(record: GuestRecord, invitationSlug: string): GuestRow {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    groupId: record.groupId,
    groupName: record.groupName,
    maxCompanions: record.maxCompanions,
    status: record.status,
    statusGroup: statusGroupOf(record.status),
    attendeeCount: record.status === "ATTENDING" ? record.attendeeCount : null,
    inviteUrl: getGuestInvitationUrl(invitationSlug, record.inviteToken),
    source: record.source,
  };
}
