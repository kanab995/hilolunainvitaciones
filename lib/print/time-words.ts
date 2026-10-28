/**
 * HORA de la versión impresa (D-47): reloj de 24 horas con cifras, "17:00 horas" / "9:30 horas". Decisión del propietario (2026-10-28):
 * sustituye a la hora con letra («a las cinco de la tarde») que se usaba antes.
 */
export interface Clock {
  hour: number;
  minute: number;
}

/** «17:00 horas» / «9:30 horas» / «0:00 horas». */
export function socialTime({ hour, minute }: Clock): string {
  return `${hour}:${String(minute).padStart(2, "0")} horas`;
}

/**
 * Lee una hora escrita a mano en el editor ("17:00 hrs", "5:00 PM", "7 p. m.", "19 h"). Sin minutos solo se acepta con una marca
 * (am/pm, h, hrs, horas) para no confundir un número cualquiera con una hora. `undefined` si no es una hora reconocible.
 */
export function parseClock(text: string): Clock | undefined {
  const match = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|hrs?\.?|horas|h)?\s*$/i.exec(text);
  if (!match) return undefined;
  const [, h, m, markRaw] = match;
  if (m === undefined && markRaw === undefined) return undefined;
  let hour = Number(h);
  const minute = m === undefined ? 0 : Number(m);
  if (minute > 59) return undefined;
  const mark = markRaw?.toLowerCase().replace(/[\s.]/g, "");
  if (mark === "am" || mark === "pm") {
    if (hour < 1 || hour > 12) return undefined;
    if (mark === "pm" && hour !== 12) hour += 12;
    if (mark === "am" && hour === 12) hour = 0;
  }
  return hour > 23 ? undefined : { hour, minute };
}

/** Hora local de un instante en la zona del evento. */
export function clockAt(iso: string, timezone: string): Clock {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const value = (type: "hour" | "minute") => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { hour: value("hour") % 24, minute: value("minute") };
}

/** La hora de una sede tal como se imprime: «17:00 horas» si se reconoce; si no, el texto del anfitrión tal cual. */
export function printableTime(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  const clock = parseClock(trimmed);
  return clock ? socialTime(clock) : trimmed;
}
