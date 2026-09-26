import { slugify } from "@/lib/events/slug";
import { routes } from "@/lib/routes";
import { getGuestInvitationUrl, getPublicInvitationUrl, type SiteUrlEnv } from "@/lib/site-url";
import type { PublicationState } from "@/types/published";

/**
 * QUÉ SE PUEDE COMPARTIR (D-30). Única fuente de las URL, los textos y los nombres de archivo del área de compartir
 * (modal del dashboard, editor y Guest Manager). Reglas:
 *  - Toda URL sale de `getPublicInvitationUrl()` / `getGuestInvitationUrl()` (nunca un dominio escrito a mano).
 *  - SOLO se comparte lo PUBLICADO: en borrador no hay URL, ni QR, ni calendario. «Cambios sin publicar» sigue
 *    compartiendo la última versión publicada (la URL es estable: publicar no cambia el slug).
 *  - El enlace de un invitado usa su `inviteToken` opaco, nunca su id.
 * Módulo puro (sin React): se prueba sin navegador.
 */
export const SHARE_TEXT = "Nos encantará compartir este día contigo.";

export type ShareTarget =
  | { available: false; reason: "draft" }
  | {
      available: true;
      /** Enlace público general (el que se copia, se comparte y se codifica en el QR). */
      url: string;
      /** Ruta del calendario (`.ics`) de la versión PUBLICADA. */
      calendarPath: string;
      qrFilename: string;
      qrSvgFilename: string;
      title: string;
      text: string;
    };

/** Parte de nombre de archivo segura: solo `a-z`, `0-9` y `-`; nada que venga sin sanear. */
export function safeFilePart(value: string, fallback: string): string {
  const cleaned = slugify(value).slice(0, 60);
  return cleaned || fallback;
}

export const qrFilename = (slug: string, ext: "png" | "svg" = "png"): string => `invitacion-${safeFilePart(slug, "invitacion")}-qr.${ext}`;
export const icsFilename = (slug: string): string => `invitacion-${safeFilePart(slug, "invitacion")}.ics`;

export function resolveShare(input: { slug: string; title: string; state: PublicationState }, env?: SiteUrlEnv): ShareTarget {
  if (input.state === "draft") return { available: false, reason: "draft" };
  return {
    available: true,
    url: getPublicInvitationUrl(input.slug, env),
    calendarPath: routes.invitationCalendar(input.slug),
    qrFilename: qrFilename(input.slug),
    qrSvgFilename: qrFilename(input.slug, "svg"),
    title: input.title,
    text: SHARE_TEXT,
  };
}

export type GuestShareTarget = { available: false; reason: "draft" } | { available: true; url: string; qrFilename: string };

/** QR / enlace personalizado de UN invitado: `…/i/<slug>?guest=<token>`. El token no se muestra ni va en el nombre del archivo. */
export function resolveGuestShare(
  input: { slug: string; guestName: string; state: PublicationState } & ({ inviteToken: string } | { inviteUrl: string }),
  env?: SiteUrlEnv,
): GuestShareTarget {
  if (input.state === "draft") return { available: false, reason: "draft" };
  const guestPart = safeFilePart(input.guestName, "invitado");
  // `inviteUrl` ya viene construida en el servidor con `getGuestInvitationUrl` (mismo token opaco).
  const url = "inviteUrl" in input ? input.inviteUrl : getGuestInvitationUrl(input.slug, input.inviteToken, env);
  return { available: true, url, qrFilename: `invitacion-${safeFilePart(input.slug, "invitacion")}-${guestPart}-qr.png` };
}

/** Contenido de la hoja nativa de compartir (`navigator.share`). */
export const webSharePayload = (target: Extract<ShareTarget, { available: true }>): { title: string; text: string; url: string } => ({ title: target.title, text: target.text, url: target.url });
