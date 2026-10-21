import { GIFT_REGISTRY_ANCHOR } from "@/lib/invitation/anchors";
import type { Invitation } from "@/types/invitation";

/**
 * DESTINO DEL QR de la versión impresa (D-49). Módulo puro: decide qué destinos admite la invitación PUBLICADA de un evento y a qué URL
 * apunta cada uno. Nunca a una ruta privada del panel ni a un enlace personalizado de invitado.
 *
 *  - `invitation` (por defecto, el comportamiento anterior): la URL pública general `/i/<slug>`.
 *  - `gifts`: la misma invitación, abierta en la sección de la mesa de regalos (`/i/<slug>#regalos`), donde el invitado elige entre todas
 *    las tiendas. Exige la sección VISIBLE y al menos un enlace de tienda en lo publicado.
 *  - `gift-link`: enlace DIRECTO a la tienda, solo cuando la mesa publicada tiene UN único enlace y pasa `safeStoreUrl` (https, sin
 *    credenciales, dominio público, corto para que el QR sea legible). No depende de la vigencia de la invitación.
 *  - `none`: sin QR; el reverso se recompone solo.
 */
export const PRINT_QR_TARGETS = ["invitation", "gifts", "gift-link", "none"] as const;
export type PrintQrTarget = (typeof PRINT_QR_TARGETS)[number];
export const DEFAULT_PRINT_QR_TARGET: PrintQrTarget = "invitation";
export const isPrintQrTarget = (value: unknown): value is PrintQrTarget => typeof value === "string" && (PRINT_QR_TARGETS as readonly string[]).includes(value);

/** Longitud máxima de un enlace directo a tienda: más largo, el QR necesita tantos módulos que deja de leerse bien impreso a 1". */
export const MAX_STORE_QR_URL_LENGTH = 160;

export type StoreUrlProblem = "invalid" | "insecure" | "too_long";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LOCAL_HOSTS = /(^|\.)(localhost|local|internal|localdomain|home|lan|test|example|invalid)$/i;
const HOSTNAME = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/**
 * Valida un enlace EXTERNO de tienda antes de imprimirlo en un QR. Solo `https:` en el puerto por defecto, sin usuario ni contraseña, con un
 * dominio público (nada de IP, `localhost` ni dominios internos) y de longitud acotada. Devuelve la URL normalizada por `URL`.
 */
export function safeStoreUrl(raw: string): { ok: true; url: string; host: string } | { ok: false; reason: StoreUrlProblem } {
  const value = raw.trim();
  const hasControl = [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);
  if (!value || value.length > 2048 || hasControl || /\s/.test(value)) return { ok: false, reason: "invalid" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol === "http:") return { ok: false, reason: "insecure" };
  if (url.protocol !== "https:" || url.username || url.password || url.port) return { ok: false, reason: "invalid" };
  const host = url.hostname.toLowerCase();
  if (host.startsWith("[") || IPV4.test(host) || LOCAL_HOSTS.test(host) || !HOSTNAME.test(host)) return { ok: false, reason: "invalid" };
  if (url.href.length > MAX_STORE_QR_URL_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, url: url.href, host: host.replace(/^www\./, "") };
}

export type GiftLinkState = { ok: true; name: string; url: string; host: string } | { ok: false; reason: "no_registry" | "several" | StoreUrlProblem };

export interface PrintQrAvailability {
  /** Invitación publicada y con acceso vigente: hay URL pública que abrir. */
  invitation: boolean;
  /** Sección de regalos publicada, visible y con al menos un enlace (y la invitación vigente). */
  gifts: boolean;
  /** ¿La invitación PUBLICADA tiene mesa de regalos? (Si no, la página pide configurarla y publicarla.) */
  giftsConfigured: boolean;
  /** Enlace directo a la única tienda, o por qué no se ofrece. */
  giftLink: GiftLinkState;
}

/** Enlaces de tienda de la mesa PUBLICADA y visible (tiendas + «Ver más opciones», sin repetir la misma URL). */
function publishedStoreLinks(invitation: Invitation): { name: string; url: string }[] | undefined {
  const registry = invitation.giftRegistry;
  const section = invitation.sections.find((candidate) => candidate.type === "giftRegistry");
  // Mismo criterio que la invitación pública: solo se dibujan las secciones visibles.
  if (!registry || !section?.isVisible) return undefined;
  const links = [...registry.entries.map((entry) => ({ name: entry.name.trim(), url: entry.url.trim() })), ...(registry.moreUrl?.trim() ? [{ name: "", url: registry.moreUrl.trim() }] : [])].filter((link) => link.url);
  const seen = new Set<string>();
  const unique = links.filter((link) => (seen.has(link.url) ? false : (seen.add(link.url), true)));
  return unique.length > 0 ? unique : undefined;
}

export function printQrAvailability(invitation: Invitation, options: { expired: boolean }): PrintQrAvailability {
  const links = publishedStoreLinks(invitation);
  const invitationLive = !options.expired;
  let giftLink: GiftLinkState = { ok: false, reason: "no_registry" };
  if (links && links.length > 1) giftLink = { ok: false, reason: "several" };
  else if (links?.[0]) {
    const checked = safeStoreUrl(links[0].url);
    giftLink = checked.ok ? { ok: true, name: links[0].name || checked.host, url: checked.url, host: checked.host } : { ok: false, reason: checked.reason };
  }
  return { invitation: invitationLive, gifts: invitationLive && Boolean(links), giftsConfigured: Boolean(links), giftLink };
}

/** ¿Se puede elegir este destino ahora? */
export function isQrTargetAvailable(target: PrintQrTarget, availability: PrintQrAvailability): boolean {
  if (target === "invitation") return availability.invitation;
  if (target === "gifts") return availability.gifts;
  if (target === "gift-link") return availability.giftLink.ok;
  return true;
}

export interface PrintQrDestination {
  kind: Exclude<PrintQrTarget, "none">;
  /** Lo que codifica el QR. */
  url: string;
  /** Dirección escrita bajo el texto (sin `https://` ni el ancla); ausente en el enlace directo a tienda. */
  label?: string;
}

const withoutScheme = (url: string) => url.replace(/^https?:\/\//, "");

/** URL de la sección de regalos de la invitación pública. */
export const giftRegistryPublicUrl = (invitationUrl: string): string => `${invitationUrl}#${GIFT_REGISTRY_ANCHOR}`;

/**
 * Destino resuelto de un objetivo DISPONIBLE; `undefined` = sin QR. Un destino elegido que ya no está disponible (p. ej. se retiró la mesa de
 * regalos y se volvió a publicar) NUNCA se cambia por otro en silencio: el servicio se niega a generar y la página pide elegir de nuevo.
 */
export function qrDestination(target: PrintQrTarget, availability: PrintQrAvailability, invitationUrl: string): PrintQrDestination | undefined {
  if (target === "invitation" && availability.invitation) return { kind: "invitation", url: invitationUrl, label: withoutScheme(invitationUrl) };
  if (target === "gifts" && availability.gifts) return { kind: "gifts", url: giftRegistryPublicUrl(invitationUrl), label: withoutScheme(invitationUrl) };
  if (target === "gift-link" && availability.giftLink.ok) return { kind: "gift-link", url: availability.giftLink.url };
  return undefined;
}
