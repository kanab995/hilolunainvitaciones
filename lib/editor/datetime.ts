/**
 * Fecha y hora del evento en su zona horaria (docs/ARCHITECTURE.md §4.7). `event.startsAt` es el
 * instante canónico (ISO 8601 con desfase); los campos del editor son "fecha" y "hora" locales de la
 * zona del evento. Sin librería de fechas: solo `Intl`.
 */

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** ¿"YYYY-MM-DD" es una fecha real del calendario? */
export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** ¿"HH:mm" (24 h) es una hora válida? */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function zonedFields(ms: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Desfase (minutos) de la zona en un instante dado. */
function offsetMinutes(ms: number, timezone: string): number {
  const f = zonedFields(ms, timezone);
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Instante ISO → `{ date: "YYYY-MM-DD", time: "HH:mm" }` en la zona del evento. `undefined` si no es válido. */
export function isoToZonedParts(iso: string, timezone: string): { date: string; time: string } | undefined {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  const f = zonedFields(ms, timezone);
  return { date: `${pad(f.year, 4)}-${pad(f.month)}-${pad(f.day)}`, time: `${pad(f.hour)}:${pad(f.minute)}` };
}

/**
 * Fecha y hora locales de la zona → ISO 8601 con desfase ("2027-05-17T17:00:00-06:00").
 * `undefined` si la fecha o la hora no son válidas.
 */
export function zonedPartsToIso(date: string, time: string, timezone: string): string | undefined {
  if (!isValidDate(date) || !isValidTime(time)) return undefined;
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  let offset = offsetMinutes(naive, timezone);
  let instant = naive - offset * 60000;
  const corrected = offsetMinutes(instant, timezone);
  if (corrected !== offset) {
    offset = corrected;
    instant = naive - offset * 60000;
  }

  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
