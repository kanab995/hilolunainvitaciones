import { isValidDate, isValidTime } from "@/lib/editor/datetime";
import type { Invitation } from "@/types/invitation";

/**
 * Validaciones LIGERAS del editor (sin Zod, que aún no está aprobado): campos requeridos,
 * longitudes máximas, URL válida, fecha y hora válidas. Cada validador devuelve el mensaje de error
 * (es-MX) o `undefined`. `validateInvitation` reúne los errores del borrador por ruta
 * (`names.0`, `locations.<id>.mapUrl`…); la interfaz los muestra junto a cada campo y el
 * autoguardado no guarda mientras haya alguno.
 */

export type FieldError = string | undefined;
export type ValidationErrors = Readonly<Record<string, string>>;

export const LIMITS = {
  eyebrow: 50,
  name: 30,
  tagline: 60,
  altText: 120,
  sectionTitle: 60,
  sectionEyebrow: 40,
  sectionSubtitle: 80,
  storyText: 1200,
  locationName: 80,
  address: 200,
  locationTime: 20,
  timelineLabel: 40,
  giftName: 30,
  giftMessage: 200,
  rsvpMessage: 200,
  rsvpCta: 30,
  musicTitle: 60,
  musicArtist: 60,
  closing: 120,
  dressStyle: 60,
  dressDescription: 200,
} as const;

export const required = (value: string, label: string): FieldError => (value.trim().length === 0 ? `${label} es obligatorio.` : undefined);

export const maxLength = (value: string, max: number, label: string): FieldError =>
  value.length > max ? `${label} admite hasta ${max} caracteres.` : undefined;

/** URL absoluta http(s). Vacía es válida (campo opcional) salvo que se pida obligatoria. */
export function url(value: string, label: string, options: { required?: boolean; httpsOnly?: boolean } = {}): FieldError {
  const text = value.trim();
  if (text === "") return options.required ? `${label} es obligatorio.` : undefined;
  try {
    const parsed = new URL(text);
    const allowed = options.httpsOnly ? ["https:"] : ["http:", "https:"];
    if (!allowed.includes(parsed.protocol)) {
      return options.httpsOnly ? `${label} debe empezar con https://.` : `${label} debe empezar con http:// o https://.`;
    }
    return undefined;
  } catch {
    return `${label} no es una dirección válida (ejemplo: https://ejemplo.com).`;
  }
}

export const time = (value: string): FieldError => (isValidTime(value) ? undefined : "Elige una hora válida (HH:mm).");
export const date = (value: string): FieldError => (isValidDate(value) ? undefined : "Elige una fecha válida.");

/** Primer error de una lista de validaciones (o `undefined`). */
export const first = (...checks: readonly FieldError[]): FieldError => checks.find((check) => check !== undefined);

export function validateInvitation(invitation: Invitation): ValidationErrors {
  const errors: Record<string, string> = {};
  const set = (path: string, error: FieldError) => {
    if (error) errors[path] = error;
  };
  // El texto alternativo puede quedar vacío (imagen decorativa); solo se limita su longitud.
  const altCheck = (alt: string) => maxLength(alt, LIMITS.altText, "El texto alternativo");

  set("names.0", first(required(invitation.names[0] ?? "", "El nombre 1"), maxLength(invitation.names[0] ?? "", LIMITS.name, "El nombre 1")));
  set("names.1", maxLength(invitation.names[1] ?? "", LIMITS.name, "El nombre 2"));
  set("cover.eyebrow", maxLength(invitation.cover.eyebrow ?? "", LIMITS.eyebrow, "El título"));
  set("cover.tagline", maxLength(invitation.cover.tagline ?? "", LIMITS.tagline, "La frase"));
  if (invitation.cover.photo?.src) set("cover.photo.alt", altCheck(invitation.cover.photo.alt));

  set("story.text", maxLength(invitation.story.paragraphs.join("\n\n"), LIMITS.storyText, "El texto"));

  for (const location of invitation.locations) {
    const key = `locations.${location.id}`;
    // El nombre puede quedar vacío en una sede nueva: hasta que lo tenga, la invitación pública no la muestra.
    set(`${key}.name`, maxLength(location.name, LIMITS.locationName, "El nombre del lugar"));
    set(`${key}.address`, maxLength(location.addressLines.join("\n"), LIMITS.address, "La dirección"));
    set(`${key}.time`, maxLength(location.time ?? "", LIMITS.locationTime, "La hora"));
    set(`${key}.mapUrl`, url(location.mapUrl ?? "", "El enlace del mapa"));
    if (location.photo?.src) set(`${key}.photo.alt`, altCheck(location.photo.alt));
  }

  for (const item of invitation.timeline) {
    set(`timeline.${item.id}.time`, time(item.time));
    set(`timeline.${item.id}.label`, first(required(item.label, "El nombre del momento"), maxLength(item.label, LIMITS.timelineLabel, "El nombre del momento")));
  }

  for (const image of invitation.gallery) set(`gallery.${image.id}.alt`, altCheck(image.alt));

  if (invitation.giftRegistry) {
    const gifts = invitation.giftRegistry;
    set("giftRegistry.message", maxLength(gifts.message, LIMITS.giftMessage, "El mensaje"));
    set("giftRegistry.moreUrl", url(gifts.moreUrl ?? "", "El enlace de más opciones"));
    for (const entry of gifts.entries) {
      set(`giftRegistry.${entry.id}.name`, first(required(entry.name, "El nombre de la tienda"), maxLength(entry.name, LIMITS.giftName, "El nombre de la tienda")));
      set(`giftRegistry.${entry.id}.url`, url(entry.url, "El enlace", { required: true }));
    }
  }

  set("rsvp.message", maxLength(invitation.rsvp.message, LIMITS.rsvpMessage, "El mensaje"));
  set("rsvp.ctaLabel", maxLength(invitation.rsvp.ctaLabel ?? "", LIMITS.rsvpCta, "El texto del botón"));

  if (invitation.music?.sourceType === "external") {
    set("music.externalUrl", url(invitation.music.externalUrl ?? "", "El enlace", { required: true, httpsOnly: true }));
    set("music.title", first(required(invitation.music.title, "El título"), maxLength(invitation.music.title, LIMITS.musicTitle, "El título")));
    set("music.artist", maxLength(invitation.music.artist ?? "", LIMITS.musicArtist, "El artista"));
  }

  set("closing.message", maxLength(invitation.closing.message, LIMITS.closing, "El mensaje"));
  if (invitation.dressCode) {
    set("dressCode.style", maxLength(invitation.dressCode.style, LIMITS.dressStyle, "El estilo"));
    set("dressCode.description", maxLength(invitation.dressCode.description, LIMITS.dressDescription, "La descripción"));
    invitation.dressCode.palette.forEach((swatch, index) => {
      if (!/^#[0-9a-f]{6}$/i.test(swatch.hex)) errors[`dressCode.palette.${index}`] = "El color debe ser #RRGGBB.";
    });
  }

  for (const section of invitation.sections) {
    set(`sections.${section.id}.title`, maxLength(section.title ?? "", LIMITS.sectionTitle, "El título"));
    set(`sections.${section.id}.eyebrow`, maxLength(section.eyebrow ?? "", LIMITS.sectionEyebrow, "La etiqueta"));
    set(`sections.${section.id}.subtitle`, maxLength(section.subtitle ?? "", LIMITS.sectionSubtitle, "El subtítulo"));
  }

  return errors;
}
