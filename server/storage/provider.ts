/**
 * PROVEEDOR DE ALMACENAMIENTO: la única superficie que el resto del servidor conoce. Ningún componente ni
 * servicio sabe si detrás hay Cloudflare R2, MinIO o un doble de pruebas. Cambiar de proveedor = otra
 * implementación de esta interfaz.
 */
export interface UploadTarget {
  /** URL temporal para subir el binario directamente desde el navegador (no se guarda en la BD). */
  url: string;
  method: "PUT";
  /** Cabeceras que el navegador DEBE enviar tal cual. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObjectInfo {
  sizeBytes: number;
}

export interface StorageProvider {
  createUploadTarget(input: { key: string; mimeType: string; sizeBytes: number }): Promise<UploadTarget>;
  /** Metadatos del objeto, o `undefined` si no existe. */
  head(key: string): Promise<StoredObjectInfo | undefined>;
  /** Los primeros `length` bytes del objeto (para inspeccionar tipo y dimensiones), o `undefined` si no existe. */
  readStart(key: string, length: number): Promise<Uint8Array | undefined>;
  /** El objeto completo (para normalizarlo: eliminar EXIF/GPS), o `undefined` si no existe. El llamador ya verificó que no supera el límite. */
  readAll(key: string): Promise<Uint8Array | undefined>;
  /** Reemplaza el objeto con `body` (la imagen ya normalizada). Mismas cabeceras de tipo y caché que la subida original. */
  writeObject(key: string, body: Uint8Array, options: { mimeType: string }): Promise<void>;
  /** Borra el objeto. Idempotente: borrar algo que no existe no es un error. */
  delete(key: string): Promise<void>;
}
