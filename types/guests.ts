/**
 * Tipos del Guest Manager. Son tipos de dominio/UI: los componentes nunca ven modelos de Prisma.
 * `status` es el valor persistido (`Guest.status`); `statusGroup` es cómo se muestra y se cuenta
 * ("Tal vez" cuenta como Pendiente, CLAUDE.md decisión 8).
 */
export type GuestStatus = "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
export type GuestStatusGroup = "confirmed" | "pending" | "declined";
export type GuestStatusFilter = "all" | GuestStatusGroup;
/** Quién lo dio de alta (D-40). `HOST` = el anfitrión (Guest Manager); `PUBLIC_RSVP` = se auto-registró al
 * responder por el enlace general, sin invitación previa (cuenta contra su propia cuota, no la de invitados). */
export type GuestSource = "HOST" | "PUBLIC_RSVP";

export interface GuestRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  groupId: string | null;
  groupName: string | null;
  /** Acompañantes permitidos además del invitado (no son filas de Guest). */
  maxCompanions: number;
  status: GuestStatus;
  statusGroup: GuestStatusGroup;
  /** Total de asistentes confirmados (incluye al invitado); solo si ya respondió que asistirá. */
  attendeeCount: number | null;
  /** Enlace personalizado `<base>/i/<slug>?guest=<token>` (usa el token opaco, nunca el id). */
  inviteUrl: string;
  source: GuestSource;
}

export interface GuestGroupOption {
  id: string;
  name: string;
}

/** Filtros de la lista, reflejados en la URL (`?q=&status=&group=`). `group`: "" = todos, "none" = sin grupo. */
export interface GuestFilters {
  q: string;
  status: GuestStatusFilter;
  group: string;
}

export interface GuestSummary {
  total: number;
  confirmed: number;
  pending: number;
  declined: number;
  /** Suma de `maxCompanions`: acompañantes que podrían asistir. */
  potentialCompanions: number;
}

export type GuestField = "name" | "email" | "phone" | "groupId" | "newGroupName" | "maxCompanions" | "status";

/** Resultado de una acción del Guest Manager: nunca incluye errores internos ni datos ajenos. */
export type GuestActionResult =
  | { ok: true; message: string }
  | { ok: false; code: "unauthenticated" | "not_found" | "invalid" | "unavailable" | "limit_reached" | "error"; message: string; fieldErrors?: Partial<Record<GuestField, string>> };
