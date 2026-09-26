/**
 * LÍMITES Y TEXTOS DE LOS ARCHIVOS (imágenes) — compartidos entre el navegador (respuesta rápida) y el
 * servidor (la ÚNICA autoridad: nunca se confía en lo que diga el cliente). Sin dependencias.
 *
 * Decisiones (docs/ARCHITECTURE.md D-27):
 *  - Tipos: JPEG, PNG y WEBP. SVG bloqueado (puede llevar scripts). GIF y AVIF fuera de esta fase (sin
 *    necesidad concreta y sin procesado que los verifique).
 *  - 10 MB por imagen original; 40 megapíxeles como máximo (una imagen de 40 MP ocupa ≈ 160 MB
 *    descomprimida: por encima, el optimizador de imágenes puede agotar la memoria).
 */
export const MEDIA_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxMegapixels: 40,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  filenameMaxLength: 120,
} as const;

export type AcceptedImageMime = (typeof MEDIA_LIMITS.acceptedMimeTypes)[number];

export const mediaMessages = {
  tooLarge: "La imagen supera el tamaño máximo permitido.",
  badType: "Usa una imagen JPG, PNG o WEBP.",
  empty: "El archivo está vacío.",
  tooManyPixels: "La imagen tiene una resolución demasiado alta.",
  unreadable: "No pudimos leer la imagen. Prueba con otro archivo.",
  unprocessable: "No pudimos procesar la imagen. Prueba con otra o guárdala de nuevo como JPG.",
  notConfigured: "La carga de imágenes no está disponible en este entorno.",
  uploadFailed: "No se pudo subir la imagen. Inténtalo de nuevo.",
  interrupted: "La subida se interrumpió. Inténtalo de nuevo.",
  saveFailed: "No pudimos guardar la imagen. Inténtalo de nuevo.",
  denied: "No encontramos este evento o esta imagen.",
  unauthenticated: "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
  deleted: "Esta imagen ya no está disponible.",
} as const;

/** Validación rápida del cliente (el servidor repite y decide). Devuelve un mensaje humano o `undefined`. */
export function validateImageMeta(file: { type: string; size: number }): string | undefined {
  if (!(MEDIA_LIMITS.acceptedMimeTypes as readonly string[]).includes(file.type)) return mediaMessages.badType;
  if (file.size <= 0) return mediaMessages.empty;
  if (file.size > MEDIA_LIMITS.maxBytes) return mediaMessages.tooLarge;
  return undefined;
}

/** Nombre de archivo SOLO informativo: sin rutas, sin caracteres de control ni marcado, longitud acotada. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return "imagen";
  if (cleaned.length <= MEDIA_LIMITS.filenameMaxLength) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 8 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, MEDIA_LIMITS.filenameMaxLength - ext.length) + ext;
}
