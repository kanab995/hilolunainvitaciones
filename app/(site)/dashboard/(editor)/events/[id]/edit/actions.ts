"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/lib/routes";
import { saveInvitationDraft } from "@/server/services/draft-service";
import { publishInvitationForOwner } from "@/server/services/publish-service";
import type { PublishResult, SaveDraftResult } from "@/types/draft-sync";
import {
  addGalleryImage,
  attachCoverImage,
  attachLocationImage,
  createImageUpload,
  deleteMediaAsset,
  finalizeImageUpload,
  removeCoverImage,
  removeGalleryImage,
  removeLocationImage,
  type MediaServiceOutcome,
} from "@/server/services/media-service";
import type { MediaResult } from "@/types/media";

/**
 * SERVER ACTIONS de las imágenes del editor. Finas: delegan en `server/services/media-service.ts` (sesión →
 * usuario → propiedad del evento → archivo del usuario → validación → escritura) y revalidan la página pública (no la del editor: recargarla pisaría el borrador en curso).
 * NUNCA aceptan propietario, clave de objeto, tipo verificado ni URL del cliente; `eventId` y los ids son solo
 * referencias que el servidor comprueba en la propia consulta.
 */
function finish<T extends object>({ result, revalidate }: MediaServiceOutcome<T>): MediaResult<T> {
  if (result.ok && revalidate) {
    if (revalidate.slug) revalidatePath(routes.invitation(revalidate.slug)); // la invitación pública muestra la imagen persistida
  }
  return result;
}

export async function requestImageUploadAction(eventId: string, file: { name: string; type: string; size: number }) {
  return finish(await createImageUpload(eventId, { filename: file?.name, mimeType: file?.type, sizeBytes: file?.size }));
}

export async function finalizeImageUploadAction(eventId: string, mediaAssetId: string) {
  return finish(await finalizeImageUpload(eventId, mediaAssetId));
}

export async function discardImageAction(eventId: string, mediaAssetId: string) {
  return finish(await deleteMediaAsset(eventId, mediaAssetId));
}

export async function setCoverImageAction(eventId: string, mediaAssetId: string, alt: string) {
  return finish(await attachCoverImage(eventId, mediaAssetId, alt));
}

export async function removeCoverImageAction(eventId: string) {
  return finish(await removeCoverImage(eventId));
}

export async function setLocationImageAction(eventId: string, locationId: string, mediaAssetId: string, alt: string) {
  return finish(await attachLocationImage(eventId, locationId, mediaAssetId, alt));
}

export async function removeLocationImageAction(eventId: string, locationId: string) {
  return finish(await removeLocationImage(eventId, locationId));
}

export async function addGalleryImageAction(eventId: string, mediaAssetId: string, alt: string) {
  return finish(await addGalleryImage(eventId, mediaAssetId, alt));
}

export async function removeGalleryImageAction(eventId: string, galleryId: string) {
  return finish(await removeGalleryImage(eventId, galleryId));
}

/**
 * GUARDADO REAL del borrador (D-29). Fina: todo el dominio vive en `server/services/draft-service.ts`. El payload es
 * un DTO explícito (`lib/editor/draft-payload.ts`); llega como `unknown` y el servicio aplica una lista blanca.
 */
export async function saveDraftAction(eventId: string, payload: unknown): Promise<SaveDraftResult> {
  return saveInvitationDraft(eventId, payload);
}

/** PUBLICACIÓN real (D-29): solo el propietario. Revalida la invitación pública (`/i/[slug]`) al publicar una versión nueva. */
export async function publishInvitationAction(eventId: string, expectedRevision: number): Promise<PublishResult> {
  const { result, revalidate } = await publishInvitationForOwner(eventId, { expectedRevision });
  if (revalidate) {
    revalidatePath(routes.invitation(revalidate.slug));
    revalidatePath(routes.events);
  }
  return result;
}
