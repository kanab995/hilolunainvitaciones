import type { Prisma } from "@prisma/client";
import { getEffectiveEventPlan, isEventAccessActive } from "@/lib/billing/purchase";
import { getServerNow } from "@/lib/invitation/server-time";
import { toPublicationInfo } from "@/lib/publishing/state";
import { isPublishedInvitation, snapshotToInvitation, type PublishAsset } from "@/lib/publishing/snapshot";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";
import { dbInvitationToDomain } from "@/server/mappers/invitation";
import { getDemoRows } from "@/server/repositories/demo-store";
import { invitationInclude, ownerMediaOptions, publicMediaOptions } from "@/server/repositories/invitations";
import { getMediaUrl } from "@/server/storage/public-url";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import type { PublicationInfo, PublishedInvitation } from "@/types/published";

/**
 * PUBLICACIÓN (D-29). El BORRADOR son las tablas del evento; lo PÚBLICO es un snapshot (`InvitationPublication`)
 * que se crea al publicar y es lo único que lee `/i/[slug]`. Publicar es UNA transacción: snapshot + estado +
 * versión, o nada. Propiedad en la propia consulta; toda versión anterior se conserva (base de un rollback futuro).
 */
export interface DraftMeta {
  /** Revisión actual del borrador (control de concurrencia del guardado). */
  revision: number;
  /** Revisión del borrador que se publicó (con `revision` decide «Cambios sin publicar» también en el navegador). */
  publishedRevision: number;
  publication: PublicationInfo;
  slug: string;
}

/** Revisión y estado de publicación de la invitación de un evento DEL USUARIO. */
export async function getOwnedDraftMeta(userId: string, eventId: string): Promise<DraftMeta | undefined> {
  if (getDataSource() === "demo") {
    const { invitation, ownerId, invitationStatus } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId && invitation.event.id === eventId ? { revision: 1, publishedRevision: 1, publication: { state: invitationStatus === "PUBLISHED" ? "published" : "draft", version: 0 }, slug: invitation.slug } : undefined;
  }
  const row = await prisma.invitation.findFirst({
    where: { eventId, event: { ownerId: userId } },
    select: { slug: true, status: true, draftRevision: true, publishedRevision: true, publishedVersion: true, publishedAt: true, lastPublishedAt: true },
  });
  // Publicada antes de D-29 (sin ninguna publicación): sin cambios pendientes hasta que se edite.
  return row ? { revision: row.draftRevision, publishedRevision: row.publishedVersion === 0 ? row.draftRevision : row.publishedRevision, publication: toPublicationInfo(row), slug: row.slug } : undefined;
}

/* ───────── lectura pública ───────── */

export interface PublishedRecord {
  invitation: Invitation;
  eventId: string;
  /** Configuración del tema con la que se publicó (`undefined` en datos anteriores a D-29: se usa el registro). */
  template?: InvitationTemplate;
  /** Versión y fecha de la publicación vigente (`undefined` en la demostración en memoria y en datos anteriores a D-29). */
  publication?: { version: number; publishedAt: string };
}

/**
 * El acceso público de un evento de PAGO terminó (`paidAccessEndsAt`, D-32 / D-34). NO trae contenido del evento: quien llama no puede
 * mostrar nada por descuido (el tipo obliga a comprobarlo antes de leer `invitation`). Nada se borra: solo deja de mostrarse.
 */
export interface ExpiredRecord {
  expired: true;
  eventId: string;
}

export const isExpiredRecord = (record: unknown): record is ExpiredRecord => typeof record === "object" && record !== null && (record as { expired?: unknown }).expired === true;

/**
 * Invitación PUBLICADA por slug. Lee el snapshot vigente, no el borrador. Si el acceso pagado del evento venció devuelve `{ expired: true }`
 * (mismas reglas que `isEventAccessActive`: un evento Gratis nunca expira). Compatibilidad: una invitación
 * `PUBLISHED` sin ninguna publicación (datos anteriores a D-29, p. ej. la demostración sembrada antes) se lee del
 * borrador hasta que se vuelva a publicar o se repita el seed. Nunca expone ids de archivos ni de propietario.
 */
export async function loadPublishedInvitation(slug: string): Promise<PublishedRecord | ExpiredRecord | undefined> {
  if (getDataSource() === "demo") {
    const { invitation, invitationStatus, event } = getDemoRows(new Date(getServerNow()));
    return invitation.slug === slug && invitationStatus === "PUBLISHED" ? { invitation: dbInvitationToDomain(invitation, publicMediaOptions), eventId: event.id } : undefined;
  }

  const head = await prisma.invitation.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      eventId: true,
      publications: { where: { isCurrent: true }, take: 1, select: { snapshot: true } },
      // Solo lo necesario para decidir la expiración (plan efectivo + fin del acceso pagado).
      event: { select: { paidAccessEndsAt: true, purchases: { where: { status: "PAID" }, select: { plan: true, status: true } } } },
    },
  });
  if (!head) return undefined;
  if (head.event && !isEventAccessActive({ plan: getEffectiveEventPlan(head.event.purchases), paidAccessEndsAt: head.event.paidAccessEndsAt, now: new Date(getServerNow()) })) return { expired: true, eventId: head.eventId };

  const snapshot = head.publications[0]?.snapshot;
  if (isPublishedInvitation(snapshot)) return { invitation: snapshotToInvitation(snapshot, getMediaUrl), eventId: head.eventId, template: snapshot.template.config, publication: { version: snapshot.version, publishedAt: snapshot.publishedAt } };

  const row = await prisma.invitation.findFirst({ where: { id: head.id }, include: invitationInclude });
  return row ? { invitation: dbInvitationToDomain(row, publicMediaOptions), eventId: head.eventId } : undefined;
}

/* ───────── publicar ───────── */

export interface PublishContext {
  invitation: Invitation;
  /** Archivos READY del propietario referenciados por el borrador, por id. */
  assets: ReadonlyMap<string, PublishAsset>;
  /** ¿La plantilla del borrador sigue publicada, con diseño aprobado y del tipo del evento? */
  templateOk: boolean;
  version: number;
  publishedAt: Date;
}

export type PublishBuild = (context: PublishContext) => { ok: true; snapshot: PublishedInvitation; mediaAssetIds: string[] } | { ok: false; message: string };

export type PublishOutcome =
  | { ok: true; version: number; alreadyPublished: boolean; slug: string; previousMediaIds: string[]; mediaAssetIds: string[]; revision: number }
  | { ok: false; code: "not_found" | "invalid"; message?: string }
  | { ok: false; code: "conflict"; revision?: number };

const json = (value: object): Prisma.InputJsonObject => value as Prisma.InputJsonObject;

/** Todos los ids de `MediaAsset` que el borrador referencia. */
function mediaIdsOf(invitation: Invitation): string[] {
  const ids = [invitation.cover.photo?.mediaAssetId, ...invitation.locations.map((location) => location.photo?.mediaAssetId), ...invitation.gallery.map((image) => image.mediaAssetId)];
  return [...new Set(ids.filter((id): id is string => typeof id === "string"))];
}

export async function publishOwnedInvitation(userId: string, eventId: string, expectedRevision: number | undefined, build: PublishBuild): Promise<PublishOutcome> {
  if (getDataSource() === "demo") throw new StoreUnavailableError();

  // `maxWait`/`timeout` por encima de los valores por defecto de Prisma (2 s / 5 s): esta transacción hace varias
  // idas y vueltas (hasta 9) y con una base de datos remota que arranca en frío (p. ej. Prisma Postgres) el valor
  // por defecto puede agotarse antes de terminar, aunque la transacción en sí sea correcta (P2028).
  return prisma.$transaction(async (tx): Promise<PublishOutcome> => {
    const row = await tx.invitation.findFirst({ where: { eventId, event: { ownerId: userId } }, include: invitationInclude });
    if (!row) return { ok: false, code: "not_found" };
    if (expectedRevision !== undefined && row.draftRevision !== expectedRevision) return { ok: false, code: "conflict", revision: row.draftRevision };

    const previous = await tx.invitationPublication.findFirst({ where: { invitationId: row.id, isCurrent: true }, select: { mediaAssetIds: true } });

    // Doble publicación: si lo publicado ya es exactamente este borrador, no se crea otra versión.
    if (row.status === "PUBLISHED" && row.publishedVersion > 0 && row.publishedRevision === row.draftRevision) {
      return { ok: true, version: row.publishedVersion, alreadyPublished: true, slug: row.slug, previousMediaIds: [], mediaAssetIds: previous?.mediaAssetIds ?? [], revision: row.draftRevision };
    }

    // Compare-and-set de la versión: dos peticiones simultáneas → solo una crea la versión siguiente.
    const version = row.publishedVersion + 1;
    const claimed = await tx.invitation.updateMany({ where: { id: row.id, publishedVersion: row.publishedVersion }, data: { publishedVersion: version } });
    if (claimed.count === 0) {
      const now = await tx.invitation.findUnique({ where: { id: row.id }, select: { publishedVersion: true, draftRevision: true } });
      return { ok: true, version: now?.publishedVersion ?? version, alreadyPublished: true, slug: row.slug, previousMediaIds: [], mediaAssetIds: [], revision: now?.draftRevision ?? row.draftRevision };
    }

    const invitation = dbInvitationToDomain(row, ownerMediaOptions);
    const ids = mediaIdsOf(invitation);
    const assetRows = ids.length > 0 ? await tx.mediaAsset.findMany({ where: { id: { in: ids }, ownerId: userId, eventId, status: "READY" }, select: { id: true, storageKey: true, width: true, height: true } }) : [];
    const assets = new Map<string, PublishAsset>(assetRows.map((asset) => [asset.id, { storageKey: asset.storageKey, ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}) }]));
    // La plantilla ya ES de esta invitación: republicar NO exige que siga visible en el catálogo (ocultarla desde la consola, D-33, solo
    // la retira de las nuevas selecciones; las invitaciones existentes siguen pudiendo publicar sus cambios). Sí exige diseño terminado.
    const template = await tx.template.findFirst({ where: { slug: invitation.templateSlug, designStatus: "IMPLEMENTED", eventType: row.event.type }, select: { id: true } });

    const publishedAt = new Date();
    const built = build({ invitation, assets, templateOk: Boolean(template), version, publishedAt });
    // Nada se escribió todavía salvo el CAS de la versión: al devolver un error se revierte toda la transacción.
    if (!built.ok) throw new PublishRejected(built.message);

    await tx.invitationPublication.updateMany({ where: { invitationId: row.id, isCurrent: true }, data: { isCurrent: false } });
    await tx.invitationPublication.create({ data: { invitationId: row.id, version, isCurrent: true, templateSlug: built.snapshot.template.slug, snapshot: json(built.snapshot), mediaAssetIds: built.mediaAssetIds } });
    await tx.invitation.update({ where: { id: row.id }, data: { status: "PUBLISHED", publishedRevision: row.draftRevision, lastPublishedAt: publishedAt, ...(row.publishedAt ? {} : { publishedAt }) } });
    await tx.event.update({ where: { id: eventId }, data: { status: "ACTIVE" } });

    const previousMediaIds = (previous?.mediaAssetIds ?? []).filter((id) => !built.mediaAssetIds.includes(id));
    return { ok: true, version, alreadyPublished: false, slug: row.slug, previousMediaIds, mediaAssetIds: built.mediaAssetIds, revision: row.draftRevision };
  }, { maxWait: 10_000, timeout: 20_000 }).catch((error: unknown): PublishOutcome => {
    if (error instanceof PublishRejected) return { ok: false, code: "invalid", message: error.message };
    throw error;
  });
}

/** Lanza `build` con un rechazo para abortar (y revertir) la transacción de publicación. */
class PublishRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishRejected";
  }
}
