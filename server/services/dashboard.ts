import type { Event, Guest, Rsvp } from "@prisma/client";
import { dbDateToEventIso } from "@/server/mappers/invitation";
import type { Invitation } from "@/types/invitation";
import type { PublicationInfo } from "@/types/published";
import type { EventActivity, EventDashboardData, GuestPreview, GuestPreviewStatus, RsvpSummary } from "@/types/dashboard";

/**
 * REGLAS DE NEGOCIO del panel del evento (CLAUDE.md regla 13: viven en `server/services`). Funciones
 * puras: reciben filas ya leídas y devuelven los datos que dibuja el dashboard; por eso se prueban sin BD.
 *  - Confirmados = invitados `ATTENDING`. Pendientes = `PENDING` + `MAYBE` ("Tal vez" cuenta como
 *    pendiente, CLAUDE.md decisión 8). No asistirán = `DECLINED`.
 *  - La actividad reciente se deriva de las respuestas (`Rsvp.submittedAt`) y de la primera vista de la
 *    invitación (`Guest.firstViewedAt`); no hay tabla de actividad todavía.
 */

export type DashboardEventRow = Pick<Event, "id" | "slug" | "title" | "startsAt" | "timezone">;
export type DashboardGuestRow = Pick<Guest, "id" | "name" | "status" | "firstViewedAt" | "createdAt"> & {
  rsvp: Pick<Rsvp, "status" | "attendeeCount" | "submittedAt"> | null;
};

export function summarizeRsvp(guests: readonly Pick<Guest, "status">[]): RsvpSummary {
  const summary: RsvpSummary = { confirmed: 0, pending: 0, declined: 0 };
  for (const { status } of guests) {
    if (status === "ATTENDING") summary.confirmed += 1;
    else if (status === "DECLINED") summary.declined += 1;
    else summary.pending += 1;
  }
  return summary;
}

export function deriveRecentActivity(guests: readonly DashboardGuestRow[], limit = 4): EventActivity[] {
  const items: EventActivity[] = [];
  for (const guest of guests) {
    const rsvp = guest.rsvp;
    if (rsvp?.status === "ATTENDING") {
      items.push({
        id: `rsvp_${guest.id}`,
        type: "rsvp_confirmed",
        actorName: guest.name,
        occurredAt: rsvp.submittedAt.toISOString(),
        ...(rsvp.attendeeCount && rsvp.attendeeCount > 1 ? { metadata: { guests: rsvp.attendeeCount } } : {}),
      });
    } else if (rsvp?.status === "DECLINED") {
      items.push({ id: `rsvp_${guest.id}`, type: "rsvp_declined", actorName: guest.name, occurredAt: rsvp.submittedAt.toISOString() });
    } else if (guest.firstViewedAt) {
      // Sin respuesta (o "Tal vez"): solo se sabe que abrió la invitación.
      items.push({ id: `view_${guest.id}`, type: "invitation_viewed", actorName: guest.name, occurredAt: guest.firstViewedAt.toISOString() });
    }
  }
  return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, limit);
}

const previewStatus: Record<Guest["status"], GuestPreviewStatus> = {
  ATTENDING: "confirmed",
  PENDING: "pending",
  MAYBE: "pending",
  DECLINED: "declined",
};

export function deriveGuestPreview(guests: readonly DashboardGuestRow[], limit = 3): GuestPreview[] {
  return [...guests]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, limit)
    .map((guest) => ({ id: guest.id, name: guest.name, status: previewStatus[guest.status] }));
}

/** Datos del dashboard a partir de lo persistido. La fecha canónica es `Event.startsAt`. */
export function buildDashboardData(input: { event: DashboardEventRow; invitation: Invitation; guests: readonly DashboardGuestRow[]; publication?: PublicationInfo }): EventDashboardData {
  const { event, invitation, guests, publication = { state: "published", version: 0 } } = input;
  return {
    event: {
      id: event.id,
      title: event.title,
      startsAt: dbDateToEventIso(event.startsAt, event.timezone),
      timezone: event.timezone,
      publicSlug: invitation.slug,
      publication,
    },
    invitation,
    rsvpSummary: summarizeRsvp(guests),
    recentActivity: deriveRecentActivity(guests),
    guestPreview: deriveGuestPreview(guests),
  };
}
