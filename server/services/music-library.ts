import type { ResolvedLibraryTrack } from "@/lib/editor/draft-payload";
import { getServerNow } from "@/lib/invitation/server-time";
import { isTrackPlayable } from "@/lib/music/license";
import { resolveLibraryMusic, type PlayableTrack, type ResolvedMusic } from "@/lib/music/resolve";
import { findTrackForPlayback, listActiveLibraryTracks, listMusicCategories, type MusicCategoryRow, type MusicTrackRow } from "@/server/repositories/music";
import { canUseEventFeature } from "@/server/services/entitlement-service";
import { getMediaUrl } from "@/server/storage";
import type { MusicSettings } from "@/types/invitation";
import type { EditorMusicLibrary, LibraryTrackDto } from "@/types/music";

/**
 * BIBLIOTECA MUSICAL — casos de uso del EDITOR y de la INVITACIÓN pública (D-46). Una sola regla decide si una pista puede sonar
 * (`isTrackPlayable`: `ACTIVE` + audio + derechos completos y vigentes) y una sola capacidad de plan (`musicLibrary`).
 *  - El editor solo recibe pistas reproducibles, con su URL pública de audio (para la muestra y la vista previa) y NUNCA la clave
 *    de almacenamiento ni la documentación de la licencia.
 *  - La invitación pública resuelve la música en cada petición con el estado actual (ver `lib/music/resolve.ts`).
 */
export interface MusicLibraryDeps {
  listTracks: () => Promise<MusicTrackRow[]>;
  listCategories: () => Promise<MusicCategoryRow[]>;
  findTrack: (id: string) => Promise<MusicTrackRow | undefined>;
  entitled: (eventId: string) => Promise<boolean>;
  urlFor: (key: string) => string | undefined;
  now: () => Date;
}

const defaultDeps: MusicLibraryDeps = {
  listTracks: listActiveLibraryTracks,
  listCategories: listMusicCategories,
  findTrack: findTrackForPlayback,
  entitled: (eventId) => canUseEventFeature(eventId, "musicLibrary"),
  urlFor: getMediaUrl,
  now: () => new Date(getServerNow()),
};

const attributionOf = (track: MusicTrackRow): string | undefined => (track.attributionRequired && track.attributionText ? track.attributionText : undefined);

/** Pista reproducible con su URL de audio, o `undefined` (no existe, no está activa, sin derechos vigentes o sin almacenamiento). */
function playable(track: MusicTrackRow | undefined, deps: MusicLibraryDeps): (PlayableTrack & { row: MusicTrackRow }) | undefined {
  if (!track || !isTrackPlayable(track, deps.now()) || !track.audioKey) return undefined;
  const audioUrl = deps.urlFor(track.audioKey);
  if (!audioUrl) return undefined;
  const attribution = attributionOf(track);
  return { id: track.id, title: track.title, author: track.author, audioUrl, ...(attribution ? { attribution } : {}), row: track };
}

/** Biblioteca para el editor de UN evento (el llamador ya comprobó que el evento es del usuario). */
export async function getEditorMusicLibrary(eventId: string, current: MusicSettings | undefined, deps: MusicLibraryDeps = defaultDeps): Promise<EditorMusicLibrary> {
  const [allowed, categories, rows] = await Promise.all([deps.entitled(eventId), deps.listCategories(), deps.listTracks()]);
  const tracks: LibraryTrackDto[] = rows.flatMap((row) => {
    const track = playable(row, deps);
    if (!track) return [];
    return [{ id: track.id, title: track.title, author: track.author, categorySlug: row.category.slug, durationSec: row.durationSec ?? 0, audioUrl: track.audioUrl, ...(track.attribution ? { attribution: track.attribution } : {}) }];
  });
  const visibleCategories = categories.filter((category) => category.isActive).map((category) => ({ slug: category.slug, name: category.name }));

  let selected: EditorMusicLibrary["selected"];
  if (current?.sourceType === "library" && current.libraryTrackId) {
    const listed = tracks.find((track) => track.id === current.libraryTrackId);
    // Elegida antes y ya no disponible (desactivada, licencia vencida o categoría oculta): se informa, nunca se borra.
    selected = listed ? { id: listed.id, available: true, audioUrl: listed.audioUrl } : await selectedOutsideList(current.libraryTrackId, deps);
  }
  return { allowed, categories: visibleCategories, tracks, ...(selected ? { selected } : {}) };
}

async function selectedOutsideList(trackId: string, deps: MusicLibraryDeps): Promise<EditorMusicLibrary["selected"]> {
  const track = playable(await deps.findTrack(trackId), deps);
  return track ? { id: trackId, available: true, audioUrl: track.audioUrl } : { id: trackId, available: false };
}

export type LibrarySelectionCheck = { ok: true; track: ResolvedLibraryTrack } | { ok: false; code: "plan_required" | "unavailable" };

/** ¿Puede ESTE evento elegir ESTA pista? (al CAMBIAR de canción; conservar la misma no se vuelve a comprobar). */
export async function checkLibrarySelection(eventId: string, trackId: string, deps: MusicLibraryDeps = defaultDeps): Promise<LibrarySelectionCheck> {
  if (!(await deps.entitled(eventId))) return { ok: false, code: "plan_required" };
  const track = playable(await deps.findTrack(trackId), deps);
  return track ? { ok: true, track: { id: track.id, title: track.title, author: track.author } } : { ok: false, code: "unavailable" };
}

/** Lo que suena en la invitación PUBLICADA de un evento (o nada). Nunca lanza: un fallo deja la invitación sin música, no sin invitación. */
export async function resolvePublicMusic(eventId: string, music: MusicSettings | undefined, deps: MusicLibraryDeps = defaultDeps): Promise<ResolvedMusic | undefined> {
  if (!music || music.sourceType !== "library" || music.isEnabled === false || !music.libraryTrackId) return undefined;
  try {
    const [entitled, row] = await Promise.all([deps.entitled(eventId), deps.findTrack(music.libraryTrackId)]);
    return resolveLibraryMusic(music, playable(row, deps), entitled);
  } catch {
    return undefined;
  }
}

/** Para la vista previa del editor: pone la URL del audio en el borrador (no se guarda nunca; el payload no la incluye). */
export function withPreviewTrackUrl(music: MusicSettings | undefined, library: EditorMusicLibrary): MusicSettings | undefined {
  if (music?.sourceType !== "library" || !library.selected?.available || !library.selected.audioUrl) return music;
  return { ...music, trackUrl: library.selected.audioUrl };
}
