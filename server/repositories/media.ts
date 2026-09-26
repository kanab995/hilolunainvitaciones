import type { MediaStatus } from "@prisma/client";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";

/**
 * ACCESO A DATOS de los archivos gestionados (`MediaAsset`) y de sus referencias (portada, galería, sedes).
 * TODA consulta lleva el propietario y el evento EN LA PROPIA CONSULTA (`ownerId`, `eventId`,
 * `event.ownerId`): un id ajeno es indistinguible de uno inexistente. Nada de esto se importa desde
 * componentes. Sin base de datos (origen de demostración) las operaciones se rechazan.
 */
export interface MediaAssetRecord {
  id: string;
  ownerId: string;
  eventId: string | null;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  status: MediaStatus;
}

export interface NewPendingAsset {
  ownerId: string;
  eventId: string;
  storageKey: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
}

export interface ReadyAssetData {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

/** Contrato del repositorio (lo implementa Prisma; las pruebas usan uno en memoria). */
export interface MediaRepository {
  createPending(data: NewPendingAsset): Promise<MediaAssetRecord>;
  findOwned(ownerId: string, eventId: string, assetId: string): Promise<MediaAssetRecord | undefined>;
  markReady(assetId: string, data: ReadyAssetData): Promise<MediaAssetRecord | undefined>;
  markDeleted(assetId: string): Promise<void>;
  /** Cuántas referencias tiene el archivo: portada, galería y sedes del BORRADOR + la publicación VIGENTE (D-29). */
  countReferences(assetId: string): Promise<number>;
  /** Fija (o quita con `null`) la portada. Devuelve el archivo anterior; `undefined` si la invitación no es del usuario. */
  /** Toda operación que cambia el borrador devuelve la NUEVA revisión (`draftRevision`, D-29). */
  setCover(ownerId: string, eventId: string, assetId: string | null, alt: string): Promise<{ previousAssetId: string | null; revision: number } | undefined>;
  addGalleryImage(ownerId: string, eventId: string, assetId: string, alt: string): Promise<{ id: string; revision: number } | undefined>;
  removeGalleryImage(ownerId: string, eventId: string, galleryId: string): Promise<{ assetId: string | null; revision: number } | undefined>;
  setLocationImage(ownerId: string, eventId: string, locationId: string, assetId: string | null, alt: string): Promise<{ previousAssetId: string | null; revision: number } | undefined>;
  /** Slug de la invitación del evento (para revalidar su página pública). */
  getSlug(ownerId: string, eventId: string): Promise<string | undefined>;
}

const requireDatabase = () => {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
};

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Sube la revisión del borrador (D-29) y devuelve la nueva. */
async function bumpRevision(tx: Tx, eventId: string): Promise<number> {
  const updated = await tx.invitation.update({ where: { eventId }, data: { draftRevision: { increment: 1 } }, select: { draftRevision: true } });
  return updated.draftRevision;
}

const select = { id: true, ownerId: true, eventId: true, storageKey: true, mimeType: true, sizeBytes: true, width: true, height: true, status: true } as const;

export const prismaMediaRepository: MediaRepository = {
  async createPending(data) {
    requireDatabase();
    return prisma.mediaAsset.create({ data: { ...data, type: "IMAGE", status: "PENDING" }, select });
  },

  async findOwned(ownerId, eventId, assetId) {
    requireDatabase();
    // Propietario Y evento en la consulta; un archivo eliminado no se puede volver a usar.
    return (await prisma.mediaAsset.findFirst({ where: { id: assetId, ownerId, eventId, event: { ownerId } }, select })) ?? undefined;
  },

  async markReady(assetId, data) {
    requireDatabase();
    // Solo desde PENDING: finalizar dos veces no cambia nada (idempotente) y un DELETED nunca resucita.
    await prisma.mediaAsset.updateMany({ where: { id: assetId, status: "PENDING" }, data: { ...data, status: "READY" } });
    return (await prisma.mediaAsset.findUnique({ where: { id: assetId }, select })) ?? undefined;
  },

  async markDeleted(assetId) {
    requireDatabase();
    await prisma.mediaAsset.updateMany({ where: { id: assetId }, data: { status: "DELETED" } });
  },

  async countReferences(assetId) {
    requireDatabase();
    const [covers, gallery, locations, published] = await Promise.all([
      prisma.invitation.count({ where: { coverMediaId: assetId } }),
      prisma.galleryImage.count({ where: { mediaAssetId: assetId } }),
      prisma.location.count({ where: { mediaAssetId: assetId } }),
      // Un archivo que la publicación VIGENTE usa no se puede borrar aunque el borrador ya no lo referencie.
      prisma.invitationPublication.count({ where: { isCurrent: true, mediaAssetIds: { has: assetId } } }),
    ]);
    return covers + gallery + locations + published;
  },

  async setCover(ownerId, eventId, assetId, alt) {
    requireDatabase();
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findFirst({ where: { eventId, event: { ownerId } }, select: { id: true, coverMediaId: true } });
      if (!invitation) return undefined;
      const updated = await tx.invitation.update({ where: { id: invitation.id }, data: { coverMediaId: assetId, coverAlt: assetId ? alt : "", draftRevision: { increment: 1 } }, select: { draftRevision: true } });
      return { previousAssetId: invitation.coverMediaId, revision: updated.draftRevision };
    });
  },

  async addGalleryImage(ownerId, eventId, assetId, alt) {
    requireDatabase();
    return prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({ where: { id: eventId, ownerId }, select: { id: true } });
      if (!event) return undefined;
      const last = await tx.galleryImage.aggregate({ where: { eventId }, _max: { position: true } });
      const created = await tx.galleryImage.create({ data: { eventId, mediaAssetId: assetId, src: null, alt, position: (last._max.position ?? -1) + 1 }, select: { id: true } });
      return { id: created.id, revision: await bumpRevision(tx, eventId) };
    });
  },

  async removeGalleryImage(ownerId, eventId, galleryId) {
    requireDatabase();
    return prisma.$transaction(async (tx) => {
      const row = await tx.galleryImage.findFirst({ where: { id: galleryId, eventId, event: { ownerId } }, select: { id: true, mediaAssetId: true } });
      if (!row) return undefined;
      await tx.galleryImage.delete({ where: { id: row.id } });
      return { assetId: row.mediaAssetId, revision: await bumpRevision(tx, eventId) };
    });
  },

  async setLocationImage(ownerId, eventId, locationId, assetId, alt) {
    requireDatabase();
    return prisma.$transaction(async (tx) => {
      const row = await tx.location.findFirst({ where: { id: locationId, eventId, event: { ownerId } }, select: { id: true, mediaAssetId: true } });
      if (!row) return undefined;
      // Con imagen propia se ignora la estática (y sus medidas): una sola fuente por sede.
      await tx.location.update({
        where: { id: row.id },
        data: assetId ? { mediaAssetId: assetId, imageAlt: alt, imagePath: null, imageWidth: null, imageHeight: null } : { mediaAssetId: null },
      });
      return { previousAssetId: row.mediaAssetId, revision: await bumpRevision(tx, eventId) };
    });
  },

  async getSlug(ownerId, eventId) {
    requireDatabase();
    return (await prisma.invitation.findFirst({ where: { eventId, event: { ownerId } }, select: { slug: true } }))?.slug;
  },
};
