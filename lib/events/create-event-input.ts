import { isValidDate, isValidTime, zonedPartsToIso } from "@/lib/editor/datetime";
import { eventTypeConfigs, isOnboardingEventType, type OnboardingEventType } from "@/lib/events/event-types";

/**
 * VALIDACIÓN del alta de un evento (sin Zod: los validadores del editor bastan, D-28). Pura: la usan el
 * asistente (respuesta inmediata) y el servicio (autoridad; nunca se confía solo en el navegador). Solo lee
 * una LISTA BLANCA de campos: cualquier otro (`ownerId`, `status`, `slug`…) se ignora.
 */
export const CREATE_EVENT_LIMITS = { name: 30, templateSlug: 60 } as const;

export const DEFAULT_TIMEZONE = "America/Mexico_City";

/** Campos que el cliente puede enviar. */
export interface CreateEventRaw {
  templateSlug?: unknown;
  eventType?: unknown;
  name1?: unknown;
  name2?: unknown;
  date?: unknown;
  time?: unknown;
  timezone?: unknown;
}

export type CreateEventField = "templateSlug" | "eventType" | "name1" | "name2" | "date" | "time" | "timezone";

export interface CreateEventValue {
  templateSlug: string;
  eventType: OnboardingEventType;
  /** Nombres con contenido: pareja → dos; un nombre → uno. */
  names: string[];
  /** Título del evento: "Andrea & Fernando" o el nombre único. */
  title: string;
  date: string;
  time: string;
  timezone: string;
  /** Instante ISO con desfase (`Event.startsAt` = este instante). */
  startsAtIso: string;
}

export type CreateEventValidation = { ok: true; value: CreateEventValue } | { ok: false; errors: Partial<Record<CreateEventField, string>> };

/** Texto plano de una línea: sin caracteres de control, espacios colapsados, recortado. */
export function cleanName(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
}

export function isValidTimeZone(value: string): boolean {
  if (!/^(UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("es-MX", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function validateCreateEventInput(raw: CreateEventRaw): CreateEventValidation {
  const errors: Partial<Record<CreateEventField, string>> = {};

  const templateSlug = text(raw.templateSlug);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(templateSlug) || templateSlug.length > CREATE_EVENT_LIMITS.templateSlug) errors.templateSlug = "Elige una plantilla.";

  const eventType = isOnboardingEventType(raw.eventType) ? raw.eventType : undefined;
  if (!eventType) errors.eventType = "Elige el tipo de evento.";
  const config = eventType ? eventTypeConfigs[eventType] : undefined;
  const couple = config?.names === "couple";

  const name1 = cleanName(raw.name1);
  const name2 = cleanName(raw.name2);
  if (!name1) errors.name1 = couple ? "Escribe el nombre 1." : "Escribe el nombre.";
  else if (name1.length > CREATE_EVENT_LIMITS.name) errors.name1 = `Usa ${CREATE_EVENT_LIMITS.name} caracteres como máximo.`;
  if (couple) {
    if (!name2) errors.name2 = "Escribe el nombre 2.";
    else if (name2.length > CREATE_EVENT_LIMITS.name) errors.name2 = `Usa ${CREATE_EVENT_LIMITS.name} caracteres como máximo.`;
  }

  const date = text(raw.date);
  if (!isValidDate(date)) errors.date = "Elige una fecha válida.";
  const time = text(raw.time);
  if (!isValidTime(time)) errors.time = "Elige una hora válida.";
  const timezone = text(raw.timezone) || DEFAULT_TIMEZONE;
  if (!isValidTimeZone(timezone)) errors.timezone = "Elige una zona horaria válida.";

  const startsAtIso = !errors.date && !errors.time && !errors.timezone ? zonedPartsToIso(date, time, timezone) : undefined;
  if (!errors.date && !errors.time && !errors.timezone && !startsAtIso) errors.date = "Elige una fecha y hora válidas.";

  if (Object.keys(errors).length > 0 || !eventType || !startsAtIso) return { ok: false, errors };
  const names = couple ? [name1, name2] : [name1];
  return { ok: true, value: { templateSlug, eventType, names, title: names.join(" & "), date, time, timezone, startsAtIso } };
}

/** ¿La fecha y hora ya pasaron? (aviso NO bloqueante de la interfaz; la base de datos acepta eventos pasados). */
export function isInPast(startsAtIso: string, now: number): boolean {
  return Date.parse(startsAtIso) < now;
}
