/**
 * CONFIGURACIÓN DEL ALMACENAMIENTO DE OBJETOS (S3 compatible: Cloudflare R2, MinIO, AWS S3…).
 * Solo servidor: la clave secreta nunca llega al navegador (ningún componente importa este módulo, y
 * ninguna de estas variables lleva el prefijo `NEXT_PUBLIC_`). Sin las seis variables el almacenamiento está
 * DESACTIVADO: las subidas se rechazan con un mensaje claro; no se escribe nunca en /public ni se finge
 * que algo se guardó.
 */
export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base pública desde la que se sirven las imágenes (p. ej. `https://media.hiloluna.com`). */
  publicBaseUrl: string;
}

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** Devuelve la configuración completa o `undefined` si falta cualquier variable o una URL es inválida. */
export function readStorageConfig(env: Env = process.env): StorageConfig | undefined {
  const endpoint = clean(env.S3_ENDPOINT);
  const bucket = clean(env.S3_BUCKET);
  const accessKeyId = clean(env.S3_ACCESS_KEY_ID);
  const secretAccessKey = clean(env.S3_SECRET_ACCESS_KEY);
  const publicBaseUrl = clean(env.S3_PUBLIC_BASE_URL);
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return undefined;
  if (!isHttpUrl(endpoint) || !isHttpUrl(publicBaseUrl)) return undefined;
  return { endpoint, region: clean(env.S3_REGION) ?? "auto", bucket, accessKeyId, secretAccessKey, publicBaseUrl };
}

export const isStorageConfigured = (env: Env = process.env): boolean => readStorageConfig(env) !== undefined;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
