import type { Invitation } from "@/types/invitation";
import type { PublicationInfo } from "@/types/published";

/**
 * Datos del panel de un evento (mockup 05). Forma pensada para servirse desde el backend más
 * adelante; hoy vienen de `lib/dashboard/mock`. Los componentes visuales NUNCA contienen estos datos:
 * los reciben ya cargados.
 */

/** Evento. La fecha canónica es `startsAt` (docs/ARCHITECTURE.md §4.7): de ahí salen "17 Mayo 2027" y "Faltan X días". */
export interface DashboardEvent {
  id: string;
  /** "Andrea & Fernando". */
  title: string;
  /** ISO 8601 con desfase (mismo instante que `Invitation.event.startsAt`; no es otra fuente). */
  startsAt: string;
  timezone: string;
  /** Slug público de la invitación (`/i/[slug]`); lo usa el enlace para compartir. */
  publicSlug: string;
  /** Estado de publicación (D-29): Borrador, Publicado o Cambios sin publicar. */
  publication: PublicationInfo;
}

/** Resumen de confirmaciones. "Tal vez" cuenta como pendiente (CLAUDE.md, decisión 8). */
export interface RsvpSummary {
  confirmed: number;
  pending: number;
  declined: number;
}

export type ActivityType = "rsvp_confirmed" | "rsvp_declined" | "invitation_viewed";

/** Una entrada de la actividad reciente. El texto se DERIVA de `type` + `metadata` (`describeActivity`). */
export interface EventActivity {
  id: string;
  type: ActivityType;
  actorName: string;
  /** Instante (ISO 8601); el tiempo relativo ("Hace 2 horas") se calcula al mostrarlo. */
  occurredAt: string;
  metadata?: { guests?: number };
}

export type GuestPreviewStatus = "confirmed" | "pending" | "declined";

/** Invitado de la mini lista de la tarjeta "Invitados". */
export interface GuestPreview {
  id: string;
  name: string;
  status: GuestPreviewStatus;
}

export interface EventDashboardData {
  event: DashboardEvent;
  invitation: Invitation;
  rsvpSummary: RsvpSummary;
  recentActivity: readonly EventActivity[];
  guestPreview: readonly GuestPreview[];
}

/** Persona que usa el panel (la sesión actual). */
export interface DashboardUser {
  /** Nombre para mostrar (nombre real, o la parte local del correo si no hay). */
  name: string;
  /** Correo (opcional; se muestra en el menú de cuenta). Nunca el id de Clerk. */
  email?: string;
}
