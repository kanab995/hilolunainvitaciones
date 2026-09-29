import type { RsvpStatus } from "@prisma/client";
import { getRsvpAvailability } from "@/lib/invitation/rsvp";
import { rateLimitMessage } from "@/server/security/rate-limit";
import { INVITE_TOKEN_PATTERN } from "@/server/services/invite-token";
import type { PublicQuestionType, PublicRsvpResult } from "@/types/public-rsvp";
import type { RSVPSettings } from "@/types/invitation";
import { logger } from "@/server/observability/logger";

/**
 * RSVP PÚBLICO — reglas y casos de uso (sin acceso a datos: las dependencias se inyectan). Se ejecutan
 * SIEMPRE en el servidor; nada de lo que envía el navegador se toma como verdad (el máximo de asistentes,
 * las preguntas, el plazo y el estado permitido salen de la BD).
 *
 * SEMÁNTICA de `attendeeCount` — incluye al invitado principal:
 *   maxCompanions = 2  →  attendeeCount máximo = 3 (él más dos acompañantes).
 *   ATTENDING → entero de 1 a 1 + maxCompanions (con maxCompanions = 0 siempre 1) ·
 *   DECLINED → 0 (se descarta cualquier valor previo) · MAYBE → null (hasta la confirmación final).
 */
export const RSVP_LIMITS = { message: 500, answer: 500, maxAnswerKeys: 50, slug: 120 } as const;

export interface RsvpTargetQuestion {
  id: string;
  label: string;
  type: PublicQuestionType;
  required: boolean;
  options: readonly string[];
}

/** Lo que el servidor sabe (y el cliente no decide) sobre a quién y a qué responde. */
export interface RsvpTarget {
  eventId: string;
  guestId: string;
  maxCompanions: number;
  rsvp: RSVPSettings;
  questions: readonly RsvpTargetQuestion[];
}

export interface RsvpValue {
  status: Extract<RsvpStatus, "ATTENDING" | "DECLINED" | "MAYBE">;
  attendeeCount: number | null;
  message: string | null;
  answers: { questionId: string; value: string }[];
}

export interface RsvpRawInput {
  status: unknown;
  attendeeCount: unknown;
  message: unknown;
  answers: Record<string, unknown>;
}

type FieldErrors = NonNullable<Extract<PublicRsvpResult, { ok: false }>["fieldErrors"]>;
export type RsvpValidation = { ok: true; value: RsvpValue } | { ok: false; code: "closed" | "invalid"; fieldErrors: FieldErrors };

const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

/** Texto plano: sin etiquetas HTML ni caracteres de control (React ya escapa al mostrarlo). */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}

export function validatePublicRsvp(target: RsvpTarget, raw: RsvpRawInput, nowMs: number): RsvpValidation {
  const availability = getRsvpAvailability(target.rsvp, nowMs);
  if (availability !== "open") return { ok: false, code: "closed", fieldErrors: {} };

  const errors: FieldErrors = {};

  const statusText = text(raw.status);
  const allowed = target.rsvp.allowMaybe ? ["ATTENDING", "DECLINED", "MAYBE"] : ["ATTENDING", "DECLINED"];
  if (!allowed.includes(statusText)) errors.status = "Elige una opción.";
  const status = statusText as RsvpValue["status"];

  let attendeeCount: number | null = null;
  if (!errors.status) {
    if (status === "DECLINED") attendeeCount = 0;
    else if (status === "ATTENDING") {
      const max = 1 + target.maxCompanions;
      const provided = text(raw.attendeeCount).trim();
      if (!provided) attendeeCount = 1;
      else {
        const parsed = Number(provided);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) errors.attendeeCount = max === 1 ? "Solo puedes confirmar tu asistencia." : `Indica de 1 a ${max} personas.`;
        else attendeeCount = parsed;
      }
    }
  }

  const message = sanitizePlainText(text(raw.message));
  if (message.length > RSVP_LIMITS.message) errors.message = `El mensaje no puede superar ${RSVP_LIMITS.message} caracteres.`;

  // Respuestas: solo a preguntas de ESTE evento (`target.questions` viene de la BD).
  const answers: RsvpValue["answers"] = [];
  const known = new Map(target.questions.map((question) => [question.id, question]));
  const keys = Object.keys(raw.answers);
  if (keys.length > RSVP_LIMITS.maxAnswerKeys || keys.some((key) => !known.has(key))) errors.answers = "Hay respuestas que no corresponden a esta invitación.";
  else {
    for (const question of target.questions) {
      const value = sanitizePlainText(text(raw.answers[question.id]));
      if (!value) {
        if (question.required && status === "ATTENDING") errors.answers = "Responde las preguntas obligatorias.";
        continue;
      }
      const valid =
        question.type === "BOOLEAN" ? value === "yes" || value === "no" : question.type === "CHOICE" ? question.options.includes(value) : value.length <= RSVP_LIMITS.answer;
      if (!valid) errors.answers = "Revisa tus respuestas.";
      else answers.push({ questionId: question.id, value });
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, code: "invalid", fieldErrors: errors };
  return { ok: true, value: { status, attendeeCount, message: message || null, answers } };
}

/** Tope de campos y de longitud por valor al LEER el formulario: un envío gigante o con miles de claves se recorta antes de validarlo. */
export const RSVP_FORM_LIMITS = { maxEntries: 200, maxValueLength: 2000 } as const;

/** Lee el `FormData` de la acción: solo `slug`, `guest`, `status`, `attendeeCount`, `message` y `answer:<id>` (cualquier otro campo se ignora; los valores excesivos se recortan y la validación los rechaza). */
export function readPublicRsvpFormData(formData: FormData): { slug: string; token: string; raw: RsvpRawInput } {
  const answers: Record<string, unknown> = {};
  let seen = 0;
  for (const [key, value] of formData.entries()) {
    if ((seen += 1) > RSVP_FORM_LIMITS.maxEntries) break;
    if (key.startsWith("answer:") && typeof value === "string") answers[key.slice("answer:".length).slice(0, 64)] = value.slice(0, RSVP_FORM_LIMITS.maxValueLength);
  }
  const field = (name: string): unknown => {
    const value = formData.get(name);
    return typeof value === "string" ? value.slice(0, RSVP_FORM_LIMITS.maxValueLength) : value;
  };
  return { slug: text(field("slug")), token: text(field("guest")), raw: { status: field("status"), attendeeCount: field("attendeeCount"), message: field("message"), answers } };
}

/** Resultado de guardar: `changed` = el estado o el número de asistentes son distintos de lo que había antes (D-36: solo entonces se avisa al anfitrión). */
export interface RsvpSaveResult {
  ok: boolean;
  changed: boolean;
}

export interface PublicRsvpDeps {
  /** `"expired"`: el acceso del evento terminó (D-34): no se acepta el RSVP. */
  resolveTarget: (slug: string, token: string) => Promise<RsvpTarget | "expired" | null>;
  /** Límite de tasa (opcional en las pruebas). `true` = rechazar el intento. */
  isRateLimited?: (input: { slug: string; token: string }) => Promise<boolean>;
  save: (target: RsvpTarget, value: RsvpValue, submittedAt: Date) => Promise<RsvpSaveResult>;
  now: () => number;
  /** Error de infraestructura "sin base de datos" (se distingue de un fallo genérico). */
  isUnavailable: (error: unknown) => boolean;
  /**
   * RSVP guardado con éxito (D-36): side effect opcional (notificar al anfitrión). Se invoca DESPUÉS de guardar y NUNCA
   * puede hacer fallar el RSVP ni retrasar la respuesta: quien lo implementa (`server/services/public-rsvp-runtime.ts`)
   * programa el envío tras la respuesta (`after()`) y nunca deja que un error suyo se propague hasta aquí.
   */
  onSaved?: (input: { target: RsvpTarget; value: RsvpValue; changed: boolean }) => void;
}

const messages = {
  invalidToken: "No pudimos identificar esta invitación personalizada.",
  closed: "El plazo para confirmar ya terminó.",
  invalid: "Revisa los datos marcados.",
  unavailable: "Por ahora no podemos guardar tu respuesta. Inténtalo más tarde.",
  error: "No pudimos guardar tu respuesta. Inténtalo de nuevo en unos instantes.",
  expired: "Esta invitación ya no está disponible.",
  rateLimited: rateLimitMessage,
} as const;

const fail = (code: Extract<PublicRsvpResult, { ok: false }>["code"], message: string, fieldErrors?: FieldErrors): PublicRsvpResult => ({ ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) });

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Caso de uso: 1) resolver invitación + invitado (slug + token + mismo evento) 2) validar 3) guardar en una
 * transacción 4) resultado seguro. Un token inválido, desconocido o de otro evento responde IGUAL.
 * No registra tokens, mensajes, respuestas, emails ni teléfonos.
 */
export async function submitPublicRsvpFor(input: { slug: string; token: string; raw: RsvpRawInput }, deps: PublicRsvpDeps): Promise<PublicRsvpResult> {
  const { slug, token, raw } = input;
  if (!SLUG.test(slug) || slug.length > RSVP_LIMITS.slug || !INVITE_TOKEN_PATTERN.test(token)) return fail("invalid_token", messages.invalidToken);

  try {
    // Protección de abuso ANTES de tocar la base de datos.
    if (deps.isRateLimited && (await deps.isRateLimited({ slug, token }))) return fail("rate_limited", messages.rateLimited);
    const target = await deps.resolveTarget(slug, token);
    if (target === "expired") return fail("expired", messages.expired);
    if (!target) return fail("invalid_token", messages.invalidToken);

    const now = deps.now();
    const validation = validatePublicRsvp(target, raw, now);
    if (!validation.ok) return validation.code === "closed" ? fail("closed", messages.closed) : fail("invalid", messages.invalid, validation.fieldErrors);

    const saved = await deps.save(target, validation.value, new Date(now));
    if (!saved.ok) return fail("invalid_token", messages.invalidToken);
    try {
      deps.onSaved?.({ target, value: validation.value, changed: saved.changed });
    } catch (error) {
      // El RSVP ya se guardó: un side effect (p. ej. notificar al anfitrión) nunca debe hacerlo fallar.
      logger.error("rsvp.on_saved_failed", error);
    }
    const { status, attendeeCount } = validation.value;
    return { ok: true, status, attendeeCount, message: status === "ATTENDING" ? "Tu asistencia ha sido confirmada." : status === "DECLINED" ? "Gracias por avisarnos." : "Gracias por avisarnos. Puedes cambiar tu respuesta cuando quieras." };
  } catch (error) {
    if (deps.isUnavailable(error)) return fail("unavailable", messages.unavailable);
    logger.error("rsvp.save_failed", error);
    return fail("error", messages.error);
  }
}
