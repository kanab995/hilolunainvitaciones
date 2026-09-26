import { getCountdown } from "@/lib/invitation/countdown";
import type { EventActivity } from "@/types/dashboard";

const LOCALE = "es-MX";

/** "17 Mayo 2027" (mes con mayúscula inicial, como el mockup 05), en la zona horaria del evento. */
export function formatEventDate(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat(LOCALE, { timeZone: timezone, day: "numeric", month: "long", year: "numeric" }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const month = get("month");
  return `${get("day")} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${get("year")}`;
}

/**
 * "Faltan 235 días". Se calcula SIEMPRE desde `event.startsAt` con el mismo helper que la cuenta
 * regresiva de la invitación (`getCountdown`): no hay otra fuente de fecha ni cifras a mano.
 */
export function formatDaysLeft(startsAt: string, now: number): { days: number; label: string } {
  const parts = getCountdown(startsAt, now);
  if (parts.isPast) return { days: 0, label: "El evento ya pasó" };
  if (parts.days === 0) return { days: 0, label: "Falta menos de un día" };
  return { days: parts.days, label: parts.days === 1 ? "Falta 1 día" : `Faltan ${parts.days} días` };
}

/** Tiempo relativo: `long` = "Hace 2 horas", `short` = "2 h" (las dos formas del mockup 05). */
export function formatRelativeTime(iso: string, now: number): { long: string; short: string } {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return { long: minutes <= 1 ? "Hace un momento" : `Hace ${minutes} minutos`, short: `${Math.max(1, minutes)} min` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { long: hours === 1 ? "Hace 1 hora" : `Hace ${hours} horas`, short: `${hours} h` };
  const days = Math.floor(hours / 24);
  return { long: days === 1 ? "Hace 1 día" : `Hace ${days} días`, short: `${days} d` };
}

/** Frase que acompaña al nombre ("confirmó asistencia"), derivada del tipo y los metadatos. */
export function describeActivity(activity: Pick<EventActivity, "type" | "metadata">): string {
  switch (activity.type) {
    case "rsvp_confirmed": {
      const guests = activity.metadata?.guests;
      return guests && guests > 1 ? `confirmó ${guests} invitados` : "confirmó asistencia";
    }
    case "rsvp_declined":
      return "no asistirá";
    case "invitation_viewed":
      return "está revisando su invitación";
  }
}
