import type { Prisma } from "@prisma/client";
import { getServerNow } from "@/lib/invitation/server-time";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { dbInvitationToDomain, type MediaMapOptions } from "@/server/mappers/invitation";
import { getDemoRows } from "@/server/repositories/demo-store";
import { DEMO_EVENT_SLUG } from "@/server/seed/demo-data";
import type { NewEventAggregate } from "@/server/services/event-aggregate";
import { getMediaUrl } from "@/server/storage/public-url";
import type { Invitation } from "@/types/invitation";

/** Lo que el mapper necesita de un archivo gestionado: nunca el propietario ni el nombre original. */
const mediaSelect = { select: { id: true, storageKey: true, status: true, width: true, height: true } } as const;

/** Archivos gestionados: la invitación PÚBLICA nunca lleva ids; el EDITOR del propietario sí (los necesita para operar). */
export const publicMediaOptions: MediaMapOptions = { mediaUrl: getMediaUrl };
export const ownerMediaOptions: MediaMapOptions = { mediaUrl: getMediaUrl, exposeMediaIds: true };

/** Todo lo que necesita `dbInvitationToDomain`, ordenado por `position`. */
export const invitationInclude = {
  template: { select: { slug: true } },
  coverMedia: mediaSelect,
  sections: { orderBy: { position: "asc" } },
  event: {
    include: {
      locations: { orderBy: { position: "asc" }, include: { mediaAsset: mediaSelect } },
      timelineItems: { orderBy: { position: "asc" } },
      galleryImages: { orderBy: { position: "asc" }, include: { mediaAsset: mediaSelect } },
      giftRegistry: { orderBy: { position: "asc" } },
      music: true,
    },
  },
} satisfies Prisma.InvitationInclude;

/**
 * Invitación principal de un evento del usuario (editor, vista previa). Comprueba la PROPIEDAD en la
 * propia consulta (`event.ownerId`): con un evento ajeno devuelve `undefined`, igual que si no existiera.
 */
export async function getOwnedInvitation(userId: string, eventId: string): Promise<Invitation | undefined> {
  if (getDataSource() === "demo") {
    const { invitation, ownerId } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId && invitation.event.id === eventId ? dbInvitationToDomain(invitation, ownerMediaOptions) : undefined;
  }
  const row = await prisma.invitation.findFirst({ where: { eventId, event: { ownerId: userId } }, include: invitationInclude });
  return row ? dbInvitationToDomain(row, ownerMediaOptions) : undefined;
}

/** Slug público de la invitación de un evento DEL USUARIO (para construir enlaces). */
export async function getOwnedInvitationSlug(userId: string, eventId: string): Promise<string | undefined> {
  if (getDataSource() === "demo") {
    const { invitation, ownerId } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId && invitation.event.id === eventId ? invitation.slug : undefined;
  }
  const row = await prisma.invitation.findFirst({ where: { eventId, event: { ownerId: userId } }, select: { slug: true } });
  return row?.slug;
}

/**
 * Invitación del evento de demostración (Andrea & Fernando) para las demos PÚBLICAS de plantilla
 * (`/i/demo-<plantilla>`). Es contenido de muestra del seed, no de un usuario; no sirve para rutas
 * privadas. Sin el seed cargado (p. ej. producción) no existe.
 */
export async function getDemoEventInvitation(): Promise<Invitation | undefined> {
  if (getDataSource() === "demo") return dbInvitationToDomain(getDemoRows(new Date(getServerNow())).invitation, publicMediaOptions);
  const row = await prisma.invitation.findFirst({ where: { event: { slug: DEMO_EVENT_SLUG } }, include: invitationInclude });
  return row ? dbInvitationToDomain(row, publicMediaOptions) : undefined;
}

const json = (value: object): Prisma.InputJsonObject => value as Prisma.InputJsonObject;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Escribe un agregado completo dentro de una transacción YA abierta: evento, invitación, secciones y todo su
 * contenido, invitados y respuestas. La comparten el seed (`createEventWithInvitation`) y el alta de un evento
 * de un usuario (`server/repositories/event-creation.ts`): una sola forma de escribir un evento.
 */
export async function writeEventAggregate(tx: Tx, aggregate: NewEventAggregate, templateId: string, ownerId: string): Promise<{ eventId: string; invitationId: string }> {
  const { event, invitation, guestGroups, guests } = aggregate;
  const eventId = event.id;
  await tx.event.create({ data: { ...event, ownerId } });

  await tx.invitation.create({
    data: {
      id: invitation.invitation.id,
      eventId,
      templateId,
      slug: invitation.invitation.slug,
      status: aggregate.invitationStatus,
      contentVersion: invitation.invitation.contentVersion,
      names: invitation.invitation.names,
      styleOverrides: json(invitation.invitation.styleOverrides),
    },
  });
  await tx.invitationSection.createMany({
    data: invitation.sections.map((section) => ({ ...section, invitationId: invitation.invitation.id, settings: json(section.settings), content: json(section.content) })),
  });
  await tx.location.createMany({ data: invitation.locations.map((row) => ({ ...row, eventId })) });
  await tx.timelineItem.createMany({ data: invitation.timelineItems.map((row) => ({ ...row, eventId })) });
  await tx.galleryImage.createMany({ data: invitation.galleryImages.map((row) => ({ ...row, eventId })) });
  await tx.giftRegistry.createMany({ data: invitation.giftRegistry.map((row) => ({ ...row, eventId })) });
  if (invitation.music) await tx.musicSettings.create({ data: { ...invitation.music, eventId } });

  await tx.guestGroup.createMany({ data: guestGroups.map((group) => ({ ...group, eventId })) });
  await tx.guest.createMany({
    data: guests.map((guest) => ({
      id: guest.id,
      eventId,
      groupId: guest.groupId,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      maxCompanions: guest.maxCompanions,
      status: guest.status,
      inviteToken: guest.inviteToken,
      firstViewedAt: guest.firstViewedAt,
      createdAt: guest.createdAt,
    })),
  });
  await tx.rsvp.createMany({ data: guests.flatMap((guest) => (guest.rsvp ? [{ ...guest.rsvp, eventId, guestId: guest.id }] : [])) });

  return { eventId, invitationId: invitation.invitation.id };
}

/**
 * Crea un evento con su invitación y TODO su contenido en UNA transacción: o se guarda completo o no
 * se guarda nada (integridad). Lo usa el seed (carga el usuario demo); el alta de un usuario real usa
 * `createOwnedEvent`. Falla si la plantilla no existe. Solo con base de datos.
 */
export async function createEventWithInvitation(aggregate: NewEventAggregate): Promise<{ eventId: string; invitationId: string }> {
  if (getDataSource() === "demo") throw new Error("createEventWithInvitation requiere DATABASE_URL: el origen de demostración es de solo lectura.");
  const { owner } = aggregate;

  return prisma.$transaction(async (tx) => {
    const template = await tx.template.findUnique({ where: { slug: aggregate.templateSlug }, select: { id: true } });
    if (!template) throw new Error(`La plantilla "${aggregate.templateSlug}" no existe.`);

    // Por `id` (no por email): el usuario demo conserva su identidad si su email cambia (p. ej. el cambio de marca)
    // y no queda duplicado al repetir el seed.
    const user = await tx.user.upsert({ where: { id: owner.id }, create: { id: owner.id, email: owner.email, name: owner.name }, update: { email: owner.email, name: owner.name } });
    return writeEventAggregate(tx, aggregate, template.id, user.id);
  });
}

/** Borra un evento y, en cascada, todo lo suyo. Nunca borra plantillas. Solo con base de datos. */
export async function deleteEvent(eventId: string): Promise<void> {
  if (getDataSource() === "demo") throw new Error("deleteEvent requiere DATABASE_URL.");
  await prisma.event.deleteMany({ where: { id: eventId } });
}
