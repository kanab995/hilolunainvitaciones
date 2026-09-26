import { readStorageConfig } from "@/server/storage/config";
import type { StorageProvider } from "@/server/storage/provider";
import { createS3Provider } from "@/server/storage/s3-provider";

export type { StorageProvider, UploadTarget } from "@/server/storage/provider";
export { isStorageConfigured } from "@/server/storage/config";
export { getMediaUrl } from "@/server/storage/public-url";

let cached: { signature: string; provider: StorageProvider } | undefined;

/** Proveedor del entorno, o `undefined` si el almacenamiento no está configurado (subidas desactivadas). */
export function getStorageProvider(): StorageProvider | undefined {
  const config = readStorageConfig();
  if (!config) return undefined;
  const signature = [config.endpoint, config.region, config.bucket, config.accessKeyId].join("|");
  if (cached?.signature !== signature) cached = { signature, provider: createS3Provider(config) };
  return cached.provider;
}
