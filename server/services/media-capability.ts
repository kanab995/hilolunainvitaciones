import { mediaMessages } from "@/lib/media/limits";
import { getDataSource } from "@/server/data-source";
import { isStorageConfigured } from "@/server/storage/config";
import type { MediaCapability } from "@/types/media";

/**
 * ¿Puede este entorno subir imágenes de verdad? Hace falta almacenamiento configurado Y base de datos (el
 * archivo necesita su registro). Si no, el editor desactiva la carga con un mensaje claro: nunca finge que
 * guardó y nunca escribe en /public. El resultado es un booleano y un texto: ningún detalle de configuración
 * llega al navegador.
 */
export function getMediaCapability(env: Record<string, string | undefined> = process.env): MediaCapability {
  const persisted = getDataSource(env) === "database";
  if (!persisted || !isStorageConfigured(env)) return { enabled: false, persisted, reason: mediaMessages.notConfigured };
  return { enabled: true, persisted };
}
