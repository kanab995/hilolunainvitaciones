import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageConfig } from "@/server/storage/config";
import type { StorageProvider, StoredObjectInfo, UploadTarget } from "@/server/storage/provider";

/** Validez de la URL de subida: suficiente para una foto grande en una red lenta, corta para limitar abusos. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

const isNotFound = (error: unknown): boolean => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
};

/**
 * Implementación S3 compatible (Cloudflare R2, MinIO, AWS S3) con el SDK oficial de AWS.
 *  - `forcePathStyle`: funciona igual con R2, MinIO y servidores locales.
 *  - `requestChecksumCalculation: "WHEN_REQUIRED"`: sin esto el SDK añade un checksum a la URL firmada y los
 *    navegadores/R2 la rechazan. No se firma `Content-Length`: el tamaño real se verifica al finalizar.
 */
export function createS3Provider(config: StorageConfig): StorageProvider {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = config.bucket;

  return {
    async createUploadTarget({ key, mimeType }): Promise<UploadTarget> {
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: mimeType, CacheControl: "public, max-age=31536000, immutable" }), {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        // La cabecera de tipo y de caché se firman: el navegador debe enviarlas exactamente así.
        signableHeaders: new Set(["content-type", "cache-control"]),
      });
      return {
        url,
        method: "PUT",
        headers: { "Content-Type": mimeType, "Cache-Control": "public, max-age=31536000, immutable" },
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
      };
    },

    async head(key): Promise<StoredObjectInfo | undefined> {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { sizeBytes: result.ContentLength ?? 0 };
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },

    async readStart(key, length): Promise<Uint8Array | undefined> {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket, Key: key, Range: `bytes=0-${Math.max(0, length - 1)}` }));
        return result.Body ? await result.Body.transformToByteArray() : undefined;
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },

    async readAll(key): Promise<Uint8Array | undefined> {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return result.Body ? await result.Body.transformToByteArray() : undefined;
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },

    async writeObject(key, body, { mimeType }): Promise<void> {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: mimeType, CacheControl: "public, max-age=31536000, immutable" }));
    },

    async delete(key): Promise<void> {
      try {
        await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
  };
}
