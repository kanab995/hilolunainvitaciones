import { getServerNow } from "@/lib/invitation/server-time";
import { activationProblems, licenseDocumentationProblems, type ActivationProblem } from "@/lib/music/license";
import { isMusicTrackStatus, looksLikeMp3, MUSIC_AUDIO, MUSIC_CATEGORY_SLUG, MUSIC_TEXT_LIMITS, type MusicTrackStatusId } from "@/lib/music/limits";
import type { AdminUser } from "@/server/auth/admin";
import { StoreUnavailableError } from "@/server/db/errors";
import * as repo from "@/server/repositories/music";
import { logger } from "@/server/observability/logger";
import { getMediaUrl, getStorageProvider, type StorageProvider, type UploadTarget } from "@/server/storage";
import { buildLibraryAudioKey, isLibraryAudioKeyFor } from "@/server/storage/keys";

/**
 * BIBLIOTECA MUSICAL EN LA CONSOLA (D-46, ampliación de D-33 aprobada por el propietario). Solo ADMIN: cada página y cada Server Action
 * llaman a `requireAdmin()` antes de llegar aquí; estas funciones reciben el `AdminUser` ya comprobado y validan TODA la entrada (viene de
 * un formulario). Reglas:
 *  - Una pista nace en `DRAFT`. Pasar a `ACTIVE` exige `activationProblems` vacío (audio + documentación + verificación vigente); la base de
 *    datos lo vuelve a exigir con una restricción CHECK.
 *  - Mientras una pista está `ACTIVE` no se cambia su documentación ni su audio (primero se desactiva).
 *  - La verificación la firma un administrador (fecha + autor) y se anula si la documentación cambia.
 *  - Los contratos NO se suben al bucket (es público): solo una referencia a dónde están guardados.
 *  - Todo cambio queda en `AdminAuditLog` (antes → después).
 */
export type MusicAdminError = "invalid" | "not_found" | "duplicate" | "category" | "active" | "problems" | "documentation" | "storage" | "upload" | "unavailable";
export type MusicAdminResult<T = object> = ({ ok: true } & T) | { ok: false; code: MusicAdminError; problems?: ActivationProblem[] };

const now = () => new Date(getServerNow());

// ───────── Lectura ─────────

export interface AdminMusicTrackDto extends repo.MusicTrackRow {
  problems: ActivationProblem[];
  /** URL pública del audio (para escucharlo en la consola). */
  audioUrl: string | null;
}

export async function listAdminMusic(_admin: AdminUser): Promise<{ categories: repo.MusicCategoryRow[]; tracks: AdminMusicTrackDto[] }> {
  const [categories, tracks] = await Promise.all([repo.listMusicCategories(), repo.listMusicTracks()]);
  return { categories, tracks: tracks.map(toDto) };
}

export async function getAdminMusicTrack(_admin: AdminUser, id: unknown): Promise<{ track: AdminMusicTrackDto; categories: repo.MusicCategoryRow[] } | null> {
  if (!isId(id)) return null;
  const [track, categories] = await Promise.all([repo.findMusicTrack(id), repo.listMusicCategories()]);
  return track ? { track: toDto(track), categories } : null;
}

function toDto(track: repo.MusicTrackRow): AdminMusicTrackDto {
  return { ...track, problems: activationProblems(track, now()), audioUrl: track.audioKey ? (getMediaUrl(track.audioKey) ?? null) : null };
}

// ───────── Validación de entrada (sin confiar) ─────────

const isId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\u0000/g, "").trim();
  return trimmed.length === 0 || trimmed.length > max ? null : trimmed;
};
const optionalText = (value: unknown, max: number): string | null | false => {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) return null;
  return text(value, max) ?? false;
};
const checked = (value: unknown): boolean => value === "on" || value === "true" || value === true;
const integer = (value: unknown, min: number, max: number): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// ───────── Categorías ─────────

export async function createAdminMusicCategory(admin: AdminUser, input: { name: unknown; slug: unknown; sortOrder: unknown; isActive: unknown }): Promise<MusicAdminResult> {
  const name = text(input.name, MUSIC_TEXT_LIMITS.categoryName);
  const slug = text(input.slug, MUSIC_TEXT_LIMITS.categorySlug);
  const sortOrder = integer(input.sortOrder ?? "0", 0, 10_000);
  if (!name || !slug || !MUSIC_CATEGORY_SLUG.test(slug) || sortOrder === null) return { ok: false, code: "invalid" };
  return guard(async () => {
    const result = await repo.createMusicCategory({ name, slug, sortOrder, isActive: checked(input.isActive) }, admin.id);
    return result.ok ? { ok: true } : { ok: false, code: result.code };
  });
}

export async function updateAdminMusicCategory(admin: AdminUser, input: { categoryId: unknown; name: unknown; sortOrder: unknown; isActive: unknown }): Promise<MusicAdminResult> {
  const name = text(input.name, MUSIC_TEXT_LIMITS.categoryName);
  const sortOrder = integer(input.sortOrder, 0, 10_000);
  if (!isId(input.categoryId) || !name || sortOrder === null) return { ok: false, code: "invalid" };
  const categoryId = input.categoryId;
  return guard(async () => ((await repo.updateMusicCategory(categoryId, { name, sortOrder, isActive: checked(input.isActive) }, admin.id)) ? { ok: true } : { ok: false, code: "not_found" }));
}

// ───────── Pistas ─────────

function parseMetadata(input: { title: unknown; author: unknown; categoryId: unknown }): repo.TrackMetadataWrite | null {
  const title = text(input.title, MUSIC_TEXT_LIMITS.title);
  const author = text(input.author, MUSIC_TEXT_LIMITS.author);
  return title && author && isId(input.categoryId) ? { title, author, categoryId: input.categoryId } : null;
}

export async function createAdminMusicTrack(admin: AdminUser, input: { title: unknown; author: unknown; categoryId: unknown }): Promise<MusicAdminResult<{ id: string }>> {
  const data = parseMetadata(input);
  if (!data) return { ok: false, code: "invalid" };
  return guard(async () => {
    const result = await repo.createMusicTrack(data, admin.id);
    return result.ok ? { ok: true, id: result.id } : { ok: false, code: result.code };
  });
}

export async function updateAdminMusicTrack(admin: AdminUser, input: { trackId: unknown; title: unknown; author: unknown; categoryId: unknown }): Promise<MusicAdminResult> {
  const data = parseMetadata(input);
  if (!isId(input.trackId) || !data) return { ok: false, code: "invalid" };
  const trackId = input.trackId;
  return guard(async () => {
    const result = await repo.updateMusicTrackMetadata(trackId, data, admin.id);
    return result === "ok" ? { ok: true } : { ok: false, code: result };
  });
}

export interface LicenseInput {
  trackId: unknown;
  licenseSource: unknown;
  licenseName: unknown;
  licenseUrl: unknown;
  licenseTerms: unknown;
  licenseEvidenceRef: unknown;
  rightsHosting: unknown;
  rightsPublicPerformance: unknown;
  rightsCommercialUse: unknown;
  attributionRequired: unknown;
  attributionText: unknown;
  licenseExpiresAt: unknown;
}

/** Guardar documentación INCOMPLETA está permitido (se completa por partes); lo que no puede es ACTIVARSE hasta estar completa. */
export function parseLicense(input: LicenseInput): repo.TrackLicenseWrite | null {
  const fields = {
    licenseSource: optionalText(input.licenseSource, MUSIC_TEXT_LIMITS.licenseSource),
    licenseName: optionalText(input.licenseName, MUSIC_TEXT_LIMITS.licenseName),
    licenseUrl: optionalText(input.licenseUrl, MUSIC_TEXT_LIMITS.licenseUrl),
    licenseTerms: optionalText(input.licenseTerms, MUSIC_TEXT_LIMITS.licenseTerms),
    licenseEvidenceRef: optionalText(input.licenseEvidenceRef, MUSIC_TEXT_LIMITS.licenseEvidenceRef),
    attributionText: optionalText(input.attributionText, MUSIC_TEXT_LIMITS.attributionText),
  };
  if (Object.values(fields).some((value) => value === false)) return null;
  let licenseExpiresAt: Date | null = null;
  if (typeof input.licenseExpiresAt === "string" && input.licenseExpiresAt.trim() !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.licenseExpiresAt.trim())) return null;
    licenseExpiresAt = new Date(`${input.licenseExpiresAt.trim()}T23:59:59.999Z`);
    if (Number.isNaN(licenseExpiresAt.getTime())) return null;
  }
  return {
    ...(fields as { [K in keyof typeof fields]: string | null }),
    rightsHosting: checked(input.rightsHosting),
    rightsPublicPerformance: checked(input.rightsPublicPerformance),
    rightsCommercialUse: checked(input.rightsCommercialUse),
    attributionRequired: checked(input.attributionRequired),
    licenseExpiresAt,
  };
}

export async function updateAdminMusicLicense(admin: AdminUser, input: LicenseInput): Promise<MusicAdminResult> {
  const data = parseLicense(input);
  if (!isId(input.trackId) || !data) return { ok: false, code: "invalid" };
  const trackId = input.trackId;
  return guard(async () => {
    const result = await repo.updateMusicTrackLicense(trackId, data, admin.id);
    return result === "ok" ? { ok: true } : { ok: false, code: result };
  });
}

/** Solo se puede verificar documentación COMPLETA (los tres derechos, comprobante, condiciones…). */
export async function verifyAdminMusicLicense(admin: AdminUser, trackId: unknown): Promise<MusicAdminResult> {
  if (!isId(trackId)) return { ok: false, code: "invalid" };
  return guard(async () => {
    const track = await repo.findMusicTrack(trackId);
    if (!track) return { ok: false, code: "not_found" };
    const problems = licenseDocumentationProblems(track, now());
    if (problems.length > 0) return { ok: false, code: "documentation", problems };
    await repo.markMusicTrackVerified(trackId, admin.id, now());
    return { ok: true };
  });
}

export async function setAdminMusicTrackStatus(admin: AdminUser, input: { trackId: unknown; status: unknown }): Promise<MusicAdminResult> {
  if (!isId(input.trackId) || !isMusicTrackStatus(input.status)) return { ok: false, code: "invalid" };
  const trackId = input.trackId;
  const status: MusicTrackStatusId = input.status;
  return guard(async () => {
    const track = await repo.findMusicTrack(trackId);
    if (!track) return { ok: false, code: "not_found" };
    if (status === "ACTIVE") {
      const problems = activationProblems(track, now());
      if (problems.length > 0) return { ok: false, code: "problems", problems };
    }
    await repo.setMusicTrackStatus(trackId, status, admin.id);
    return { ok: true };
  });
}

// ───────── Audio (subida directa al almacenamiento) ─────────

export interface MusicUploadDeps {
  storage: () => StorageProvider | undefined;
  newKey: (trackId: string) => string;
}

const defaultUploadDeps: MusicUploadDeps = { storage: getStorageProvider, newKey: buildLibraryAudioKey };

/** URL firmada de subida para el MP3 de UNA pista (no activa). El navegador sube el archivo directo; luego se llama a `finalize…`. */
export async function requestAdminMusicUpload(_admin: AdminUser, input: { trackId: unknown; sizeBytes: unknown; mimeType: unknown }, deps: MusicUploadDeps = defaultUploadDeps): Promise<MusicAdminResult<{ upload: UploadTarget; key: string }>> {
  const sizeBytes = integer(input.sizeBytes, 1, MUSIC_AUDIO.maxBytes);
  if (!isId(input.trackId) || sizeBytes === null || input.mimeType !== MUSIC_AUDIO.mimeType) return { ok: false, code: "invalid" };
  const trackId = input.trackId;
  const storage = deps.storage();
  if (!storage) return { ok: false, code: "storage" };
  return guard(async () => {
    const track = await repo.findMusicTrack(trackId);
    if (!track) return { ok: false, code: "not_found" };
    if (track.status === "ACTIVE") return { ok: false, code: "active" };
    const key = deps.newKey(trackId);
    const upload = await storage.createUploadTarget({ key, mimeType: MUSIC_AUDIO.mimeType, sizeBytes });
    return { ok: true, upload, key };
  });
}

/**
 * Comprueba el archivo YA subido (existe, tamaño dentro del límite, empieza como un MP3) y lo asigna a la pista. La duración la mide el
 * navegador del administrador (dato informativo, acotado). El audio anterior se borra (la pista no estaba activa: nadie lo reproduce).
 * Si la comprobación falla, el objeto subido se borra.
 */
export async function finalizeAdminMusicUpload(admin: AdminUser, input: { trackId: unknown; key: unknown; durationSec: unknown }, deps: MusicUploadDeps = defaultUploadDeps): Promise<MusicAdminResult> {
  const durationSec = integer(typeof input.durationSec === "number" ? Math.round(input.durationSec) : input.durationSec, MUSIC_AUDIO.minDurationSec, MUSIC_AUDIO.maxDurationSec);
  if (!isId(input.trackId) || typeof input.key !== "string" || !isLibraryAudioKeyFor(input.key, input.trackId) || durationSec === null) return { ok: false, code: "invalid" };
  const trackId = input.trackId;
  const key = input.key;
  const storage = deps.storage();
  if (!storage) return { ok: false, code: "storage" };
  return guard(async () => {
    const info = await storage.head(key);
    const start = info ? await storage.readStart(key, 16) : undefined;
    if (!info || info.sizeBytes <= 0 || info.sizeBytes > MUSIC_AUDIO.maxBytes || !start || !looksLikeMp3(start)) {
      await storage.delete(key).catch(() => undefined);
      return { ok: false, code: "upload" };
    }
    const result = await repo.setMusicTrackAudio(trackId, { audioKey: key, audioMimeType: MUSIC_AUDIO.mimeType, audioSizeBytes: info.sizeBytes, durationSec }, admin.id);
    if (!result.ok) {
      await storage.delete(key).catch(() => undefined);
      return { ok: false, code: result.code };
    }
    if (result.previousKey && result.previousKey !== key) await storage.delete(result.previousKey).catch((error: unknown) => logger.error("music.audio_release_failed", error));
    return { ok: true };
  });
}

/** Sin base de datos → `unavailable`; cualquier otro fallo se registra (sin datos) y se devuelve como no encontrado/ inválido genérico. */
async function guard<R>(run: () => Promise<R>): Promise<R | { ok: false; code: "unavailable" }> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { ok: false, code: "unavailable" };
    throw error;
  }
}
