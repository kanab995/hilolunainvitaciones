import type { PublicationInfo, PublicationState } from "@/types/published";

/**
 * ESTADO DE PUBLICACIÓN de una invitación (D-29). Se DERIVA de columnas de `Invitation`, no se guarda aparte:
 *  - `draft`: nunca publicada, o despublicada.
 *  - `published`: publicada y sin cambios pendientes.
 *  - `changes`: publicada, pero el borrador tiene cambios guardados que aún no se publican.
 * No es `Template.publicationStatus` (visibilidad comercial de una plantilla) ni el estado de guardado del editor.
 * Una invitación PUBLISHED sin ninguna publicación (`publishedVersion = 0`) es un dato anterior a D-29 (p. ej. la
 * demostración sembrada antes): se considera publicada y sin cambios pendientes.
 */
export interface PublicationColumns {
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  draftRevision: number;
  publishedRevision: number;
  publishedVersion: number;
  publishedAt?: Date | null;
  lastPublishedAt?: Date | null;
}

export function derivePublicationState(columns: Pick<PublicationColumns, "status" | "draftRevision" | "publishedRevision" | "publishedVersion">): PublicationState {
  if (columns.status !== "PUBLISHED") return "draft";
  if (columns.publishedVersion === 0) return "published";
  return columns.draftRevision > columns.publishedRevision ? "changes" : "published";
}

export function toPublicationInfo(columns: PublicationColumns): PublicationInfo {
  return {
    state: derivePublicationState(columns),
    version: columns.publishedVersion,
    ...(columns.publishedAt ? { publishedAt: columns.publishedAt.toISOString() } : {}),
    ...(columns.lastPublishedAt ? { lastPublishedAt: columns.lastPublishedAt.toISOString() } : {}),
  };
}

/** Etiqueta visible del estado (única fuente de los textos). */
export const publicationLabels: Record<PublicationState, string> = { draft: "Borrador", published: "Publicado", changes: "Cambios sin publicar" };

/** Texto del botón principal del editor y de la lista de eventos. */
export const publishActionLabel = (state: PublicationState): string => (state === "draft" ? "Publicar" : "Publicar cambios");
