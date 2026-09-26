import { notFound, redirect } from "next/navigation";
import { requireOwnedEvent } from "@/server/auth/ownership";
import { getOwnedInvitation } from "@/server/repositories/invitations";
import { getOwnedDraftMeta } from "@/server/repositories/publishing";
import { getMediaCapability } from "@/server/services/media-capability";
import type { Invitation } from "@/types/invitation";
import type { MediaCapability } from "@/types/media";
import type { PublicationInfo } from "@/types/published";

/**
 * Carga del evento que se edita: LECTURA real (evento + invitación persistidos) con sesión y propiedad
 * comprobadas; la escritura sigue siendo simulada (autoguardado local, docs/ARCHITECTURE.md §4.10). El
 * editor recibe el resultado por props y no sabe de dónde viene.
 */
export interface EditorEvent {
  id: string;
  /** Nombre del evento en la barra superior ("Boda de Andrea & Fernando"). */
  title: string;
  invitation: Invitation;
  /** ¿Se pueden subir imágenes de verdad? (almacenamiento + base de datos). Sin detalles de configuración. */
  media: MediaCapability;
  /** Revisión del borrador y estado de publicación (D-29). El guardado real solo existe con base de datos (`media.persisted`). */
  revision: number;
  publishedRevision: number;
  publication: PublicationInfo;
  /** Slug público de la invitación (URL estable: publicar no lo cambia). */
  slug: string;
}

/** Sesión + propiedad + invitación; `notFound()` si el evento no es del usuario o no existe. */
async function loadOwnedEditorEvent(ref: string): Promise<EditorEvent> {
  const { user, event } = await requireOwnedEvent(ref);
  const [invitation, meta] = await Promise.all([getOwnedInvitation(user.id, event.id), getOwnedDraftMeta(user.id, event.id)]);
  if (!invitation || !meta) notFound();
  return { id: event.id, title: event.type === "wedding" ? `Boda de ${event.title}` : event.title, invitation, media: getMediaCapability(), revision: meta.revision, publishedRevision: meta.publishedRevision, publication: meta.publication, slug: meta.slug };
}

/** Para las páginas: redirige a la URL canónica si `ref` no es el id (id, slug o alias `demo`). */
export async function loadEditorPage(ref: string, pathFor: (eventId: string) => string): Promise<EditorEvent> {
  const event = await loadOwnedEditorEvent(ref);
  if (event.id !== ref) redirect(pathFor(event.id));
  return event;
}

/** Para la vista previa (iframe): mismas comprobaciones, sin redirigir. */
export async function loadPreviewEvent(ref: string): Promise<EditorEvent> {
  return loadOwnedEditorEvent(ref);
}
