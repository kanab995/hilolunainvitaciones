import { MEDIA_LIMITS, mediaMessages, sanitizeFilename, validateImageMeta, type AcceptedImageMime } from "@/lib/media/limits";
import { LIMITS } from "@/lib/editor/validation";
import { resolveOwnedEvent, type OwnedEventResolution } from "@/server/auth/ownership";
import { StoreUnavailableError } from "@/server/db/errors";
import { prismaMediaRepository, type MediaAssetRecord, type MediaRepository } from "@/server/repositories/media";
import { normalizeImage, type NormalizeResult } from "@/server/media/normalize";
import { isRateLimited, RATE_LIMIT_RULES, rateLimitMessage } from "@/server/security/rate-limit";
import { getStorageProvider } from "@/server/storage";
import { INSPECT_BYTES, inspectImage } from "@/server/storage/image-inspect";
import { checkGalleryLimit, type LimitDecision } from "@/server/services/plan-limits";
import { buildMediaKey } from "@/server/storage/keys";
import type { StorageProvider } from "@/server/storage/provider";
import { getMediaUrl } from "@/server/storage/public-url";
import type { GalleryImage, ImageRef } from "@/types/invitation";
import type { MediaErrorCode, MediaResult, UploadTicket } from "@/types/media";
import { logger } from "@/server/observability/logger";

/**
 * CASOS DE USO de los archivos gestionados (los llaman las Server Actions; ninguna lógica vive en ellas).
 * Orden fijo: 1. sesión  2. usuario  3. el evento es DEL usuario  4. el archivo es de ESE usuario y evento
 * 5. validar  6. escribir  7. resultado seguro. Del cliente solo se acepta el id de evento (referencia que se
 * comprueba) y ids de archivo/fila (también comprobados en la consulta): nunca `ownerId`, `storageKey`,
 * tipo ni tamaño (se verifican en el servidor sobre el objeto real). Las dependencias son inyectables.
 */
export interface MediaServiceDeps {
  resolveOwnedEvent: (ref: string) => Promise<OwnedEventResolution>;
  repo: MediaRepository;
  storage: () => StorageProvider | undefined;
  urlFor: (storageKey: string) => string | undefined;
  newKey: typeof buildMediaKey;
  /** Cupo de imágenes de galería del plan DE ESTE EVENTO (D-32). La portada y las sedes NO cuentan. */
  checkGalleryLimit: (userId: string, eventId: string) => Promise<LimitDecision>;
  /** Elimina EXIF/GPS y otros metadatos (y gira si hace falta) antes de declarar la imagen lista. Por defecto `normalizeImage`. */
  normalize?: (bytes: Uint8Array, mime: AcceptedImageMime) => Promise<NormalizeResult>;
  /** Límite de tasa de emisión de URLs de subida, por usuario. `true` = rechazar. Sin él (pruebas) no se limita. */
  isRateLimited?: (userId: string) => Promise<boolean>;
}

const defaultDeps: MediaServiceDeps = {
  resolveOwnedEvent,
  repo: prismaMediaRepository,
  storage: getStorageProvider,
  urlFor: getMediaUrl,
  newKey: buildMediaKey,
  checkGalleryLimit,
  normalize: normalizeImage,
  isRateLimited: (userId) => isRateLimited([{ rule: RATE_LIMIT_RULES.uploadAuthorize, identity: userId }]),
};

export interface MediaServiceOutcome<T extends object = object> {
  result: MediaResult<T>;
  /** Solo si la operación cambió lo que ve el público: la acción revalida `/i/[slug]` y el editor. */
  revalidate?: { eventId: string; slug?: string };
}

const fail = (code: MediaErrorCode, message: string): { ok: false; code: MediaErrorCode; message: string } => ({ ok: false, code, message });
const denied = fail("not_found", mediaMessages.denied);
const ALT_MAX = LIMITS.altText; // el mismo límite que el editor
const ASSET_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Texto alternativo: solo texto plano, sin caracteres de control ni etiquetas, longitud acotada. Puede quedar vacío (imagen decorativa). */
export function sanitizeAlt(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, ALT_MAX);
}

interface Ctx {
  userId: string;
  eventId: string;
}

async function withOwnedEvent<T extends object>(eventRef: string, deps: MediaServiceDeps, run: (ctx: Ctx) => Promise<MediaServiceOutcome<T>>): Promise<MediaServiceOutcome<T>> {
  try {
    const resolution = await deps.resolveOwnedEvent(eventRef);
    if (resolution.status === "unauthenticated") return { result: fail("unauthenticated", mediaMessages.unauthenticated) };
    if (resolution.status === "not_found") return { result: denied };
    return await run({ userId: resolution.user.id, eventId: resolution.event.id });
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { result: fail("unavailable", mediaMessages.notConfigured) };
    // Solo el tipo del error: nunca el mensaje crudo del SDK (puede traer bucket, clave o endpoint).
    logger.error("media.failure", error);
    return { result: fail("error", mediaMessages.uploadFailed) };
  }
}

const imageOf = (deps: MediaServiceDeps, asset: MediaAssetRecord, alt: string): ImageRef => ({
  ...(deps.urlFor(asset.storageKey) !== undefined ? { src: deps.urlFor(asset.storageKey) } : {}),
  alt,
  ...(asset.width ? { width: asset.width } : {}),
  ...(asset.height ? { height: asset.height } : {}),
  mediaAssetId: asset.id,
});

async function slugFor(deps: MediaServiceDeps, ctx: Ctx): Promise<{ eventId: string; slug?: string }> {
  return { eventId: ctx.eventId, slug: await deps.repo.getSlug(ctx.userId, ctx.eventId) };
}

/** Borra el binario y retira el registro SOLO si ya nada lo referencia. El fallo del almacenamiento no rompe la operación: el archivo queda huérfano (deuda documentada). */
async function releaseIfUnused(deps: MediaServiceDeps, ctx: Ctx, assetId: string | null | undefined): Promise<void> {
  if (!assetId) return;
  try {
    const asset = await deps.repo.findOwned(ctx.userId, ctx.eventId, assetId);
    if (!asset || asset.status === "DELETED") return;
    if ((await deps.repo.countReferences(asset.id)) > 0) return;
    await deps.storage()?.delete(asset.storageKey);
    await deps.repo.markDeleted(asset.id);
  } catch (error) {
    logger.error("media.release_failed", error);
  }
}

// ───────── 1. subida ─────────

export async function createImageUpload(
  eventRef: string,
  input: { filename: unknown; mimeType: unknown; sizeBytes: unknown },
  deps: MediaServiceDeps = defaultDeps,
): Promise<MediaServiceOutcome<{ upload: UploadTicket }>> {
  return withOwnedEvent<{ upload: UploadTicket }>(eventRef, deps, async ({ userId, eventId }) => {
    const storage = deps.storage();
    if (!storage) return { result: fail("not_configured", mediaMessages.notConfigured) };
    // Protección de abuso: cada URL firmada crea un registro y habilita una escritura en el bucket.
    if (deps.isRateLimited && (await deps.isRateLimited(userId))) return { result: fail("rate_limited", rateLimitMessage) };

    const mimeType = typeof input.mimeType === "string" ? input.mimeType : "";
    const sizeBytes = typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes) ? Math.floor(input.sizeBytes) : 0;
    const problem = validateImageMeta({ type: mimeType, size: sizeBytes });
    if (problem) return { result: fail(sizeBytes > MEDIA_LIMITS.maxBytes ? "too_large" : "unsupported", problem) };

    const storageKey = deps.newKey({ userId, eventId, mimeType: mimeType as AcceptedImageMime });
    const asset = await deps.repo.createPending({ ownerId: userId, eventId, storageKey, mimeType, originalFilename: sanitizeFilename(typeof input.filename === "string" ? input.filename : ""), sizeBytes });
    try {
      const target = await storage.createUploadTarget({ key: storageKey, mimeType, sizeBytes });
      return { result: { ok: true, upload: { mediaAssetId: asset.id, url: target.url, method: target.method, headers: target.headers } } };
    } catch (error) {
      await deps.repo.markDeleted(asset.id); // sin objeto: no queda un PENDING colgado
      throw error;
    }
  });
}

/** Verifica el objeto REAL subido (tamaño, tipo por firma, dimensiones) y solo entonces lo declara READY. Idempotente. */
export async function finalizeImageUpload(
  eventRef: string,
  assetId: unknown,
  deps: MediaServiceDeps = defaultDeps,
): Promise<MediaServiceOutcome<{ image: ImageRef }>> {
  return withOwnedEvent<{ image: ImageRef }>(eventRef, deps, async (ctx) => {
    if (typeof assetId !== "string" || !ASSET_ID.test(assetId)) return { result: denied };
    const asset = await deps.repo.findOwned(ctx.userId, ctx.eventId, assetId);
    if (!asset) return { result: denied };
    if (asset.status === "DELETED") return { result: fail("not_found", mediaMessages.deleted) };
    if (asset.status === "READY") return { result: { ok: true, image: imageOf(deps, asset, "") } }; // reintento: mismo archivo, sin duplicar

    const storage = deps.storage();
    if (!storage) return { result: fail("not_configured", mediaMessages.notConfigured) };

    const reject = async (code: MediaErrorCode, message: string): Promise<MediaServiceOutcome<{ image: ImageRef }>> => {
      // Objeto no válido: se borra el binario y el registro queda retirado. Un nuevo intento crea un archivo NUEVO.
      await storage.delete(asset.storageKey).catch(() => undefined);
      await deps.repo.markDeleted(asset.id);
      return { result: fail(code, message) };
    };

    const stored = await storage.head(asset.storageKey);
    if (!stored) return { result: fail("error", mediaMessages.interrupted) }; // la subida no llegó: sigue PENDING, se puede reintentar
    if (stored.sizeBytes <= 0) return reject("invalid", mediaMessages.empty);
    if (stored.sizeBytes > MEDIA_LIMITS.maxBytes) return reject("too_large", mediaMessages.tooLarge);

    const head = await storage.readStart(asset.storageKey, INSPECT_BYTES);
    if (!head) return { result: fail("error", mediaMessages.interrupted) };
    const inspected = inspectImage(head);
    if (!inspected.ok) {
      if (inspected.reason === "type") return reject("unsupported", mediaMessages.badType);
      return reject("invalid", inspected.reason === "pixels" ? mediaMessages.tooManyPixels : mediaMessages.unreadable);
    }
    // El tipo REAL debe coincidir con el que se firmó (Content-Type del objeto y extensión de la clave).
    if (inspected.image.mime !== asset.mimeType) return reject("unsupported", mediaMessages.badType);

    // PRIVACIDAD (preproducción): antes de declarar lista la imagen se eliminan EXIF/GPS y demás metadatos (y se gira si hace falta). El
    // objeto original solo existe mientras la imagen está PENDING (clave aleatoria, sin referencias en ninguna invitación).
    const original = await storage.readAll(asset.storageKey);
    if (!original) return { result: fail("error", mediaMessages.interrupted) };
    const normalized = await (deps.normalize ?? normalizeImage)(original, inspected.image.mime);
    if (!normalized.ok) return reject("invalid", mediaMessages.unprocessable);
    let { width, height } = inspected.image;
    let sizeBytes = stored.sizeBytes;
    if (normalized.changed) {
      const reinspected = inspectImage(normalized.bytes.subarray(0, INSPECT_BYTES));
      if (!reinspected.ok || reinspected.image.mime !== inspected.image.mime) return reject("invalid", mediaMessages.unprocessable);
      await storage.writeObject(asset.storageKey, normalized.bytes, { mimeType: inspected.image.mime });
      ({ width, height } = reinspected.image);
      sizeBytes = normalized.bytes.byteLength;
    }

    const ready = await deps.repo.markReady(asset.id, { mimeType: inspected.image.mime, sizeBytes, width, height });
    if (!ready || ready.status !== "READY") return { result: fail("error", mediaMessages.saveFailed) };
    return { result: { ok: true, image: imageOf(deps, ready, "") } };
  });
}

/** Elimina un archivo que NO está en uso (p. ej. subida cancelada). Si está referenciado no se toca. */
export async function deleteMediaAsset(eventRef: string, assetId: unknown, deps: MediaServiceDeps = defaultDeps): Promise<MediaServiceOutcome> {
  return withOwnedEvent<object>(eventRef, deps, async (ctx) => {
    if (typeof assetId !== "string" || !ASSET_ID.test(assetId)) return { result: denied };
    const asset = await deps.repo.findOwned(ctx.userId, ctx.eventId, assetId);
    if (!asset) return { result: denied };
    if (asset.status === "DELETED") return { result: { ok: true } };
    if ((await deps.repo.countReferences(asset.id)) > 0) return { result: fail("in_use", "Esta imagen se está usando en la invitación. Quítala primero desde su sección.") };
    await deps.storage()?.delete(asset.storageKey);
    await deps.repo.markDeleted(asset.id);
    return { result: { ok: true } };
  });
}

// ───────── 2. asociar a la invitación ─────────

/** Archivo listo, del usuario y del evento; si no, `undefined`. */
async function readyAsset(deps: MediaServiceDeps, ctx: Ctx, assetId: unknown): Promise<MediaAssetRecord | undefined> {
  if (typeof assetId !== "string" || !ASSET_ID.test(assetId)) return undefined;
  const asset = await deps.repo.findOwned(ctx.userId, ctx.eventId, assetId);
  return asset && asset.status === "READY" ? asset : undefined;
}

export async function attachCoverImage(eventRef: string, assetId: unknown, alt: unknown, deps: MediaServiceDeps = defaultDeps): Promise<MediaServiceOutcome<{ image: ImageRef; revision: number }>> {
  return withOwnedEvent<{ image: ImageRef; revision: number }>(eventRef, deps, async (ctx) => {
    const asset = await readyAsset(deps, ctx, assetId);
    if (!asset) return { result: denied };
    const cleanAlt = sanitizeAlt(alt);
    const change = await deps.repo.setCover(ctx.userId, ctx.eventId, asset.id, cleanAlt);
    if (!change) return { result: denied };
    if (change.previousAssetId !== asset.id) await releaseIfUnused(deps, ctx, change.previousAssetId); // reemplazar = clave nueva; la anterior se retira
    return { result: { ok: true, image: imageOf(deps, asset, cleanAlt), revision: change.revision }, revalidate: await slugFor(deps, ctx) };
  });
}

export async function removeCoverImage(eventRef: string, deps: MediaServiceDeps = defaultDeps): Promise<MediaServiceOutcome<{ revision: number }>> {
  return withOwnedEvent<{ revision: number }>(eventRef, deps, async (ctx) => {
    const change = await deps.repo.setCover(ctx.userId, ctx.eventId, null, "");
    if (!change) return { result: denied };
    await releaseIfUnused(deps, ctx, change.previousAssetId);
    return { result: { ok: true, revision: change.revision }, revalidate: await slugFor(deps, ctx) };
  });
}

export async function attachLocationImage(eventRef: string, locationId: unknown, assetId: unknown, alt: unknown, deps: MediaServiceDeps = defaultDeps): Promise<MediaServiceOutcome<{ image: ImageRef; revision: number }>> {
  return withOwnedEvent<{ image: ImageRef; revision: number }>(eventRef, deps, async (ctx) => {
    const asset = await readyAsset(deps, ctx, assetId);
    if (!asset || typeof locationId !== "string" || !ASSET_ID.test(locationId)) return { result: denied };
    const cleanAlt = sanitizeAlt(alt);
    const change = await deps.repo.setLocationImage(ctx.userId, ctx.eventId, locationId, asset.id, cleanAlt);
    if (!change) return { result: denied };
    if (change.previousAssetId !== asset.id) await releaseIfUnused(deps, ctx, change.previousAssetId);
    return { result: { ok: true, image: imageOf(deps, asset, cleanAlt), revision: change.revision }, revalidate: await slugFor(deps, ctx) };
  });
}

export async function removeLocationImage(eventRef: string, locationId: unknown, deps: MediaServiceDeps = defaultDeps): Promise<MediaServiceOutcome<{ revision: number }>> {
  return withOwnedEvent<{ revision: number }>(eventRef, deps, async (ctx) => {
    if (typeof locationId !== "string" || !ASSET_ID.test(locationId)) return { result: denied };
    const change = await deps.repo.setLocationImage(ctx.userId, ctx.eventId, locationId, null, "");
    if (!change) return { result: denied };
    await releaseIfUnused(deps, ctx, change.previousAssetId);
    return { result: { ok: true, revision: change.revision }, revalidate: await slugFor(deps, ctx) };
  });
}

export async function addGalleryImage(eventRef: string, assetId: unknown, alt: unknown, deps: MediaServiceDeps = defaultDeps): Promise<MediaServiceOutcome<{ item: GalleryImage; revision: number }>> {
  return withOwnedEvent<{ item: GalleryImage; revision: number }>(eventRef, deps, async (ctx) => {
    const asset = await readyAsset(deps, ctx, assetId);
    if (!asset) return { result: denied };
    // Un archivo, una imagen de galería: nunca dos filas para el mismo archivo.
    if ((await deps.repo.countReferences(asset.id)) > 0) return { result: fail("in_use", "Esta imagen ya está en la invitación.") };
    // Autoridad del plan (D-31): con el cupo lleno no se añade; las imágenes existentes se conservan y se pueden quitar.
    const limit = await deps.checkGalleryLimit(ctx.userId, ctx.eventId);
    if (!limit.ok) return { result: fail("limit_reached", `${limit.message} Quita alguna imagen o mejora tu evento para añadir más.`) };
    const cleanAlt = sanitizeAlt(alt);
    const row = await deps.repo.addGalleryImage(ctx.userId, ctx.eventId, asset.id, cleanAlt);
    if (!row) return { result: denied };
    return { result: { ok: true, item: { id: row.id, ...imageOf(deps, asset, cleanAlt) }, revision: row.revision }, revalidate: await slugFor(deps, ctx) };
  });
}

/** Quita una imagen de la galería (estática o propia). Si era un archivo propio y ya nada lo usa, se borra el binario. */
export async function removeGalleryImage(eventRef: string, galleryId: unknown, deps: MediaServiceDeps = defaultDeps): Promise<MediaServiceOutcome<{ revision: number }>> {
  return withOwnedEvent<{ revision: number }>(eventRef, deps, async (ctx) => {
    if (typeof galleryId !== "string" || !ASSET_ID.test(galleryId)) return { result: denied };
    const removed = await deps.repo.removeGalleryImage(ctx.userId, ctx.eventId, galleryId);
    if (!removed) return { result: denied };
    await releaseIfUnused(deps, ctx, removed.assetId);
    return { result: { ok: true, revision: removed.revision }, revalidate: await slugFor(deps, ctx) };
  });
}

/**
 * Libera (borra el binario y retira el registro) los archivos indicados SI ya nada los referencia: ni el borrador
 * ni la publicación VIGENTE (D-29). La usan el guardado del borrador (sedes eliminadas) y la publicación (archivos
 * que la versión nueva ya no usa). Nunca falla: un problema del almacenamiento solo deja un huérfano registrado.
 */
export async function releaseUnusedMedia(userId: string, eventId: string, assetIds: readonly string[], deps: MediaServiceDeps = defaultDeps): Promise<void> {
  for (const assetId of assetIds) await releaseIfUnused(deps, { userId, eventId }, assetId);
}
