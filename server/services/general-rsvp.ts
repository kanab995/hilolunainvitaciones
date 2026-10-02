import type { RsvpStatus } from "@prisma/client";
import { getRsvpAvailability } from "@/lib/invitation/rsvp";
import { GUEST_LIMITS } from "@/lib/guests/limits";
import { rateLimitMessage } from "@/server/security/rate-limit";
import { sanitizePlainText, RSVP_LIMITS } from "@/server/services/public-rsvp";
import type { RSVPSettings } from "@/types/invitation";
import type { GeneralRsvpResult } from "@/types/public-rsvp";
import { logger } from "@/server/observability/logger";

/**
 * RSVP GENERAL (D-40): confirmación por el enlace público de una invitación REAL y PUBLICADA, SIN
 * `?guest=` (la persona nunca fue dada de alta por el anfitrión). A diferencia del RSVP personalizado
 * (`public-rsvp.ts`, identifica a un `Guest` ya existente por token), aquí se AUTORREGISTRA un `Guest`
 * nuevo (`source: "PUBLIC_RSVP"`) con cada envío: no hay sesión, cuenta ni token previo que lo identifique.
 * NUNCA se ejecuta en una demo (`/i/demo-*`): `resolveTarget` solo encuentra invitaciones PUBLICADAS
 * reales (`getPublicInvitationRecord`), así que una demo simplemente no resuelve destino.
 *
 * Mismas reglas de "nada del cliente es verdad" que el RSVP personalizado: el plazo, el máximo de
 * acompañantes y si se piden restricciones alimentarias salen de `RSVPSettings` en el SERVIDOR.
 */
export interface GeneralRsvpTarget {
  eventId: string;
  rsvp: RSVPSettings;
}

export interface GeneralRsvpValue {
  name: string;
  status: Extract<RsvpStatus, "ATTENDING" | "DECLINED" | "MAYBE">;
  attendeeCount: number | null;
  dietaryNotes: string | null;
}

export interface GeneralRsvpRawInput {
  name: unknown;
  status: unknown;
  companions: unknown;
  dietaryNotes: unknown;
}

type FieldErrors = NonNullable<Extract<GeneralRsvpResult, { ok: false }>["fieldErrors"]>;
export type GeneralRsvpValidation = { ok: true; value: GeneralRsvpValue } | { ok: false; code: "closed" | "invalid"; fieldErrors: FieldErrors };

const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

export function validateGeneralRsvp(target: GeneralRsvpTarget, raw: GeneralRsvpRawInput, nowMs: number): GeneralRsvpValidation {
  const availability = getRsvpAvailability(target.rsvp, nowMs);
  if (availability !== "open") return { ok: false, code: "closed", fieldErrors: {} };

  const errors: FieldErrors = {};

  const name = sanitizePlainText(text(raw.name)).slice(0, GUEST_LIMITS.name);
  if (name.length < 2) errors.name = "Escribe tu nombre.";

  const statusText = text(raw.status);
  const allowed = target.rsvp.allowMaybe ? ["ATTENDING", "DECLINED", "MAYBE"] : ["ATTENDING", "DECLINED"];
  if (!allowed.includes(statusText)) errors.status = "Elige una opción.";
  const status = statusText as GeneralRsvpValue["status"];

  let attendeeCount: number | null = null;
  if (!errors.status) {
    if (status === "DECLINED") attendeeCount = 0;
    else if (status === "ATTENDING") {
      const max = 1 + target.rsvp.maxCompanions;
      const provided = text(raw.companions).trim();
      const companions = provided === "" ? 0 : Number(provided);
      if (!Number.isInteger(companions) || companions < 0 || companions > target.rsvp.maxCompanions) {
        errors.attendeeCount = target.rsvp.maxCompanions === 0 ? "Solo puedes confirmar tu asistencia." : `Puedes añadir hasta ${target.rsvp.maxCompanions} acompañantes.`;
      } else attendeeCount = Math.min(1 + companions, max);
    }
  }

  const dietaryNotes = target.rsvp.askDietaryNotes ? sanitizePlainText(text(raw.dietaryNotes)).slice(0, RSVP_LIMITS.message) || null : null;

  if (Object.keys(errors).length > 0) return { ok: false, code: "invalid", fieldErrors: errors };
  return { ok: true, value: { name, status, attendeeCount, dietaryNotes } };
}

/** Lee el `FormData`: solo `slug`, `name`, `status`, `companions` y `dietaryNotes` (cualquier otro campo se ignora). */
export function readGeneralRsvpFormData(formData: FormData): { slug: string; raw: GeneralRsvpRawInput } {
  const field = (name: string): unknown => {
    const value = formData.get(name);
    return typeof value === "string" ? value.slice(0, 2000) : value;
  };
  return { slug: text(field("slug")), raw: { name: field("name"), status: field("status"), companions: field("companions"), dietaryNotes: field("dietaryNotes") } };
}

export interface GeneralRsvpSaveResult {
  guestId: string;
}

export interface GeneralRsvpDeps {
  /** `"expired"`: el acceso del evento terminó. `null`: no hay invitación PUBLICADA con ese slug (incluye cualquier `demo-*`: nunca se persiste una demo). */
  resolveTarget: (slug: string) => Promise<GeneralRsvpTarget | "expired" | null>;
  isRateLimited?: (input: { slug: string }) => Promise<boolean>;
  /** `"limit_reached"`: este evento ya alcanzó su cuota de respuestas por el enlace general (D-40, plan del evento). */
  checkLimit: (eventId: string) => Promise<"ok" | "limit_reached">;
  /** Crea un `Guest` nuevo (`source: "PUBLIC_RSVP"`) y su `Rsvp`, en una transacción. */
  save: (target: GeneralRsvpTarget, value: GeneralRsvpValue, submittedAt: Date) => Promise<GeneralRsvpSaveResult>;
  now: () => number;
  isUnavailable: (error: unknown) => boolean;
  /** Side effect opcional (notificar al anfitrión); nunca puede hacer fallar el RSVP (D-36, mismo contrato que el personalizado). */
  onSaved?: (input: { target: GeneralRsvpTarget; value: GeneralRsvpValue; guestId: string }) => void;
}

const messages = {
  invalidSlug: "No pudimos identificar esta invitación.",
  closed: "El plazo para confirmar ya terminó.",
  invalid: "Revisa los datos marcados.",
  unavailable: "Por ahora no podemos guardar tu respuesta. Inténtalo más tarde.",
  error: "No pudimos guardar tu respuesta. Inténtalo de nuevo en unos instantes.",
  expired: "Esta invitación ya no está disponible.",
  limitReached: "Por ahora no se pueden recibir más confirmaciones por este enlace. Avísale directamente al anfitrión.",
  rateLimited: rateLimitMessage,
} as const;

const fail = (code: Extract<GeneralRsvpResult, { ok: false }>["code"], message: string, fieldErrors?: FieldErrors): GeneralRsvpResult => ({ ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) });

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SLUG_MAX = 120;

/**
 * Caso de uso: 1) resolver la invitación PUBLICADA por su slug 2) limitar tasa 3) validar 4) cuota del
 * plan 5) autorregistrar un invitado nuevo + su respuesta, en una transacción 6) resultado seguro.
 * No registra nombres, mensajes ni restricciones alimentarias en el log.
 */
export async function submitGeneralRsvpFor(input: { slug: string; raw: GeneralRsvpRawInput }, deps: GeneralRsvpDeps): Promise<GeneralRsvpResult> {
  const { slug, raw } = input;
  if (!SLUG.test(slug) || slug.length > SLUG_MAX) return fail("invalid", messages.invalidSlug);

  try {
    if (deps.isRateLimited && (await deps.isRateLimited({ slug }))) return fail("rate_limited", messages.rateLimited);
    const target = await deps.resolveTarget(slug);
    if (target === "expired") return fail("expired", messages.expired);
    if (!target) return fail("invalid", messages.invalidSlug);

    const now = deps.now();
    const validation = validateGeneralRsvp(target, raw, now);
    if (!validation.ok) return validation.code === "closed" ? fail("closed", messages.closed) : fail("invalid", messages.invalid, validation.fieldErrors);

    // Cuota del plan (D-40) ANTES de escribir: con el cupo lleno no se crea nada.
    if ((await deps.checkLimit(target.eventId)) === "limit_reached") return fail("limit_reached", messages.limitReached);

    const { guestId } = await deps.save(target, validation.value, new Date(now));
    try {
      deps.onSaved?.({ target, value: validation.value, guestId });
    } catch (error) {
      logger.error("general_rsvp.on_saved_failed", error);
    }
    const { status, attendeeCount } = validation.value;
    return { ok: true, status, attendeeCount, message: status === "ATTENDING" ? "Tu asistencia ha sido confirmada." : status === "DECLINED" ? "Gracias por avisarnos." : "Gracias por avisarnos." };
  } catch (error) {
    if (deps.isUnavailable(error)) return fail("unavailable", messages.unavailable);
    logger.error("general_rsvp.save_failed", error);
    return fail("error", messages.error);
  }
}
