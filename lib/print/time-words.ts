/**
 * HORA «SOCIAL» de la versión impresa (D-47): "17:00" → "a las cinco de la tarde". En punto, «y cuarto» y «y media» se escriben con
 * letra; cualquier otro minuto vuelve a la cifra ("a las 17:20 horas"), porque con letra se lee peor en una invitación.
 * Periodos (México): 0 h «de la noche» (medianoche), 1–5 «de la madrugada», 6–11 «de la mañana», 12 «del día», 13–18 «de la tarde»,
 * 19–23 «de la noche».
 */
export interface Clock {
  hour: number;
  minute: number;
}

const HOURS = ["doce", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once"] as const;
const MINUTE_WORDS: Readonly<Record<number, string>> = { 0: "", 15: " y cuarto", 30: " y media" };

export function dayPeriod(hour: number): string {
  if (hour === 0) return "de la noche";
  if (hour < 6) return "de la madrugada";
  if (hour < 12) return "de la mañana";
  if (hour === 12) return "del día";
  if (hour < 19) return "de la tarde";
  return "de la noche";
}

/** «a las cinco de la tarde» / «a la una y media de la tarde» / «a las 17:20 horas». */
export function socialTime({ hour, minute }: Clock): string {
  const words = MINUTE_WORDS[minute];
  if (words === undefined) return `a las ${hour}:${String(minute).padStart(2, "0")} horas`;
  const article = hour % 12 === 1 ? "a la" : "a las";
  return `${article} ${HOURS[hour % 12]}${words} ${dayPeriod(hour)}`;
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

/** La hora de una sede tal como se imprime: con letra si se reconoce; si no, el texto del anfitrión tal cual. */
export function printableTime(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  const clock = parseClock(trimmed);
  return clock ? socialTime(clock) : trimmed;
}
