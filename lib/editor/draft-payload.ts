import type {
  DressCode,
  EventLocation,
  FontChoice,
  GalleryImage,
  GiftRegistry,
  Invitation,
  InvitationSection,
  MusicSettings,
  RSVPSettings,
  StyleOverrides,
  TimelineItem,
} from "@/types/invitation";

/**
 * PAYLOAD DEL GUARDADO DEL BORRADOR (D-29): el DTO EXPLÍCITO que viaja del editor al servidor.
 *  - `invitationToDraftPayload`: dominio → DTO (cliente). Nunca incluye ni una URL, ni un `blob:`, ni un `File`,
 *    ni ids de archivos, propietario, plantilla de catálogo o estados de publicación.
 *  - `parseDraftPayload`: `unknown` → DTO saneado (servidor). LISTA BLANCA: los campos que no están aquí se
 *    ignoran; los ids, enums, longitudes y tamaños de listas se validan; nada del cliente decide a quién pertenece
 *    algo (los ids de filas nuevas solo son identificadores dentro del evento resuelto por la sesión).
 *  - `applyDraftPayload`: DTO + borrador actual (de la BD) → nuevo borrador. Las imágenes (portada, sedes, galería,
 *    ilustraciones) NO se mueven por aquí: se conservan del estado actual y solo su texto alternativo se actualiza;
 *    subir/quitar imágenes son operaciones propias (`media-service`).
 * Módulo puro (sin React ni acceso a datos): se prueba sin servidor.
 */
export const DRAFT_LIMITS = { locations: 20, timeline: 40, gifts: 30, gallery: 60, sections: 20, palette: 12, paragraphs: 20, text: 2000 } as const;

export const ENTITY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface DraftSectionDto {
  id: string;
  isVisible: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: "left" | "center" | "right";
  overlay?: boolean;
}

export interface DraftLocationDto {
  id: string;
  kind: EventLocation["kind"];
  name: string;
  addressLines: string[];
  time?: string;
  mapUrl?: string;
  /** Texto alternativo de la imagen de la sede (si ya tiene una). */
  photoAlt?: string;
}

export interface DraftTimelineDto {
  id: string;
  time: string;
  label: string;
  icon: TimelineItem["icon"];
  description?: string;
}

export interface DraftGalleryDto {
  id: string;
  alt: string;
  caption?: string;
}

export interface DraftDressCodeDto {
  style: string;
  description: string;
  palette: { name?: string; hex: string }[];
  /** Texto alternativo de la ilustración GESTIONADA (la imagen en sí se cambia con sus propias acciones, como la portada). */
  illustrationAlt?: string;
}

export interface DraftGiftDto {
  message: string;
  moreUrl?: string;
  entries: { id: string; name: string; url: string }[];
}

/**
 * Música (D-46). Dos variantes explícitas:
 *  - `external`: un ENLACE (nunca suena dentro de la invitación). Un payload sin `source` es esta variante (clientes anteriores).
 *  - `library`: SOLO el id de la pista y los ajustes del anfitrión. Título, autor y audio los pone el SERVIDOR desde la pista: el cliente
 *    nunca aporta una URL ni un nombre de canción de la biblioteca.
 */
export type DraftMusicDto =
  | { source: "external"; externalUrl?: string; title: string; artist?: string; autoplayAfterInteraction: false; volume: number; loop: boolean }
  | { source: "library"; libraryTrackId: string; isEnabled: boolean; autoplayAfterInteraction: boolean; volume: number; loop: boolean };

/** Datos de la pista elegida que el SERVIDOR ya comprobó (existe, es reproducible y el plan del evento la permite). */
export interface ResolvedLibraryTrack {
  id: string;
  title: string;
  author: string;
}

export interface DraftPayload {
  /** Revisión del borrador sobre la que se editó (control de concurrencia optimista). */
  baseRevision: number;
  templateSlug: string;
  names: string[];
  event: { startsAt: string; timezone: string };
  cover: { eyebrow?: string; tagline?: string; openLabel: string; photoAlt?: string };
  story: { paragraphs: string[] };
  closing: { message: string };
  rsvp: RSVPSettings;
  dressCode: DraftDressCodeDto | null;
  giftRegistry: DraftGiftDto | null;
  music: DraftMusicDto | null;
  styleOverrides: Record<string, StyleOverrides>;
  sections: DraftSectionDto[];
  locations: DraftLocationDto[];
  timeline: DraftTimelineDto[];
  gallery: DraftGalleryDto[];
}

const compact = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

/* ───────── dominio → DTO (cliente) ───────── */

export function invitationToDraftPayload(invitation: Invitation, baseRevision: number): DraftPayload {
  return {
    baseRevision,
    templateSlug: invitation.templateSlug,
    names: [...invitation.names],
    event: { startsAt: invitation.event.startsAt, timezone: invitation.event.timezone },
    cover: compact({ eyebrow: invitation.cover.eyebrow, tagline: invitation.cover.tagline, openLabel: invitation.cover.openLabel, photoAlt: invitation.cover.photo?.mediaAssetId ? invitation.cover.photo.alt : undefined }),
    story: { paragraphs: [...invitation.story.paragraphs] },
    closing: { message: invitation.closing.message },
    rsvp: compact({ ...invitation.rsvp }),
    dressCode: invitation.dressCode
      ? compact({ style: invitation.dressCode.style, description: invitation.dressCode.description, palette: invitation.dressCode.palette.map((swatch) => compact({ name: swatch.name, hex: swatch.hex })), illustrationAlt: invitation.dressCode.illustration?.mediaAssetId ? invitation.dressCode.illustration.alt : undefined })
      : null,
    giftRegistry: invitation.giftRegistry ? compact({ message: invitation.giftRegistry.message, moreUrl: invitation.giftRegistry.moreUrl, entries: invitation.giftRegistry.entries.map((entry) => ({ id: entry.id, name: entry.name, url: entry.url })) }) : null,
    music: musicToDto(invitation.music),
    styleOverrides: { ...(invitation.styleOverrides ?? {}) },
    sections: invitation.sections.map((section) => compact({ id: section.id, isVisible: section.isVisible, eyebrow: section.eyebrow, title: section.title, subtitle: section.subtitle, align: section.align, overlay: section.overlay })),
    locations: invitation.locations.map((location) => compact({ id: location.id, kind: location.kind, name: location.name, addressLines: [...location.addressLines], time: location.time, mapUrl: location.mapUrl, photoAlt: location.photo?.mediaAssetId ? location.photo.alt : undefined })),
    timeline: invitation.timeline.map((item) => compact({ id: item.id, time: item.time, label: item.label, icon: item.icon, description: item.description })),
    gallery: invitation.gallery.map((image) => compact({ id: image.id, alt: image.alt, caption: image.caption })),
  };
}

function musicToDto(music: MusicSettings | undefined): DraftMusicDto | null {
  if (music?.sourceType === "external") return compact({ source: "external" as const, externalUrl: music.externalUrl, title: music.title, artist: music.artist, autoplayAfterInteraction: false as const, volume: music.volume, loop: music.loop });
  if (music?.sourceType === "library" && music.libraryTrackId) return { source: "library", libraryTrackId: music.libraryTrackId, isEnabled: music.isEnabled !== false, autoplayAfterInteraction: music.autoplayAfterInteraction, volume: music.volume, loop: music.loop };
  return null;
}

/* ───────── unknown → DTO (servidor) ───────── */

export type ParseResult = { ok: true; value: DraftPayload } | { ok: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, max: number = DRAFT_LIMITS.text): string | undefined => (typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max) : undefined);
const optStr = (value: unknown, max?: number): string | undefined => {
  const s = str(value, max);
  return s === undefined || s === "" ? undefined : s;
};
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const id = (value: unknown): string | undefined => (typeof value === "string" && ENTITY_ID.test(value) ? value : undefined);
const oneOf = <T extends string>(value: unknown, options: readonly T[]): T | undefined => (typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : undefined);

const LOCATION_KINDS = ["ceremony", "reception", "other"] as const;
const TIMELINE_ICONS = ["ceremony", "cocktail", "dinner", "party", "toast", "other"] as const;
const ALIGNS = ["left", "center", "right"] as const;
const FONTS: readonly FontChoice[] = ["cormorant", "inter"];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

export function parseDraftPayload(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, message: "Datos inválidos." };
  const baseRevision = num(raw.baseRevision);
  if (baseRevision === undefined || !Number.isInteger(baseRevision) || baseRevision < 1) return { ok: false, message: "Falta la revisión del borrador." };
  const templateSlug = typeof raw.templateSlug === "string" && SLUG.test(raw.templateSlug) && raw.templateSlug.length <= 60 ? raw.templateSlug : undefined;
  if (!templateSlug) return { ok: false, message: "Plantilla inválida." };

  const event = isRecord(raw.event) ? raw.event : {};
  const startsAt = str(event.startsAt, 40);
  const timezone = str(event.timezone, 80);
  if (!startsAt || Number.isNaN(Date.parse(startsAt)) || !timezone) return { ok: false, message: "La fecha del evento no es válida." };

  const cover = isRecord(raw.cover) ? raw.cover : {};
  const story = isRecord(raw.story) ? raw.story : {};
  const closing = isRecord(raw.closing) ? raw.closing : {};
  const rsvpRaw = isRecord(raw.rsvp) ? raw.rsvp : {};

  const rsvp: RSVPSettings = compact({
    enabled: bool(rsvpRaw.enabled, true),
    deadline: optStr(rsvpRaw.deadline, 40),
    message: str(rsvpRaw.message) ?? "",
    ctaLabel: optStr(rsvpRaw.ctaLabel, 60),
    maxCompanions: Math.max(0, Math.min(20, Math.trunc(num(rsvpRaw.maxCompanions) ?? 0))),
    allowMaybe: bool(rsvpRaw.allowMaybe, false),
    askDietaryNotes: bool(rsvpRaw.askDietaryNotes, false),
  });

  const dressRaw = isRecord(raw.dressCode) ? raw.dressCode : undefined;
  const dressCode: DraftDressCodeDto | null = dressRaw
    ? {
        style: str(dressRaw.style) ?? "",
        description: str(dressRaw.description) ?? "",
        palette: list(dressRaw.palette, DRAFT_LIMITS.palette).flatMap((swatch) => (isRecord(swatch) && typeof swatch.hex === "string" ? [compact({ name: optStr(swatch.name, 60), hex: swatch.hex.slice(0, 9) })] : [])),
        ...(typeof dressRaw.illustrationAlt === "string" ? { illustrationAlt: str(dressRaw.illustrationAlt, 300) } : {}),
      }
    : null;

  const giftRaw = isRecord(raw.giftRegistry) ? raw.giftRegistry : undefined;
  const giftRegistry: DraftGiftDto | null = giftRaw
    ? compact({
        message: str(giftRaw.message) ?? "",
        moreUrl: optStr(giftRaw.moreUrl, 500),
        entries: uniqueIds(
          list(giftRaw.entries, DRAFT_LIMITS.gifts).flatMap((entry) => {
            const entryId = isRecord(entry) ? id(entry.id) : undefined;
            return isRecord(entry) && entryId ? [{ id: entryId, name: str(entry.name, 200) ?? "", url: str(entry.url, 500) ?? "" }] : [];
          }),
        ),
      })
    : null;

  const musicRaw = isRecord(raw.music) ? raw.music : undefined;
  let music: DraftMusicDto | null = null;
  if (musicRaw && musicRaw.source === "library") {
    // Biblioteca: solo un id con forma válida; sin él, la música se trata como inválida (no se inventa una pista).
    const libraryTrackId = id(musicRaw.libraryTrackId);
    if (!libraryTrackId) return { ok: false, message: "Elige una canción de la biblioteca." };
    music = { source: "library", libraryTrackId, isEnabled: bool(musicRaw.isEnabled, true), autoplayAfterInteraction: bool(musicRaw.autoplayAfterInteraction, true), volume: Math.max(0, Math.min(1, num(musicRaw.volume) ?? 0.6)), loop: bool(musicRaw.loop, true) };
  } else if (musicRaw) {
    music = compact({
      source: "external" as const,
      externalUrl: optStr(musicRaw.externalUrl, 500),
      title: str(musicRaw.title, 200) ?? "",
      artist: optStr(musicRaw.artist, 200),
      // Un enlace externo nunca se reproduce solo (docs/ARCHITECTURE.md §10.1).
      autoplayAfterInteraction: false as const,
      volume: Math.max(0, Math.min(1, num(musicRaw.volume) ?? 0.6)),
      loop: bool(musicRaw.loop, true),
    });
  }

  const styleOverrides: Record<string, StyleOverrides> = {};
  if (isRecord(raw.styleOverrides)) {
    for (const [slug, value] of Object.entries(raw.styleOverrides).slice(0, 12)) {
      if (!SLUG.test(slug) || !isRecord(value)) continue;
      const accent = typeof value.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(value.accent) ? value.accent : undefined;
      const fontsRaw = isRecord(value.fonts) ? value.fonts : undefined;
      const names = oneOf(fontsRaw?.names, FONTS);
      const tagline = oneOf(fontsRaw?.tagline, FONTS);
      const fonts = names || tagline ? compact({ names, tagline }) : undefined;
      styleOverrides[slug] = compact({ accent, fonts });
    }
  }

  const sections = uniqueIds(
    list(raw.sections, DRAFT_LIMITS.sections).flatMap((section): DraftSectionDto[] => {
      const sectionId = isRecord(section) ? id(section.id) : undefined;
      if (!isRecord(section) || !sectionId) return [];
      return [compact({ id: sectionId, isVisible: bool(section.isVisible, true), eyebrow: optStr(section.eyebrow, 200), title: optStr(section.title, 200), subtitle: optStr(section.subtitle, 400), align: oneOf(section.align, ALIGNS), overlay: typeof section.overlay === "boolean" ? section.overlay : undefined })];
    }),
  );

  const locations = uniqueIds(
    list(raw.locations, DRAFT_LIMITS.locations).flatMap((location): DraftLocationDto[] => {
      const locationId = isRecord(location) ? id(location.id) : undefined;
      if (!isRecord(location) || !locationId) return [];
      return [
        compact({
          id: locationId,
          kind: oneOf(location.kind, LOCATION_KINDS) ?? "other",
          name: str(location.name, 300) ?? "",
          addressLines: list(location.addressLines, 8).flatMap((line) => (typeof line === "string" ? [line.slice(0, 300)] : [])),
          time: optStr(location.time, 60),
          mapUrl: optStr(location.mapUrl, 500),
          photoAlt: str(location.photoAlt, 300),
        }),
      ];
    }),
  );

  const timeline = uniqueIds(
    list(raw.timeline, DRAFT_LIMITS.timeline).flatMap((item): DraftTimelineDto[] => {
      const itemId = isRecord(item) ? id(item.id) : undefined;
      if (!isRecord(item) || !itemId) return [];
      return [compact({ id: itemId, time: str(item.time, 20) ?? "", label: str(item.label, 200) ?? "", icon: oneOf(item.icon, TIMELINE_ICONS) ?? "other", description: optStr(item.description, 300) })];
    }),
  );

  const gallery = uniqueIds(
    list(raw.gallery, DRAFT_LIMITS.gallery).flatMap((image): DraftGalleryDto[] => {
      const imageId = isRecord(image) ? id(image.id) : undefined;
      return isRecord(image) && imageId ? [compact({ id: imageId, alt: str(image.alt, 300) ?? "", caption: optStr(image.caption, 300) })] : [];
    }),
  );

  return {
    ok: true,
    value: {
      baseRevision,
      templateSlug,
      names: list(raw.names, 4).flatMap((name) => (typeof name === "string" ? [name.slice(0, 100)] : [])),
      event: { startsAt, timezone },
      cover: compact({ eyebrow: optStr(cover.eyebrow, 200), tagline: optStr(cover.tagline, 200), openLabel: str(cover.openLabel, 100) || "Abrir invitación", photoAlt: str(cover.photoAlt, 300) }),
      story: { paragraphs: list(story.paragraphs, DRAFT_LIMITS.paragraphs).flatMap((paragraph) => (typeof paragraph === "string" ? [paragraph.slice(0, DRAFT_LIMITS.text)] : [])) },
      closing: { message: str(closing.message, 500) ?? "" },
      rsvp,
      dressCode,
      giftRegistry,
      music,
      styleOverrides,
      sections,
      locations,
      timeline,
      gallery,
    },
  };
}

/* ───────── DTO + borrador actual → nuevo borrador ───────── */

/** `null` = «Sin música» (se quita). Una pista nueva sin comprobar no se aplica: se conserva la música actual (el servicio ya rechazó el guardado). */
function applyMusic(current: MusicSettings | undefined, dto: DraftMusicDto | null, libraryTrack: ResolvedLibraryTrack | undefined): MusicSettings | undefined {
  if (dto === null) return undefined;
  if (dto.source === "external") {
    return compact({ ...(current?.sourceType === "external" ? current : {}), sourceType: "external" as const, externalUrl: dto.externalUrl, title: dto.title, artist: dto.artist, autoplayAfterInteraction: false, volume: dto.volume, loop: dto.loop });
  }
  const sameTrack = current?.sourceType === "library" && current.libraryTrackId === dto.libraryTrackId;
  const track = sameTrack ? { title: current.title, author: current.artist ?? "" } : libraryTrack?.id === dto.libraryTrackId ? { title: libraryTrack.title, author: libraryTrack.author } : undefined;
  if (!track) return current;
  return compact({
    sourceType: "library" as const,
    libraryTrackId: dto.libraryTrackId,
    title: track.title,
    artist: track.author || undefined,
    isEnabled: dto.isEnabled ? undefined : false,
    autoplayAfterInteraction: dto.autoplayAfterInteraction,
    volume: dto.volume,
    loop: dto.loop,
  });
}

/** Orden del DTO para los elementos conocidos; los que el DTO no menciona se conservan al final (nunca se pierden por un payload incompleto). */
function orderedByDto<T extends { id: string }>(current: readonly T[], dtoIds: readonly string[], build: (item: T, dtoId: string) => T): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  const known = dtoIds.flatMap((dtoId) => {
    const item = byId.get(dtoId);
    return item ? [build(item, dtoId)] : [];
  });
  const mentioned = new Set(dtoIds);
  return [...known, ...current.filter((item) => !mentioned.has(item.id))];
}

/**
 * `libraryTrack`: la pista de la biblioteca que el servicio ya comprobó para ESTE guardado. Solo hace falta si el anfitrión CAMBIÓ de
 * canción: conservar la misma pista nunca exige comprobarla de nuevo (un evento que pierde su plan sigue pudiendo editar todo lo demás).
 */
export function applyDraftPayload(current: Invitation, dto: DraftPayload, libraryTrack?: ResolvedLibraryTrack): Invitation {
  const sectionDto = new Map(dto.sections.map((section) => [section.id, section]));

  const sections = orderedByDto<InvitationSection>(current.sections, dto.sections.map((section) => section.id), (section) => {
    const change = sectionDto.get(section.id);
    if (!change) return section;
    return compact({ id: section.id, type: section.type, isVisible: change.isVisible, eyebrow: change.eyebrow, title: change.title, subtitle: change.subtitle, align: change.align, overlay: change.overlay });
  });

  // Solo las sedes del DTO existen después de guardar (crear, editar y eliminar); la imagen propia se conserva.
  const currentLocations = new Map(current.locations.map((location) => [location.id, location]));
  const locations: EventLocation[] = dto.locations.map((location) => {
    const existing = currentLocations.get(location.id);
    const photo = existing?.photo ? (location.photoAlt !== undefined && existing.photo.mediaAssetId ? { ...existing.photo, alt: location.photoAlt } : existing.photo) : undefined;
    return compact({ id: location.id, kind: location.kind, name: location.name, addressLines: location.addressLines.length > 0 ? location.addressLines : [""], time: location.time, mapUrl: location.mapUrl, photo });
  });

  const timeline: TimelineItem[] = dto.timeline.map((item) => compact({ id: item.id, time: item.time, label: item.label, icon: item.icon, description: item.description }));

  // La galería nunca crea ni borra filas por esta vía: solo texto alternativo, pie y orden de las existentes.
  const galleryDto = new Map(dto.gallery.map((image) => [image.id, image]));
  const gallery = orderedByDto<GalleryImage>(current.gallery, dto.gallery.map((image) => image.id), (image) => {
    const change = galleryDto.get(image.id);
    return change ? compact({ ...image, alt: change.alt, caption: change.caption }) : image;
  });

  const currentIllustration = current.dressCode?.illustration;
  const illustration = currentIllustration?.mediaAssetId && dto.dressCode?.illustrationAlt !== undefined ? { ...currentIllustration, alt: dto.dressCode.illustrationAlt } : currentIllustration;
  const dressCode: DressCode | undefined = dto.dressCode ? compact({ style: dto.dressCode.style, description: dto.dressCode.description, palette: dto.dressCode.palette.map((swatch) => compact({ name: swatch.name, hex: swatch.hex })), illustration }) : undefined;

  const giftRegistry: GiftRegistry | undefined = dto.giftRegistry ? compact({ message: dto.giftRegistry.message, entries: dto.giftRegistry.entries, moreUrl: dto.giftRegistry.moreUrl, photo: current.giftRegistry?.photo }) : undefined;

  const music = applyMusic(current.music, dto.music, libraryTrack);

  const photo = current.cover.photo ? (dto.cover.photoAlt !== undefined && current.cover.photo.mediaAssetId ? { ...current.cover.photo, alt: dto.cover.photoAlt } : current.cover.photo) : undefined;

  return {
    ...current,
    templateSlug: dto.templateSlug,
    names: dto.names,
    event: { startsAt: dto.event.startsAt, timezone: dto.event.timezone },
    cover: compact({ eyebrow: dto.cover.eyebrow, tagline: dto.cover.tagline, openLabel: dto.cover.openLabel, photo }),
    story: { paragraphs: dto.story.paragraphs },
    closing: { message: dto.closing.message },
    rsvp: dto.rsvp,
    dressCode,
    giftRegistry,
    music,
    styleOverrides: dto.styleOverrides,
    sections,
    locations,
    timeline,
    gallery,
  };
}
