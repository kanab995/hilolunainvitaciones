import { MEDIA_LIMITS, validateImageMeta } from "@/lib/media/limits";

/**
 * Imágenes LOCALES solo para la vista previa: las de campos que aún no se guardan (ilustración del dress
 * code, sedes nuevas del borrador…). NO se sube nada. Las imágenes de portada, galería y sedes guardadas
 * se gestionan como archivos persistentes (`components/editor/use-media-controller.ts`).
 * Se crean con `URL.createObjectURL` y se REVOCAN al sustituirlas, eliminarlas o al salir del editor.
 */
export const ACCEPTED_IMAGE_TYPES = MEDIA_LIMITS.acceptedMimeTypes;
export const MAX_IMAGE_BYTES = MEDIA_LIMITS.maxBytes;

export const LOCAL_IMAGE_NOTICE = "Solo vista previa — aún no se guarda.";

/** Mismas reglas que el servidor (tipos y tamaño); el servidor es quien decide. */
export const validateImageFile = validateImageMeta;

export const isLocalImageUrl = (src: string | undefined): src is string => typeof src === "string" && src.startsWith("blob:");

interface UrlApi {
  createObjectURL(object: Blob): string;
  revokeObjectURL(url: string): void;
}

/** Registro de las URL de objeto activas: garantiza que cada una se revoque una sola vez. */
export function createObjectUrlRegistry(api: UrlApi = URL) {
  const active = new Set<string>();
  return {
    create(file: Blob): string {
      const url = api.createObjectURL(file);
      active.add(url);
      return url;
    },
    /** Revoca una URL creada por este registro (ignora las que no lo son, p. ej. assets de `/public`). */
    revoke(url: string | undefined): void {
      if (url && active.delete(url)) api.revokeObjectURL(url);
    },
    revokeAll(): void {
      for (const url of active) api.revokeObjectURL(url);
      active.clear();
    },
    has: (url: string) => active.has(url),
    get size() {
      return active.size;
    },
  };
}

export type ObjectUrlRegistry = ReturnType<typeof createObjectUrlRegistry>;
