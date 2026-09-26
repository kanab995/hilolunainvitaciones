import { getServerNow } from "@/lib/invitation/server-time";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { dbInvitationToDomain } from "@/server/mappers/invitation";
import { getDemoRows } from "@/server/repositories/demo-store";
import { getOwnedEventByRef } from "@/server/repositories/events";
import { invitationInclude } from "@/server/repositories/invitations";
import { buildDashboardData } from "@/server/services/dashboard";
import { toPublicationInfo } from "@/lib/publishing/state";
import type { EventDashboardData } from "@/types/dashboard";

/**
 * Datos del panel de un evento DEL USUARIO: evento + invitación + invitados con su respuesta, y las
 * métricas derivadas por `server/services/dashboard`. La propiedad se comprueba en la consulta
 * (`ownerId`); un evento ajeno devuelve `undefined`, igual que uno inexistente.
 */
export async function getOwnedDashboardData(userId: string, ref: string): Promise<EventDashboardData | undefined> {
  const summary = await getOwnedEventByRef(userId, ref);
  if (!summary) return undefined;

  if (getDataSource() === "demo") {
    const { event, invitation, guests } = getDemoRows(new Date(getServerNow()));
    return buildDashboardData({ event, invitation: dbInvitationToDomain(invitation), guests });
  }

  const event = await prisma.event.findFirst({
    where: { id: summary.id, ownerId: userId },
    include: { invitation: { include: invitationInclude }, guests: { include: { rsvp: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!event?.invitation) return undefined;
  return buildDashboardData({ event, invitation: dbInvitationToDomain(event.invitation), guests: event.guests, publication: toPublicationInfo(event.invitation) });
}
