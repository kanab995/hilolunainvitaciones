import type { EventLocation, GalleryImage, ImageRef, Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import { PUBLISHED_SCHEMA_VERSION, type PublishedImage, type PublishedInvitation } from "@/types/published";

/**
 * SNAPSHOT PUBLICADO (D-29). Dos funciones PURAS (sin Prisma, sin React, sin reloj propio: la fecha y la versión
 * llegan por parámetro), pensadas para probarse sin base de datos:
 *  - `buildPublishedInvitationSnapshot`: borrador (dominio) + plantilla + archivos verificados → snapshot.
 *  - `snapshotToInvitation`: snapshot → `Invitation` de render para la página pública.
 * El snapshot NO incluye propietario, correo, ids de Clerk, tokens ni datos de invitados. Las imágenes propias se
 * guardan por su `storageKey` (jamás una URL: se deriva al leer, como en D-27) y las estáticas por su ruta.
 */
export interface PublishAsset {
  storageKey: string;
  width?: number;
  height?: number;
}

export interface BuildSnapshotInput {
  invitation: Invitation;
  template: InvitationTemplate;
  /** Archivos READY del propietario, por id. Un id ausente (no listo, ajeno o eliminado) descarta esa imagen. */
  assets: ReadonlyMap<string, PublishAsset>;
  version: number;
  publishedAt: Date;
}

/** Identificador estable y determinista del diseño de una plantilla (hash FNV-1a del tema serializado). */
export function templateVersionId(template: InvitationTemplate): string {
  const text = JSON.stringify(template);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `t1-${hash.toString(16).padStart(8, "0")}`;
}

function publishedImage(image: ImageRef | undefined, assets: ReadonlyMap<string, PublishAsset>, used: Set<string>): PublishedImage | undefined {
  if (!image) return undefined;
  const size = { ...(image.width !== undefined ? { width: image.width } : {}), ...(image.height !== undefined ? { height: image.height } : {}) };
  if (image.mediaAssetId) {
    const asset = assets.get(image.mediaAssetId);
    if (!asset) return undefined;
    used.add(image.mediaAssetId);
    return { kind: "asset", mediaAssetId: image.mediaAssetId, storageKey: asset.storageKey, alt: image.alt, ...(asset.width !== undefined ? { width: asset.width } : size.width !== undefined ? { width: size.width } : {}), ...(asset.height !== undefined ? { height: asset.height } : size.height !== undefined ? { height: size.height } : {}) };
  }
  // Solo assets estáticos del propio producto (`/templates/...`): un `blob:` o una URL externa nunca se publican.
  if (image.src && image.src.startsWith("/") && !image.src.startsWith("//")) return { kind: "static", src: image.src, alt: image.alt, ...size };
  return undefined;
}

export function buildPublishedInvitationSnapshot(input: BuildSnapshotInput): { snapshot: PublishedInvitation; mediaAssetIds: string[] } {
  const { invitation, template, assets, version, publishedAt } = input;
  const used = new Set<string>();
  const image = (value: ImageRef | undefined) => publishedImage(value, assets, used);
  const optional = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

  const snapshot: PublishedInvitation = {
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    version,
    publishedAt: publishedAt.toISOString(),
    template: { slug: template.slug, version: templateVersionId(template), config: template },

    slug: invitation.slug,
    contentVersion: invitation.contentVersion,
    eventType: invitation.eventType,
    names: [...invitation.names],
    event: { startsAt: invitation.event.startsAt, timezone: invitation.event.timezone },
    styleOverrides: { ...(invitation.styleOverrides ?? {}) },

    cover: optional({ eyebrow: invitation.cover.eyebrow, tagline: invitation.cover.tagline, openLabel: invitation.cover.openLabel, photo: image(invitation.cover.photo) }),
    story: { paragraphs: [...invitation.story.paragraphs] },
    locations: invitation.locations.map((location) => optional({ id: location.id, kind: location.kind, name: location.name, addressLines: [...location.addressLines], time: location.time, mapUrl: location.mapUrl, photo: image(location.photo) })),
    timeline: invitation.timeline.map((item) => optional({ ...item })),
    // Una imagen de galería cuyo archivo no está disponible no se publica (no hay nada que mostrar).
    gallery: invitation.gallery.flatMap((item) => {
      const published = image(item);
      return published ? [optional({ id: item.id, caption: item.caption, image: published })] : [];
    }),
    ...(invitation.dressCode ? { dressCode: optional({ style: invitation.dressCode.style, description: invitation.dressCode.description, palette: invitation.dressCode.palette.map((swatch) => ({ ...swatch })), illustration: image(invitation.dressCode.illustration) }) } : {}),
    ...(invitation.giftRegistry ? { giftRegistry: optional({ message: invitation.giftRegistry.message, entries: invitation.giftRegistry.entries.map((entry) => ({ ...entry })), moreUrl: invitation.giftRegistry.moreUrl, photo: image(invitation.giftRegistry.photo) }) } : {}),
    // `uploadAssetId` es un id interno: no viaja al snapshot (la música por archivo aún no existe).
    ...(invitation.music ? { music: optional({ ...invitation.music, uploadAssetId: undefined }) } : {}),
    rsvp: { ...invitation.rsvp },
    closing: { message: invitation.closing.message },
    sections: invitation.sections.map((section) => ({ ...section })),
  };

  return { snapshot, mediaAssetIds: [...used] };
}

/** Resuelve la URL pública de una clave de archivo; `undefined` si no hay almacenamiento configurado. */
export type MediaUrlResolver = (storageKey: string) => string | undefined;

function toImageRef(image: PublishedImage | undefined, mediaUrl: MediaUrlResolver): ImageRef | undefined {
  if (!image) return undefined;
  const size = { ...(image.width !== undefined ? { width: image.width } : {}), ...(image.height !== undefined ? { height: image.height } : {}) };
  if (image.kind === "static") return { src: image.src, alt: image.alt, ...size };
  const src = mediaUrl(image.storageKey);
  // Sin URL no hay imagen que mostrar; y NUNCA se expone el id del archivo ni su clave al navegador.
  return src === undefined ? undefined : { src, alt: image.alt, ...size };
}

/** Snapshot → invitación de render (dominio). Sin ids internos: solo lo necesario para dibujar. */
export function snapshotToInvitation(snapshot: PublishedInvitation, mediaUrl: MediaUrlResolver): Invitation {
  const optional = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

  const locations: EventLocation[] = snapshot.locations.map((location) => optional({ id: location.id, kind: location.kind, name: location.name, addressLines: location.addressLines, time: location.time, mapUrl: location.mapUrl, photo: toImageRef(location.photo, mediaUrl) }));
  const gallery: GalleryImage[] = snapshot.gallery.flatMap((item) => {
    const ref = toImageRef(item.image, mediaUrl);
    return ref ? [optional({ id: item.id, caption: item.caption, ...ref })] : [];
  });

  return optional({
    id: `published-${snapshot.slug}`,
    slug: snapshot.slug,
    contentVersion: snapshot.contentVersion,
    eventType: snapshot.eventType,
    templateSlug: snapshot.template.slug,
    styleOverrides: snapshot.styleOverrides,
    names: snapshot.names,
    event: snapshot.event,
    cover: optional({ eyebrow: snapshot.cover.eyebrow, tagline: snapshot.cover.tagline, openLabel: snapshot.cover.openLabel, photo: toImageRef(snapshot.cover.photo, mediaUrl) }),
    story: snapshot.story,
    locations,
    timeline: snapshot.timeline,
    gallery,
    dressCode: snapshot.dressCode ? optional({ style: snapshot.dressCode.style, description: snapshot.dressCode.description, palette: snapshot.dressCode.palette, illustration: toImageRef(snapshot.dressCode.illustration, mediaUrl) }) : undefined,
    giftRegistry: snapshot.giftRegistry ? optional({ message: snapshot.giftRegistry.message, entries: snapshot.giftRegistry.entries, moreUrl: snapshot.giftRegistry.moreUrl, photo: toImageRef(snapshot.giftRegistry.photo, mediaUrl) }) : undefined,
    music: snapshot.music,
    rsvp: snapshot.rsvp,
    closing: snapshot.closing,
    sections: snapshot.sections,
  }) as Invitation;
}

/** ¿El JSON leído de la BD tiene la forma mínima de un snapshot de esta versión del esquema? (lectura defensiva). */
export function isPublishedInvitation(value: unknown): value is PublishedInvitation {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<PublishedInvitation>;
  return v.schemaVersion === PUBLISHED_SCHEMA_VERSION && typeof v.slug === "string" && Array.isArray(v.names) && Array.isArray(v.sections) && typeof v.template === "object" && v.template !== null && typeof v.template.slug === "string";
}
