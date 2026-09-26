import { readStorageConfig } from "@/server/storage/config";

/**
 * URL pública de un archivo: DERIVADA de `storageKey` + la base pública configurada. Nunca se guarda en la BD
 * (así se puede pasar a media.hiloluna.com sin migrar datos) y nunca es una URL firmada.
 */
export function buildMediaUrl(publicBaseUrl: string, storageKey: string): string {
  const base = publicBaseUrl.replace(/\/+$/, "");
  return `${base}/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}

/** URL de una clave con la configuración del entorno, o `undefined` si no hay almacenamiento configurado. */
export function getMediaUrl(storageKey: string): string | undefined {
  const config = readStorageConfig();
  return config ? buildMediaUrl(config.publicBaseUrl, storageKey) : undefined;
}
