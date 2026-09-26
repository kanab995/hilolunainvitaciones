import { isoToZonedParts } from "@/lib/editor/datetime";

/**
 * GENERADOR DE `.ics` (RFC 5545), propio y sin dependencias (D-30). Función pura y determinista: no llama a ningún
 * servicio, no lee la hora del sistema (el `DTSTAMP` llega por parámetro) y no conoce invitados.
 *
 *  - Hora: `DTSTART;TZID=<zona IANA del evento>` con la HORA LOCAL de esa zona y un `VTIMEZONE` con el desfase REAL en
 *    ese instante (calculado con `Intl`, por tanto correcto con horario de verano; nada de desfases escritos a mano).
 *    Representa el momento exacto del evento en cualquier calendario.
 *  - Sin hora de fin: NO se inventa (`Event.endsAt` no existe hoy): solo `DTSTART`, que RFC 5545 permite.
 *  - `UID` estable por invitación y `SEQUENCE` = versión publicada: importar de nuevo tras republicar ACTUALIZA el evento.
 *  - Texto escapado (`\\`, `;`, `,`, saltos de línea) y líneas plegadas a 75 octetos con fin de línea CRLF.
 */
export interface CalendarEventInput {
  /** Identificador estable, p. ej. `slug@dominio`. */
  uid: string;
  title: string;
  /** ISO 8601 con desfase (`Event.startsAt` PUBLICADO). */
  startsAtIso: string;
  /** Zona IANA del evento (`Event.timezone`). */
  timezone: string;
  location?: string;
  /** URL pública GENERAL de la invitación (nunca la personalizada de un invitado). */
  url: string;
  /** Momento de la publicación (DTSTAMP determinista). */
  stamp: Date;
  /** Versión publicada (1, 2, 3…): sube `SEQUENCE` para que los calendarios actualicen el evento. */
  version?: number;
  productName?: string;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** Escapa un valor de tipo TEXT (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Pliega una línea a 75 octetos UTF-8 (sin partir caracteres); las continuaciones empiezan con un espacio. */
export function foldIcsLine(line: string): string[] {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return [line];
  const lines: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      lines.push(lines.length === 0 ? current : ` ${current}`);
      current = "";
      bytes = 0;
      limit = 74; // el espacio inicial de la continuación cuenta
    }
    current += char;
    bytes += size;
  }
  lines.push(lines.length === 0 ? current : ` ${current}`);
  return lines;
}

const utcStamp = (date: Date) => `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/** `+HHMM` / `-HHMM` a partir de minutos de desfase. */
const formatOffset = (minutes: number) => `${minutes < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(minutes) / 60))}${pad(Math.abs(minutes) % 60)}`;

/** Hora local del evento (`YYYYMMDDTHHMMSS`) y su desfase real en ese instante, o `undefined` si los datos no son válidos. */
export function localEventTime(startsAtIso: string, timezone: string): { local: string; offsetMinutes: number } | undefined {
  const instant = Date.parse(startsAtIso);
  if (Number.isNaN(instant)) return undefined;
  let parts: { date: string; time: string } | undefined;
  try {
    parts = isoToZonedParts(startsAtIso, timezone);
  } catch {
    return undefined;
  }
  if (!parts) return undefined;
  const [year, month, day] = parts.date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = parts.time.split(":").map(Number) as [number, number];
  const offsetMinutes = Math.round((Date.UTC(year, month - 1, day, hour, minute) - Math.floor(instant / 60_000) * 60_000) / 60_000);
  return { local: `${pad(year, 4)}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`, offsetMinutes };
}

export function buildIcs(input: CalendarEventInput): string | undefined {
  const time = localEventTime(input.startsAtIso, input.timezone);
  if (!time) return undefined;
  const offset = formatOffset(time.offsetMinutes);
  const description = `Consulta todos los detalles de la invitación:\n${input.url}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${input.productName ?? "Invitaciones"}//Invitaciones digitales//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${input.timezone}`,
    "BEGIN:VTIMEZONE",
    `TZID:${input.timezone}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    `TZNAME:${input.timezone}`,
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${utcStamp(input.stamp)}`,
    `SEQUENCE:${Math.max(0, (input.version ?? 1) - 1)}`,
    `DTSTART;TZID=${input.timezone}:${time.local}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    ...(input.location ? [`LOCATION:${escapeIcsText(input.location)}`] : []),
    `URL:${input.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}
