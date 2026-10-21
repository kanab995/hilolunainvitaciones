import { randomBytes } from "node:crypto";
import type { AcceptedImageMime } from "@/lib/media/limits";

/**
 * CLAVES DE OBJETO: opacas, aleatorias y sin datos personales.
 *   users/<userId>/events/<eventId>/<32 hex aleatorios>.<ext>
 * `userId` y `eventId` son ids internos (cuid), no correo ni nombre. NUNCA entra el nombre del archivo del
 * usuario ni la extensión que declaró: la extensión sale del tipo REAL ya validado. Reemplazar una imagen
 * crea una clave NUEVA (las claves son inmutables ⇒ caché larga sin invalidaciones).
 */
const EXTENSION: Record<AcceptedImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function buildMediaKey(input: { userId: string; eventId: string; mimeType: AcceptedImageMime }): string {
  return `users/${input.userId}/events/${input.eventId}/${randomBytes(16).toString("hex")}.${EXTENSION[input.mimeType]}`;
}

/** ¿La clave tiene la forma que emite `buildMediaKey`? (defensa en profundidad antes de tocar el bucket). */
export const MEDIA_KEY_PATTERN = /^users\/[A-Za-z0-9_-]+\/events\/[A-Za-z0-9_-]+\/[0-9a-f]{32}\.(jpg|png|webp)$/;

/**
 * Audio de la BIBLIOTECA de Hilo Luna (D-46): `library/music/<trackId>-<32 hex aleatorios>.mp3`. Prefijo propio, fuera de `users/`: no es
 * un archivo de un cliente (la limpieza de huérfanos solo trata `MediaAsset` y nunca lo toca). Reemplazar el audio crea una clave nueva.
 */
export function buildLibraryAudioKey(trackId: string): string {
  return `library/music/${trackId}-${randomBytes(16).toString("hex")}.mp3`;
}

export const LIBRARY_AUDIO_KEY_PATTERN = /^library\/music\/[A-Za-z0-9_-]{1,64}-[0-9a-f]{32}\.mp3$/;

/** ¿La clave pertenece a ESA pista? (una subida nunca puede apuntar al audio de otra). */
export const isLibraryAudioKeyFor = (key: string, trackId: string): boolean => LIBRARY_AUDIO_KEY_PATTERN.test(key) && key.startsWith(`library/music/${trackId}-`);
