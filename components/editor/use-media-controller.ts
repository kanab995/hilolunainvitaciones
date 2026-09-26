"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addGalleryImageAction,
  discardImageAction,
  finalizeImageUploadAction,
  removeCoverImageAction,
  removeGalleryImageAction,
  removeLocationImageAction,
  requestImageUploadAction,
  setCoverImageAction,
  setLocationImageAction,
} from "@/app/(site)/dashboard/(editor)/events/[id]/edit/actions";
import type { DraftApi } from "@/components/editor/use-invitation-draft";
import { putFile, UploadError } from "@/lib/editor/media-upload";
import type { SyncQueue } from "@/lib/editor/sync-queue";
import { mediaMessages, validateImageMeta } from "@/lib/media/limits";
import type { GalleryImage, Invitation } from "@/types/invitation";
import type { MediaCapability, MediaResult } from "@/types/media";

/**
 * CONTROLADOR DE IMÁGENES DEL EDITOR. Orquesta: validar (respuesta rápida) → pedir permiso de subida →
 * enviar el binario con progreso real → verificar en el servidor → asociar a la invitación → actualizar el
 * borrador. Solo conoce Server Actions y ids: nunca bucket, claves, endpoint ni credenciales. Las
 * operaciones que escriben en el servidor van en cola (una a la vez) para que el orden sea determinista.
 */
export type TargetPhase = "idle" | "uploading" | "processing" | "saved" | "error";

export interface TargetStatus {
  phase: TargetPhase;
  /** 0–1, solo con `uploading` y solo si el navegador informa de bytes reales. */
  progress?: number;
  message?: string;
}

const IDLE: TargetStatus = { phase: "idle" };

/** Lo que necesita un campo de imagen gestionada (portada, sede…). */
export interface ManagedPhoto {
  status: TargetStatus;
  /** Se puede subir (almacenamiento + base de datos). Si no, el campo muestra `disabledReason`. */
  enabled: boolean;
  disabledReason?: string;
  onFile: (file: File) => void;
  onRemove: () => void;
}

export interface MediaController {
  cover: ManagedPhoto;
  /** Imagen de una sede. Si la sede es nueva, se guarda el borrador antes de subir. */
  location: (locationId: string) => ManagedPhoto;
  gallery: {
    status: TargetStatus;
    enabled: boolean;
    disabledReason?: string;
    add: (file: File) => void;
    remove: (galleryId: string) => void;
    removeStatus: (galleryId: string) => TargetStatus;
  };
}

/** Estado de ejecución que no se dibuja: si el editor sigue montado (la cola de operaciones es la del editor, `SyncQueue`). */
class MediaRuntime {
  private mounted = true;
  mount() {
    this.mounted = true;
  }
  unmount() {
    this.mounted = false;
  }
  isMounted() {
    return this.mounted;
  }
}

const FAILED = (message: string): TargetStatus => ({ phase: "error", message });

export function useMediaController({
  eventId,
  capability,
  draft,
  api,
  queue,
  ensureSaved,
  onSynced,
}: {
  eventId: string;
  capability: MediaCapability;
  draft: Invitation;
  api: DraftApi;
  /** Cola única del editor: guardado del borrador, imágenes y publicación se ejecutan de una en una (D-29). */
  queue: SyncQueue;
  /** Guarda lo pendiente del borrador y dice si quedó guardado (una sede nueva debe existir antes de recibir una imagen). */
  ensureSaved: () => Promise<boolean>;
  /** Avisa de que una operación del servidor cambió la revisión del borrador (`queue.getRevision()` ya está actualizada). */
  onSynced: () => void;
}): MediaController {
  const [statuses, setStatuses] = useState<Record<string, TargetStatus>>({});
  const [runtime] = useState(() => new MediaRuntime());

  useEffect(() => {
    runtime.mount();
    return () => runtime.unmount();
  }, [runtime]);

  const setStatus = useCallback(
    (key: string, status: TargetStatus) => {
      if (runtime.isMounted()) setStatuses((previous) => ({ ...previous, [key]: status }));
    },
    [runtime],
  );
  const busy = useCallback(
    (key: string) => {
      const phase = statuses[key]?.phase;
      return phase === "uploading" || phase === "processing";
    },
    [statuses],
  );

  /** Sube y verifica el archivo; devuelve el id del archivo listo o `undefined` (con el error ya mostrado). */
  const uploadFile = useCallback(
    async (key: string, file: File): Promise<string | undefined> => {
      const problem = validateImageMeta(file);
      if (problem) {
        setStatus(key, FAILED(problem));
        return undefined;
      }
      setStatus(key, { phase: "uploading" });
      let assetId: string | undefined;
      try {
        const requested = await requestImageUploadAction(eventId, { name: file.name, type: file.type, size: file.size });
        if (!requested.ok) {
          setStatus(key, FAILED(requested.message));
          return undefined;
        }
        assetId = requested.upload.mediaAssetId;
        await putFile(requested.upload, file, { onProgress: (progress) => setStatus(key, { phase: "uploading", progress }) });
        setStatus(key, { phase: "processing" });
        const finalized = await finalizeImageUploadAction(eventId, assetId);
        if (!finalized.ok) {
          void discardImageAction(eventId, assetId).catch(() => undefined);
          setStatus(key, FAILED(finalized.message));
          return undefined;
        }
        return assetId;
      } catch (error) {
        if (assetId) void discardImageAction(eventId, assetId).catch(() => undefined);
        setStatus(key, FAILED(error instanceof UploadError ? error.message : mediaMessages.uploadFailed));
        return undefined;
      }
    },
    [eventId, setStatus],
  );

  /** Ejecuta un paso del servidor en cola; convierte cualquier fallo de red en un mensaje humano. */
  const serverStep = useCallback(
    async <T extends object>(key: string, step: () => Promise<MediaResult<T>>): Promise<(T & { ok: true }) | undefined> => {
      try {
        const result = await queue.enqueue(step);
        if (result.ok) {
          // Toda operación de imágenes cambia el borrador: la revisión nueva viaja en la respuesta.
          if ("revision" in result && typeof result.revision === "number") queue.advance(result.revision);
          onSynced();
          return result;
        }
        setStatus(key, FAILED(result.message));
      } catch {
        setStatus(key, FAILED(mediaMessages.saveFailed));
      }
      return undefined;
    },
    [onSynced, queue, setStatus],
  );

  const uploadAndAttach = useCallback(
    async <T extends object>(key: string, file: File, attach: (assetId: string) => Promise<MediaResult<T>>): Promise<(T & { ok: true }) | undefined> => {
      if (busy(key)) return undefined;
      const assetId = await uploadFile(key, file);
      if (!assetId) return undefined;
      setStatus(key, { phase: "processing" });
      const attached = await serverStep(key, () => attach(assetId));
      if (!attached) {
        void discardImageAction(eventId, assetId).catch(() => undefined); // no quedó en la invitación: no se deja huérfano
        return undefined;
      }
      setStatus(key, { phase: "saved" });
      return attached;
    },
    [busy, eventId, serverStep, setStatus, uploadFile],
  );

  const remove = useCallback(
    async (key: string, step: () => Promise<MediaResult>, onDone: () => void) => {
      if (busy(key)) return;
      setStatus(key, { phase: "processing" });
      if (await serverStep(key, step)) {
        onDone();
        setStatus(key, IDLE);
      }
    },
    [busy, serverStep, setStatus],
  );

  const persisted = capability.persisted;

  // Manejadores estables: leen el borrador más reciente por referencia (nunca un valor viejo).
  const uploadCover = useCallback(
    async (file: File) => {
      const alt = draft.cover.photo?.alt || "Foto de portada";
      const attached = await uploadAndAttach("cover", file, (assetId) => setCoverImageAction(eventId, assetId, alt));
      if (attached) api.updateInvitation((d) => ({ cover: { ...d.cover, photo: attached.image } }));
    },
    [api, draft, eventId, uploadAndAttach],
  );

  const removeCover = useCallback(() => {
    const removeLocally = () => api.updateInvitation((d) => ({ cover: { ...d.cover, photo: undefined } }));
    if (draft.cover.photo?.mediaAssetId && persisted) void remove("cover", () => removeCoverImageAction(eventId), removeLocally);
    else removeLocally();
  }, [api, draft, eventId, persisted, remove]);

  const uploadLocation = useCallback(
    async (locationId: string, file: File) => {
      // Una sede NUEVA del borrador todavía no existe en la base de datos: primero se guarda.
      if (!(await ensureSaved())) {
        setStatus(`location:${locationId}`, FAILED("Guarda los cambios de la sede antes de subir su imagen."));
        return;
      }
      const current = draft.locations.find((item) => item.id === locationId);
      const alt = current?.photo?.alt || `Imagen de ${current?.name || "la sede"}`;
      const attached = await uploadAndAttach(`location:${locationId}`, file, (assetId) => setLocationImageAction(eventId, locationId, assetId, alt));
      if (attached) api.lists.locations.patch(locationId, { photo: attached.image });
    },
    [api, draft, ensureSaved, eventId, setStatus, uploadAndAttach],
  );

  const removeLocation = useCallback(
    (locationId: string) => {
      const removeLocally = () => api.lists.locations.patch(locationId, { photo: undefined });
      const managed = draft.locations.find((item) => item.id === locationId)?.photo?.mediaAssetId;
      if (managed && persisted) void remove(`location:${locationId}`, () => removeLocationImageAction(eventId, locationId), removeLocally);
      else removeLocally();
    },
    [api, draft, eventId, persisted, remove],
  );

  const addGallery = useCallback(
    async (file: File) => {
      const attached = await uploadAndAttach<{ item: GalleryImage }>("gallery", file, (assetId) => addGalleryImageAction(eventId, assetId, ""));
      if (attached) api.lists.gallery.add(attached.item);
    },
    [api, eventId, uploadAndAttach],
  );

  const removeGallery = useCallback(
    (galleryId: string) => {
      const removeLocally = () => api.lists.gallery.remove(galleryId);
      if (persisted) void remove(`gallery:${galleryId}`, () => removeGalleryImageAction(eventId, galleryId), removeLocally);
      else removeLocally();
    },
    [api, eventId, persisted, remove],
  );

  const disabledReason = capability.reason ?? mediaMessages.notConfigured;
  const enabled = capability.enabled;

  return useMemo<MediaController>(() => {
    const photo = (key: string, onFile: (file: File) => void, onRemove: () => void): ManagedPhoto => ({
      status: statuses[key] ?? IDLE,
      enabled,
      disabledReason: enabled ? undefined : disabledReason,
      onFile,
      onRemove,
    });

    return {
      cover: photo(
        "cover",
        (file) => void uploadCover(file),
        () => removeCover(),
      ),
      location: (locationId) =>
        photo(
          `location:${locationId}`,
          (file) => void uploadLocation(locationId, file),
          () => removeLocation(locationId),
        ),
      gallery: {
        status: statuses.gallery ?? IDLE,
        enabled,
        disabledReason: enabled ? undefined : disabledReason,
        add: (file) => void addGallery(file),
        remove: (galleryId) => removeGallery(galleryId),
        removeStatus: (galleryId) => statuses[`gallery:${galleryId}`] ?? IDLE,
      },
    };
  }, [addGallery, disabledReason, enabled, removeCover, removeGallery, removeLocation, statuses, uploadCover, uploadLocation]);
}
