import { displayNames } from "@/lib/invitation/format";
import { formatPlace, placeFromAddress } from "@/lib/print/place";
import { clockAt, printableTime, socialTime } from "@/lib/print/time-words";
import type { Invitation } from "@/types/invitation";
import type { EventCategoryId } from "@/types/marketing";

/**
 * DATOS DE LA VERSIÓN IMPRESA (D-47): lo que necesita el diseño, sacado de la invitación PUBLICADA (nunca del borrador). Puro: el
 * servicio decide de dónde viene la invitación y si hay URL pública para el QR.
 */
export interface PrintVenue {
  name: string;
  addressLines: readonly string[];
  /** Hora ya escrita para imprimir («a las cinco de la tarde»). */
  time?: string;
}

export interface PrintData {
  /** Uno o dos nombres, tal como se escribieron. */
  names: readonly string[];
  /** Iniciales del monograma (una o dos letras mayúsculas). */
  initials: readonly string[];
  /** «LUNES 17 DE MAYO DE 2027». */
  dateLine: string;
  /** «a las cinco de la tarde» (hora del evento). */
  timeLine: string;
  ceremony?: PrintVenue & { city?: string };
  reception?: PrintVenue;
  dressCode?: { style: string; description?: string; palette: readonly string[] };
  qr?: { url: string; label: string };
}

/** Por ahora el diseño aprobado es de boda (sus textos hablan de «matrimonio»). Otros tipos de evento esperan su propio texto. */
export const PRINT_EVENT_TYPES: readonly EventCategoryId[] = ["wedding"];
export const isPrintableEventType = (type: EventCategoryId): boolean => PRINT_EVENT_TYPES.includes(type);

const MARKS = /\p{M}/gu;

/** Primera letra de un nombre, sin acentos (salvo la Ñ) y en mayúscula: «Ángela» → «A». */
export function initialOf(name: string): string | undefined {
  const letter = [...name.trim()].find((char) => /\p{L}/u.test(char));
  if (!letter) return undefined;
  const upper = letter.toLocaleUpperCase("es-MX");
  return upper === "Ñ" ? upper : upper.normalize("NFD").replace(MARKS, "");
}

export function initialsFromNames(names: readonly string[]): string[] {
  return displayNames(names).slice(0, 2).flatMap((name) => initialOf(name) ?? []);
}

/**
 * Iniciales escritas por el anfitrión: una o dos letras, con o sin separadores («AF», «A & F», «a.f»). `undefined` si no son válidas
 * (el monograma solo dibuja letras).
 */
export function parseInitials(input: string): string[] | undefined {
  const letters = [...input.replace(/[\s&.,·+\-/]/g, "")];
  if (letters.length < 1 || letters.length > 2 || !letters.every((char) => /\p{L}/u.test(char))) return undefined;
  return letters.map((char) => initialOf(char) ?? char);
}

const clean = (lines: readonly string[]) => lines.map((line) => line.trim()).filter(Boolean);

function dateLineOf(iso: string, timezone: string): string {
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-MX", { timeZone: timezone, ...options }).format(new Date(iso));
  return `${format({ weekday: "long" })} ${format({ day: "numeric" })} de ${format({ month: "long" })} de ${format({ year: "numeric" })}`.toLocaleUpperCase("es-MX");
}

export interface BuildPrintDataOptions {
  /** URL pública vigente (invitación publicada y con acceso activo); sin ella no hay QR. */
  publicUrl?: string;
  initials?: readonly string[];
  /**
   * Ciudad y estado que confirmó el anfitrión (`PrintOptions.place`). `undefined` = la que se lee de la dirección; `""` = no imprimir
   * la línea.
   */
  place?: string;
}

/** Ciudad y estado que se leen de la dirección de la ceremonia (lo que la página propone por defecto). */
export function detectedPlace(invitation: Invitation): string | undefined {
  const places = invitation.locations.filter((location) => location.name.trim());
  const ceremony = places.find((place) => place.kind === "ceremony") ?? places[0];
  return ceremony ? formatPlace(placeFromAddress(ceremony.addressLines)) : undefined;
}

export function buildPrintData(invitation: Invitation, options: BuildPrintDataOptions = {}): PrintData {
  const visible = (type: string) => invitation.sections.find((section) => section.type === type)?.isVisible !== false;
  const places = invitation.locations.filter((location) => location.name.trim());
  const ceremonyPlace = places.find((place) => place.kind === "ceremony") ?? places[0];
  const receptionPlace = places.find((place) => place.kind === "reception" && place !== ceremonyPlace);
  const eventClock = clockAt(invitation.event.startsAt, invitation.event.timezone);

  const ceremony = ceremonyPlace
    ? (() => {
        const addressLines = clean(ceremonyPlace.addressLines);
        const city = options.place !== undefined ? options.place.trim() || undefined : formatPlace(placeFromAddress(addressLines));
        return {
          name: ceremonyPlace.name.trim(),
          addressLines,
          time: printableTime(ceremonyPlace.time) ?? socialTime(eventClock),
          // Ciudad y estado del frente: los que confirmó el anfitrión o los que se leen con seguridad de la dirección (`lib/print/place.ts`).
          ...(city ? { city } : {}),
        };
      })()
    : undefined;
  const reception = receptionPlace ? { name: receptionPlace.name.trim(), addressLines: clean(receptionPlace.addressLines), ...(printableTime(receptionPlace.time) ? { time: printableTime(receptionPlace.time) } : {}) } : undefined;
  const dress = invitation.dressCode;
  const dressCode =
    dress && visible("dressCode") && dress.style.trim()
      ? { style: dress.style.trim(), ...(dress.description.trim() ? { description: dress.description.trim() } : {}), palette: dress.palette.map((swatch) => swatch.hex).filter((hex) => /^#[0-9a-f]{6}$/i.test(hex)).slice(0, 6) }
      : undefined;

  const names = displayNames(invitation.names).slice(0, 2);
  return {
    names,
    initials: options.initials && options.initials.length > 0 ? options.initials : initialsFromNames(names),
    dateLine: dateLineOf(invitation.event.startsAt, invitation.event.timezone),
    timeLine: socialTime(eventClock),
    ...(ceremony ? { ceremony } : {}),
    ...(reception ? { reception } : {}),
    ...(dressCode ? { dressCode } : {}),
    ...(options.publicUrl ? { qr: { url: options.publicUrl, label: options.publicUrl.replace(/^https?:\/\//, "") } } : {}),
  };
}
