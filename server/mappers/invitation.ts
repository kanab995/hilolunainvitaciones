import type { Event, GalleryImage, GiftRegistry, Invitation as InvitationRow, InvitationSection as SectionRow, Location, MediaAsset, MusicSettings, TimelineItem as TimelineRow } from "@prisma/client";
import { isoToZonedParts, zonedPartsToIso } from "@/lib/editor/datetime";
import {
  eventTypeFromDb,
  eventTypeToDb,
  locationKindFromDb,
  locationKindToDb,
  musicSourceFromDb,
  musicSourceToDb,
  sectionTypeFromDb,
  sectionTypeToDb,
  timelineIconFromDb,
  timelineIconToDb,
} from "@/server/mappers/enums";
import {
  parseClosing,
  parseCover,
  parseDressCode,
  parseGiftRegistryMeta,
  parseImageRef,
  parseNames,
  parseRsvpSettings,
  parseSectionSettings,
  parseStory,
  parseStyleOverrides,
  type SectionSettings,
} from "@/server/mappers/json";
import type {
  ImageRef,
  InvitationCover,
  EventLocation,
  GalleryImage as DomainGalleryImage,
  GiftRegistry as DomainGiftRegistry,
  Invitation,
  InvitationSection,
  MusicSettings as DomainMusic,
  TimelineItem as DomainTimelineItem,
} from "@/types/invitation";

/**
 * MAPPERS Prisma ↔ dominio (docs/ARCHITECTURE.md D-22). La interfaz solo conoce `Invitation`
 * (`types/invitation.ts`); estas funciones son la ÚNICA frontera con las filas de la BD. Son puras
 * (sin acceso a datos), por eso se prueban sin PostgreSQL. Los tipos de fila son subconjuntos de los
 * modelos de Prisma: lo que el mapper necesita, nada más.
 */

export type EventRowForInvitation = Pick<Event, "id" | "type" | "startsAt" | "timezone"> & {
  locations: readonly LocationRowData[];
  timelineItems: readonly TimelineRowData[];
  galleryImages: readonly GalleryRowData[];
  giftRegistry: readonly GiftRowData[];
  music: MusicRowData | null;
};
/** Lo que el mapper necesita de un `MediaAsset` para dibujarlo (nunca el propietario ni datos internos). */
export type MediaRefRow = Pick<MediaAsset, "id" | "storageKey" | "status" | "width" | "height">;
type LocationBase = Pick<Location, "id" | "type" | "name" | "address" | "time" | "mapUrl" | "imagePath" | "imageAlt" | "imageWidth" | "imageHeight" | "position">;
type GalleryBase = Pick<GalleryImage, "id" | "src" | "alt" | "width" | "height" | "caption" | "position">;
/** Filas LEÍDAS: la referencia a un archivo gestionado es opcional (el origen de demostración no tiene). */
export type LocationRowData = LocationBase & { mediaAssetId?: string | null; mediaAsset?: MediaRefRow | null };
export type GalleryRowData = GalleryBase & { mediaAssetId?: string | null; mediaAsset?: MediaRefRow | null };
/** Filas ESCRITAS: la referencia siempre se declara (nula o un id). */
export type LocationWriteRow = LocationBase & { mediaAssetId: string | null };
export type GalleryWriteRow = GalleryBase & { mediaAssetId: string | null };
export type TimelineRowData = Pick<TimelineRow, "id" | "time" | "title" | "icon" | "description" | "position">;
export type GiftRowData = Pick<GiftRegistry, "id" | "name" | "url" | "position">;
export type MusicRowData = Pick<
  MusicSettings,
  "sourceType" | "trackUrl" | "externalUrl" | "title" | "artist" | "autoplayAfterInteraction" | "volume" | "loop" | "libraryTrackId" | "uploadAssetId"
>;
export type SectionRowData = Pick<SectionRow, "id" | "type" | "position" | "isVisible" | "settings" | "content">;

/** Una invitación con todo lo que necesita para dibujarse. */
export type InvitationAggregateRow = Pick<InvitationRow, "id" | "slug" | "contentVersion" | "names" | "styleOverrides"> & {
  coverAlt?: string;
  coverMedia?: MediaRefRow | null;
  template: { slug: string };
  sections: readonly SectionRowData[];
  event: EventRowForInvitation;
};

/**
 * Cómo se dibujan los archivos gestionados. `mediaUrl` traduce una `storageKey` a la URL pública (o
 * `undefined` si no hay almacenamiento configurado: entonces la imagen simplemente no se muestra).
 * `exposeMediaIds` solo lo activa el EDITOR del propietario: la invitación pública nunca lleva ids.
 */
export interface MediaMapOptions {
  mediaUrl?: (storageKey: string) => string | undefined;
  exposeMediaIds?: boolean;
}

/** Imagen del dominio para un archivo gestionado, o `undefined` si no está listo / no se puede mostrar. */
function managedImage(media: MediaRefRow | null | undefined, alt: string, options: MediaMapOptions): ImageRef | undefined {
  if (!media || media.status !== "READY") return undefined;
  const src = options.mediaUrl?.(media.storageKey);
  if (src === undefined && !options.exposeMediaIds) return undefined;
  return compact({ src, alt, width: media.width ?? undefined, height: media.height ?? undefined, mediaAssetId: options.exposeMediaIds ? media.id : undefined });
}

const byPosition = <T extends { position: number }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.position - b.position);

const compact = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

/** Instante de la BD → ISO 8601 con el desfase de la zona del evento ("2027-05-17T17:00:00-06:00"). */
export function dbDateToEventIso(date: Date, timezone: string): string {
  try {
    const parts = isoToZonedParts(date.toISOString(), timezone);
    const iso = parts && zonedPartsToIso(parts.date, parts.time, timezone);
    if (iso && Date.parse(iso) === Math.floor(date.getTime() / 60_000) * 60_000) return iso;
  } catch {
    // Zona horaria desconocida: se cae al instante UTC.
  }
  return date.toISOString();
}

// ───────── BD → dominio ─────────

export function dbLocationToDomain(row: LocationRowData, options: MediaMapOptions = {}): EventLocation {
  const staticPhoto = parseImageRef(row.imagePath === null ? undefined : { src: row.imagePath, alt: row.imageAlt ?? "", width: row.imageWidth ?? undefined, height: row.imageHeight ?? undefined });
  // Una imagen PROPIA (MediaAsset) manda sobre la estática de la plantilla.
  const photo = managedImage(row.mediaAsset, row.imageAlt ?? "", options) ?? staticPhoto;
  return compact({
    id: row.id,
    kind: locationKindFromDb[row.type],
    name: row.name,
    addressLines: row.address.split("\n"),
    time: row.time ?? undefined,
    mapUrl: row.mapUrl ?? undefined,
    photo,
  });
}

export function dbTimelineToDomain(row: TimelineRowData): DomainTimelineItem {
  return compact({ id: row.id, time: row.time, label: row.title, icon: timelineIconFromDb[row.icon], description: row.description ?? undefined });
}

export function dbGalleryToDomain(row: GalleryRowData, options: MediaMapOptions = {}): DomainGalleryImage {
  const managed = managedImage(row.mediaAsset, row.alt, options);
  return compact({
    id: row.id,
    src: managed ? managed.src : row.src || undefined,
    alt: row.alt,
    width: managed ? managed.width : (row.width ?? undefined),
    height: managed ? managed.height : (row.height ?? undefined),
    caption: row.caption ?? undefined,
    mediaAssetId: managed?.mediaAssetId,
  });
}

export function dbMusicToDomain(row: MusicRowData): DomainMusic {
  const sourceType = musicSourceFromDb[row.sourceType];
  return compact({
    sourceType,
    trackUrl: row.trackUrl ?? undefined,
    externalUrl: row.externalUrl ?? undefined,
    title: row.title,
    artist: row.artist ?? undefined,
    // Regla de dominio (ARCHITECTURE §10.1): un enlace externo nunca se reproduce solo.
    autoplayAfterInteraction: sourceType === "external" ? false : row.autoplayAfterInteraction,
    volume: row.volume,
    loop: row.loop,
    libraryTrackId: row.libraryTrackId ?? undefined,
    uploadAssetId: row.uploadAssetId ?? undefined,
  });
}

function dbSectionToDomain(row: SectionRowData, invitationId: string): InvitationSection {
  const settings = parseSectionSettings(row.settings, `InvitationSection(${row.id}).settings de ${invitationId}`);
  return { id: row.id, type: sectionTypeFromDb[row.type], isVisible: row.isVisible, ...settings };
}

/** La foto de portada PROPIA (MediaAsset) sustituye a la del contenido; sin ella queda el fondo de la plantilla. */
function withManagedCover(cover: InvitationCover, row: InvitationAggregateRow, options: MediaMapOptions): InvitationCover {
  const photo = managedImage(row.coverMedia, row.coverAlt ?? "", options);
  return photo ? { ...cover, photo } : cover;
}

/**
 * Fila de BD → invitación del dominio. Las listas se ordenan por `position` (no se confía en el orden
 * de la consulta) y la visibilidad se conserva tal cual. La fecha y la zona salen SIEMPRE de `Event`.
 * El contenido de un solo elemento (portada, historia…) sale del `content` de su sección; si falta o
 * no es válido se usa un valor seguro y se registra el problema.
 */
export function dbInvitationToDomain(row: InvitationAggregateRow, options: MediaMapOptions = {}): Invitation {
  const sections = byPosition(row.sections);
  const contentOf = (type: SectionRowData["type"]) => sections.find((section) => section.type === type)?.content;
  const context = `Invitation(${row.id})`;

  const giftMeta = parseGiftRegistryMeta(contentOf("GIFTS"));
  const giftEntries = byPosition(row.event.giftRegistry).map((entry) => ({ id: entry.id, name: entry.name, url: entry.url }));
  const giftRegistry: DomainGiftRegistry | undefined =
    giftEntries.length > 0 || giftMeta.message !== "" ? compact({ message: giftMeta.message, entries: giftEntries, moreUrl: giftMeta.moreUrl, photo: giftMeta.photo }) : undefined;

  return compact({
    id: row.id,
    slug: row.slug,
    contentVersion: row.contentVersion,
    eventType: eventTypeFromDb[row.event.type],
    templateSlug: row.template.slug,
    styleOverrides: parseStyleOverrides(row.styleOverrides, `${context}.styleOverrides`),

    names: parseNames(row.names),
    event: { startsAt: dbDateToEventIso(row.event.startsAt, row.event.timezone), timezone: row.event.timezone },

    cover: withManagedCover(parseCover(contentOf("COVER"), `${context}.COVER`), row, options),
    story: parseStory(contentOf("STORY"), `${context}.STORY`),
    locations: byPosition(row.event.locations).map((location) => dbLocationToDomain(location, options)),
    timeline: byPosition(row.event.timelineItems).map(dbTimelineToDomain),
    gallery: byPosition(row.event.galleryImages).map((image) => dbGalleryToDomain(image, options)),
    dressCode: parseDressCode(contentOf("DRESS_CODE"), `${context}.DRESS_CODE`),
    giftRegistry,
    music: row.event.music ? dbMusicToDomain(row.event.music) : undefined,
    rsvp: parseRsvpSettings(contentOf("RSVP"), `${context}.RSVP`),
    closing: parseClosing(contentOf("CLOSING"), `${context}.CLOSING`),

    sections: sections.map((section) => dbSectionToDomain(section, row.id)),
  });
}

// ───────── dominio → BD ─────────

/** Filas para escribir una invitación: cada lista con su `position` (el orden del arreglo). */
export interface InvitationWriteModel {
  invitation: Pick<InvitationRow, "id" | "slug" | "contentVersion" | "names"> & { styleOverrides: object };
  sections: (Omit<SectionRowData, "settings" | "content"> & { settings: object; content: object })[];
  locations: LocationWriteRow[];
  timelineItems: TimelineRowData[];
  galleryImages: GalleryWriteRow[];
  giftRegistry: GiftRowData[];
  music: MusicRowData | undefined;
}

/** Contenido de un solo elemento que se guarda en el `content` de su sección. */
function sectionContent(invitation: Invitation, type: InvitationSection["type"]): object {
  switch (type) {
    case "hero":
      // La foto de portada gestionada vive en `Invitation.coverMediaId`, nunca dentro del JSON.
      return invitation.cover.photo?.mediaAssetId ? { ...invitation.cover, photo: undefined } : invitation.cover;
    case "story":
      return invitation.story;
    case "dressCode":
      return invitation.dressCode ?? {};
    case "giftRegistry":
      return invitation.giftRegistry ? compact({ message: invitation.giftRegistry.message, moreUrl: invitation.giftRegistry.moreUrl, photo: invitation.giftRegistry.photo }) : {};
    case "rsvp":
      return invitation.rsvp;
    case "footer":
      return invitation.closing;
    default:
      return {};
  }
}

/**
 * Invitación del dominio → filas de BD. No incluye la fecha ni el tipo del evento (son de `Event`) ni
 * la plantilla (`templateId` lo resuelve el repositorio a partir de `templateSlug`).
 */
export function domainInvitationToDb(invitation: Invitation): InvitationWriteModel {
  return {
    invitation: { id: invitation.id, slug: invitation.slug, contentVersion: invitation.contentVersion, names: [...invitation.names], styleOverrides: invitation.styleOverrides ?? {} },
    sections: invitation.sections.map((section, position) => ({
      id: section.id,
      type: sectionTypeToDb[section.type],
      position,
      isVisible: section.isVisible,
      settings: compact<SectionSettings>({ eyebrow: section.eyebrow, title: section.title, subtitle: section.subtitle, align: section.align, overlay: section.overlay }),
      content: sectionContent(invitation, section.type),
    })),
    locations: invitation.locations.map((location, position) => ({
      id: location.id,
      type: locationKindToDb[location.kind],
      name: location.name,
      address: location.addressLines.join("\n"),
      time: location.time ?? null,
      mapUrl: location.mapUrl ?? null,
      // Una imagen gestionada se referencia por `mediaAssetId`; su URL nunca se guarda (se deriva de la clave).
      imagePath: location.photo?.mediaAssetId ? null : (location.photo?.src ?? null),
      imageAlt: location.photo?.alt ?? null,
      imageWidth: location.photo?.width ?? null,
      imageHeight: location.photo?.height ?? null,
      mediaAssetId: location.photo?.mediaAssetId ?? null,
      position,
    })),
    timelineItems: invitation.timeline.map((item, position) => ({
      id: item.id,
      time: item.time,
      title: item.label,
      icon: timelineIconToDb[item.icon],
      description: item.description ?? null,
      position,
    })),
    galleryImages: invitation.gallery.map((image, position) => ({
      id: image.id,
      src: image.mediaAssetId ? null : (image.src ?? null),
      mediaAssetId: image.mediaAssetId ?? null,
      alt: image.alt,
      width: image.width ?? null,
      height: image.height ?? null,
      caption: image.caption ?? null,
      position,
    })),
    giftRegistry: (invitation.giftRegistry?.entries ?? []).map((entry, position) => ({ id: entry.id, name: entry.name, url: entry.url, position })),
    music: invitation.music
      ? {
          sourceType: musicSourceToDb[invitation.music.sourceType],
          trackUrl: invitation.music.trackUrl ?? null,
          externalUrl: invitation.music.externalUrl ?? null,
          title: invitation.music.title,
          artist: invitation.music.artist ?? null,
          autoplayAfterInteraction: invitation.music.sourceType === "external" ? false : invitation.music.autoplayAfterInteraction,
          volume: invitation.music.volume,
          loop: invitation.music.loop,
          libraryTrackId: invitation.music.libraryTrackId ?? null,
          uploadAssetId: invitation.music.uploadAssetId ?? null,
        }
      : undefined,
  };
}

export { eventTypeFromDb, eventTypeToDb };
