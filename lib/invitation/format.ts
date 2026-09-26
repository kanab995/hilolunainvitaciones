/** Formato de fechas con `Intl` (sin librería de fechas; docs/ARCHITECTURE.md §4.7). */

const LOCALE = "es-MX";

function parts(iso: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: timezone, ...options }).formatToParts(new Date(iso));
}

function pick(list: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return list.find((part) => part.type === type)?.value ?? "";
}

/** Nombres con contenido (los campos vacíos del editor no se dibujan). */
export function displayNames(names: readonly string[]): string[] {
  return names.map((name) => name.trim()).filter((name) => name.length > 0);
}

/** "17 · 05 · 27" (día · mes · año de dos cifras) en la zona del evento. */
export function formatCompactDate(iso: string, timezone: string): string {
  const list = parts(iso, timezone, { day: "2-digit", month: "2-digit", year: "2-digit" });
  return [pick(list, "day"), pick(list, "month"), pick(list, "year")].join(" · ");
}

/** "lunes, 17 de mayo de 2027". */
export function formatLongDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
