import type { Prisma } from "@prisma/client";
import type { PlanId } from "@/lib/billing/plans";
import { extendPaidAccessEnd } from "@/lib/billing/purchase";
import { displayNames } from "@/lib/invitation/format";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError, uniqueViolationFields } from "@/server/db/errors";
import { dbInvitationToDomain, domainInvitationToDb } from "@/server/mappers/invitation";
import { invitationInclude, ownerMediaOptions } from "@/server/repositories/invitations";
import type { Invitation } from "@/types/invitation";

/**
 * GUARDADO DEL BORRADOR (D-29). Las tablas del evento SON el borrador: esta función las actualiza TODAS en una
 * transacción (evento, invitación, secciones, sedes, itinerario, galería, regalos, música). Propiedad en la propia
 * consulta (`event.ownerId`) y control de concurrencia OPTIMISTA por `draftRevision`: si el borrador ya avanzó
 * (otra ventana, una operación de imágenes) el guardado se RECHAZA en lugar de pisarlo en silencio.
 * Qué cambia lo decide `build` (lógica pura del servicio: aplicar el DTO y validar); aquí solo se escribe.
 * Las imágenes no se tocan por esta vía (`imagePath`, `mediaAssetId`, `coverMediaId`): son operaciones propias.
 */
export type DraftBuild = (current: Invitation, eventType: string) => { ok: true; invitation: Invitation } | { ok: false; message: string };

export type SaveDraftOutcome =
  | { ok: true; revision: number; releasedMediaIds: string[] }
  | { ok: false; code: "not_found" | "invalid" | "template_unavailable" | "plan_required"; message?: string }
  | { ok: false; code: "conflict"; revision?: number };

const json = (value: object): Prisma.InputJsonObject => value as Prisma.InputJsonObject;

/**
 * `templateAccess` (D-31): ¿el plan del usuario permite una plantilla con este plan mínimo? Solo se consulta al CAMBIAR de
 * plantilla: guardar cualquier otra edición nunca se bloquea (bajar de plan no impide seguir editando lo que ya existe).
 */
export type TemplateAccess = (minimumPlan: PlanId) => Promise<boolean>;

export async function saveOwnedDraft(userId: string, eventId: string, baseRevision: number, build: DraftBuild, templateAccess?: TemplateAccess): Promise<SaveDraftOutcome> {
  if (getDataSource() === "demo") throw new StoreUnavailableError();

  try {
    return await prisma.$transaction(async (tx): Promise<SaveDraftOutcome> => {
      const row = await tx.invitation.findFirst({ where: { eventId, event: { ownerId: userId } }, include: invitationInclude });
      if (!row) return { ok: false, code: "not_found" };
      if (row.draftRevision !== baseRevision) return { ok: false, code: "conflict", revision: row.draftRevision };

      const current = dbInvitationToDomain(row, ownerMediaOptions);
      const built = build(current, row.event.type);
      if (!built.ok) return { ok: false, code: "invalid", message: built.message };
      const next = built.invitation;

      // La plantilla solo cambia a una publicada, con diseño aprobado y del tipo del evento.
      let templateId: string | undefined;
      if (next.templateSlug !== current.templateSlug) {
        const template = await tx.template.findFirst({ where: { slug: next.templateSlug, publicationStatus: "PUBLISHED", designStatus: "IMPLEMENTED", eventType: row.event.type }, select: { id: true, minimumPlan: true } });
        if (!template) return { ok: false, code: "template_unavailable" };
        if (templateAccess && !(await templateAccess(template.minimumPlan))) return { ok: false, code: "plan_required" };
        templateId = template.id;
      }

      // Compare-and-set: dos guardados simultáneos sobre la misma revisión → solo uno gana.
      const claimed = await tx.invitation.updateMany({ where: { id: row.id, draftRevision: baseRevision }, data: { draftRevision: { increment: 1 } } });
      if (claimed.count === 0) return { ok: false, code: "conflict" };

      const write = domainInvitationToDb(next);
      const title = displayNames(next.names).join(" & ") || row.event.title;

      // Evento de PAGO (D-32): mover la fecha hacia adelante EXTIENDE el acceso pagado (`max(fin actual, nueva fecha + 30 días)`); hacia
      // atrás nunca lo acorta. Un evento Gratis no tiene ventana (`paidAccessEndsAt` nulo).
      const startsAt = new Date(next.event.startsAt);
      const currentEnd = row.event.paidAccessEndsAt;
      const extendedEnd = extendPaidAccessEnd(currentEnd, startsAt);
      await tx.event.update({
        where: { id: eventId },
        data: { title, startsAt, timezone: next.event.timezone, ...(extendedEnd && currentEnd && extendedEnd.getTime() > currentEnd.getTime() ? { paidAccessEndsAt: extendedEnd } : {}) },
      });
      await tx.invitation.update({
        where: { id: row.id },
        data: { names: write.invitation.names, styleOverrides: json(write.invitation.styleOverrides), ...(templateId ? { templateId } : {}), ...(row.coverMediaId ? { coverAlt: next.cover.photo?.alt ?? "" } : {}) },
      });

      // Secciones: orden (posición 0..n-1, sin duplicados), visibilidad, encabezados y contenido.
      for (const section of write.sections) {
        await tx.invitationSection.updateMany({ where: { id: section.id, invitationId: row.id }, data: { position: section.position, isVisible: section.isVisible, settings: json(section.settings), content: json(section.content) } });
      }

      // Sedes: crear, editar, eliminar y reordenar. Una sede eliminada suelta su imagen (se libera fuera de la transacción).
      const currentLocations = new Map(row.event.locations.map((location) => [location.id, location]));
      for (const location of write.locations) {
        const fields = { type: location.type, name: location.name, address: location.address, time: location.time, mapUrl: location.mapUrl, imageAlt: location.imageAlt, position: location.position };
        if (currentLocations.has(location.id)) await tx.location.updateMany({ where: { id: location.id, eventId }, data: fields });
        else await tx.location.create({ data: { id: location.id, eventId, ...fields, imagePath: null, imageWidth: null, imageHeight: null, mediaAssetId: null } });
      }
      const keptLocations = new Set(write.locations.map((location) => location.id));
      const removedLocations = row.event.locations.filter((location) => !keptLocations.has(location.id));
      if (removedLocations.length > 0) await tx.location.deleteMany({ where: { id: { in: removedLocations.map((location) => location.id) }, eventId } });

      // Itinerario y mesa de regalos: crear, editar, eliminar y reordenar por id (nunca por índice).
      const currentTimeline = new Set(row.event.timelineItems.map((item) => item.id));
      for (const item of write.timelineItems) {
        const fields = { time: item.time, title: item.title, icon: item.icon, description: item.description, position: item.position };
        if (currentTimeline.has(item.id)) await tx.timelineItem.updateMany({ where: { id: item.id, eventId }, data: fields });
        else await tx.timelineItem.create({ data: { id: item.id, eventId, ...fields } });
      }
      const keptTimeline = new Set(write.timelineItems.map((item) => item.id));
      const removedTimeline = row.event.timelineItems.filter((item) => !keptTimeline.has(item.id));
      if (removedTimeline.length > 0) await tx.timelineItem.deleteMany({ where: { id: { in: removedTimeline.map((item) => item.id) }, eventId } });

      const currentGifts = new Set(row.event.giftRegistry.map((entry) => entry.id));
      for (const entry of write.giftRegistry) {
        const fields = { name: entry.name, url: entry.url, position: entry.position };
        if (currentGifts.has(entry.id)) await tx.giftRegistry.updateMany({ where: { id: entry.id, eventId }, data: fields });
        else await tx.giftRegistry.create({ data: { id: entry.id, eventId, ...fields } });
      }
      const keptGifts = new Set(write.giftRegistry.map((entry) => entry.id));
      const removedGifts = row.event.giftRegistry.filter((entry) => !keptGifts.has(entry.id));
      if (removedGifts.length > 0) await tx.giftRegistry.deleteMany({ where: { id: { in: removedGifts.map((entry) => entry.id) }, eventId } });

      // Galería: solo texto alternativo, pie y orden de las filas EXISTENTES (alta y baja son operaciones de imágenes).
      for (const image of write.galleryImages) {
        await tx.galleryImage.updateMany({ where: { id: image.id, eventId }, data: { alt: image.alt, caption: image.caption, position: image.position } });
      }

      // Música: solo configuración (sin reproducción real ni subida de audio).
      if (write.music) await tx.musicSettings.upsert({ where: { eventId }, create: { ...write.music, eventId }, update: write.music });
      else await tx.musicSettings.deleteMany({ where: { eventId } });

      return { ok: true, revision: baseRevision + 1, releasedMediaIds: removedLocations.flatMap((location) => (location.mediaAssetId ? [location.mediaAssetId] : [])) };
    });
  } catch (error) {
    // Un id de fila nuevo que ya existe en OTRO evento (choque o intento de suplantación): se rechaza sin detalles.
    if (uniqueViolationFields(error)) return { ok: false, code: "invalid", message: "Un identificador ya está en uso. Recarga el editor." };
    throw error;
  }
}
