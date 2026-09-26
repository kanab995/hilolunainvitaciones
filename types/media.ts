/**
 * TIPOS COMPARTIDOS (navegador ↔ servidor) de los archivos gestionados. Ninguno contiene bucket, clave de
 * objeto, endpoint ni credenciales: el navegador solo conoce ids de `MediaAsset`, URLs públicas de lectura y la
 * URL temporal de subida que el servidor emite (nunca guardada).
 */
export type MediaErrorCode = "unauthenticated" | "not_found" | "invalid" | "too_large" | "unsupported" | "not_configured" | "unavailable" | "in_use" | "limit_reached" | "rate_limited" | "error";

export type MediaResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: MediaErrorCode; message: string };

/** Permiso para subir UN archivo: dónde y con qué cabeceras. Caduca; no se guarda. */
export interface UploadTicket {
  mediaAssetId: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

/** Objetivo de una imagen dentro de la invitación. */
export type MediaTarget = { kind: "cover" } | { kind: "gallery" } | { kind: "location"; locationId: string };

/** Cambios de metadatos (texto alternativo y orden) que el autoguardado persiste sin subir archivos. */
export interface MediaDetailsInput {
  coverAlt?: string;
  gallery?: readonly { id: string; alt: string }[];
  locations?: readonly { id: string; alt: string }[];
}

/** Qué puede hacer este entorno con las imágenes del editor. */
export interface MediaCapability {
  /** Se pueden SUBIR imágenes (almacenamiento configurado y base de datos). */
  enabled: boolean;
  /** Hay base de datos: quitar imágenes, ordenar y el texto alternativo se guardan de verdad. */
  persisted: boolean;
  /** Por qué no, en lenguaje de persona (solo si `enabled` es falso). */
  reason?: string;
}
