/**
 * Contexto PÚBLICO de una invitación personalizada (`/i/<slug>?guest=<token>`). Es lo ÚNICO que llega
 * al navegador sobre la persona invitada: nunca `Guest.id`, `eventId`, `groupId`, email, teléfono ni
 * marcas de tiempo internas. El `token` viaja porque la acción de servidor debe recibirlo para
 * identificar al invitado (es el mismo valor que ya está en la URL que abrió la persona).
 */
export type PublicRsvpStatus = "ATTENDING" | "DECLINED" | "MAYBE";
export type PublicQuestionType = "TEXT" | "CHOICE" | "BOOLEAN";

export interface PublicRsvpQuestion {
  /** Id de la pregunta (necesario para responderla; el servidor comprueba que sea del mismo evento). */
  id: string;
  label: string;
  type: PublicQuestionType;
  required: boolean;
  options: readonly string[];
}

export interface PublicCurrentRsvp {
  status: PublicRsvpStatus;
  /** Total de asistentes, INCLUYENDO al invitado principal (ver docs/DATABASE_SCHEMA.md §13). */
  attendeeCount: number | null;
  message: string | null;
  /** Respuestas a las preguntas, por id de pregunta. */
  answers: Readonly<Record<string, string>>;
}

export interface PublicGuestContext {
  /** Nombre con el que se le saluda (el que escribieron los anfitriones). */
  displayName: string;
  groupName?: string;
  /** Acompañantes permitidos ADEMÁS del invitado: el máximo de asistentes es `1 + maxCompanions`. */
  maxCompanions: number;
  currentRsvp?: PublicCurrentRsvp;
}

export type Personalization =
  | { kind: "guest"; invitationSlug: string; token: string; guest: PublicGuestContext; questions: readonly PublicRsvpQuestion[] }
  /** Había `?guest=` pero no identifica a nadie de ESTA invitación (mal formado, desconocido o de otro evento: no se distingue). */
  | { kind: "invalid" };

/** Resultado de `submitPublicRsvp`: nunca incluye errores internos ni datos de otras personas. */
export type PublicRsvpResult =
  | { ok: true; status: PublicRsvpStatus; attendeeCount: number | null; message: string }
  | {
      ok: false;
      code: "invalid_token" | "closed" | "invalid" | "unavailable" | "expired" | "rate_limited" | "error";
      message: string;
      fieldErrors?: Partial<Record<"status" | "attendeeCount" | "message" | "answers", string>> & { answers?: string };
    };

/**
 * Resultado de `submitGeneralRsvp` (D-40: RSVP del enlace general, sin `?guest=`, autorregistra un
 * invitado nuevo). `limit_reached` = este evento ya alcanzó su cuota de respuestas por el enlace
 * general (independiente del cupo de invitados que agrega el anfitrión).
 */
export type GeneralRsvpResult =
  | { ok: true; status: PublicRsvpStatus; attendeeCount: number | null; message: string }
  | {
      ok: false;
      code: "invalid" | "closed" | "unavailable" | "expired" | "rate_limited" | "limit_reached" | "error";
      message: string;
      fieldErrors?: Partial<Record<"name" | "status" | "attendeeCount" | "dietaryNotes", string>>;
    };
