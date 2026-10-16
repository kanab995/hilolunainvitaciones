/**
 * BIBLIOTECA MUSICAL (D-46): límites y formatos. Módulo puro (sin servidor ni React).
 *  - Un único formato de audio: MP3 (lo reproducen todos los navegadores, incluido Safari en iOS). 128 kbps ≈ 1 MB por minuto.
 *  - Los textos tienen longitudes máximas para que la consola, el editor y la invitación no se rompan con datos largos.
 */
export const MUSIC_AUDIO = {
  mimeType: "audio/mpeg",
  extension: "mp3",
  /** Una pista de hasta 10 min a 192 kbps cabe holgada; más grande indica un archivo sin optimizar. */
  maxBytes: 15 * 1024 * 1024,
  minDurationSec: 15,
  maxDurationSec: 600,
} as const;

export const MUSIC_TEXT_LIMITS = {
  title: 80,
  author: 80,
  categoryName: 40,
  categorySlug: 40,
  licenseSource: 200,
  licenseName: 120,
  licenseUrl: 500,
  licenseTerms: 4000,
  licenseEvidenceRef: 300,
  attributionText: 200,
} as const;

export const MUSIC_TRACK_STATUSES = ["DRAFT", "ACTIVE", "DISABLED"] as const;
export type MusicTrackStatusId = (typeof MUSIC_TRACK_STATUSES)[number];
export const isMusicTrackStatus = (value: unknown): value is MusicTrackStatusId => typeof value === "string" && (MUSIC_TRACK_STATUSES as readonly string[]).includes(value);

export const MUSIC_CATEGORY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** «3:05». */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) return "";
  const seconds = Math.round(totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * ¿Los primeros bytes son de un MP3? Una etiqueta ID3v2 (`ID3`) o una cabecera de trama MPEG (11 bits de sincronización a 1).
 * Defensa en profundidad: el tipo que declara el navegador al subir no basta.
 */
export function looksLikeMp3(bytes: Uint8Array): boolean {
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
}
