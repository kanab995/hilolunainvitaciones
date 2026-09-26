import { getServerNow } from "@/lib/invitation/server-time";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { uniqueViolationFields } from "@/server/db/errors";
import type { GuestRecord } from "@/server/mappers/guest";
import { getDemoRows } from "@/server/repositories/demo-store";
import { writeGuestResponse } from "@/server/repositories/guest-response";
import type { GuestInput } from "@/server/services/guest-input";
import { generateInviteToken } from "@/server/services/invite-token";
import type { GuestGroupOption } from "@/types/guests";

/**
 * INVITADOS (Guest Manager). REGLA: toda función recibe el `userId` del propietario y el `eventId`, y
 * los aplica EN LA PROPIA CONSULTA (`event: { ownerId: userId }`), también en las escrituras
 * (`updateMany`/`deleteMany` con el mismo filtro): un invitado o evento ajeno es indistinguible de uno
 * inexistente. El `eventId` que llega del cliente nunca se confía: se verifica siempre con el
 * propietario (y el servicio lo resuelve antes con `resolveOwnedEvent`). Sin `DATABASE_URL` (origen de
 * demostración) las lecturas funcionan y las escrituras lanzan `GuestStoreUnavailableError`.
 */
export class GuestStoreUnavailableError extends Error {
  constructor() {
    super("Guardar invitados requiere DATABASE_URL: el origen de demostración es de solo lectura.");
    this.name = "GuestStoreUnavailableError";
  }
}

export type GuestWriteResult = { ok: true; guest: GuestRecord } | { ok: false; code: "not_found" | "group_not_found" };

const guestSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  groupId: true,
  maxCompanions: true,
  status: true,
  inviteToken: true,
  createdAt: true,
  group: { select: { name: true } },
  rsvp: { select: { attendeeCount: true } },
} as const;

type GuestWithGroup = Omit<GuestRecord, "groupName" | "attendeeCount"> & { group: { name: string } | null; rsvp: { attendeeCount: number | null } | null };
const toRecord = ({ group, rsvp, ...guest }: GuestWithGroup): GuestRecord => ({ ...guest, groupName: group?.name ?? null, attendeeCount: rsvp?.attendeeCount ?? null });

function requireDatabase(): void {
  if (getDataSource() === "demo") throw new GuestStoreUnavailableError();
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Grupo del invitado dentro de ESE evento: uno existente (debe pertenecer al evento; un grupo de otro
 * evento se rechaza), uno nuevo por nombre (se reutiliza si ya existe, sin distinguir mayúsculas) o ninguno.
 */
async function resolveGroupId(tx: Tx, eventId: string, input: GuestInput): Promise<{ ok: true; groupId: string | null } | { ok: false }> {
  if (input.groupId) {
    const group = await tx.guestGroup.findFirst({ where: { id: input.groupId, eventId }, select: { id: true } });
    return group ? { ok: true, groupId: group.id } : { ok: false };
  }
  if (input.newGroupName) {
    const existing = await tx.guestGroup.findFirst({ where: { eventId, name: { equals: input.newGroupName, mode: "insensitive" } }, select: { id: true } });
    return { ok: true, groupId: existing?.id ?? (await tx.guestGroup.create({ data: { eventId, name: input.newGroupName }, select: { id: true } })).id };
  }
  return { ok: true, groupId: null };
}

/** Invitados del evento del usuario, en orden de alta. Evento ajeno → lista vacía. */
export async function listOwnedGuests(userId: string, eventId: string): Promise<GuestRecord[]> {
  if (getDataSource() === "demo") {
    const { event, ownerId, guestRecords } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId && event.id === eventId ? guestRecords : [];
  }
  const rows = await prisma.guest.findMany({ where: { eventId, event: { ownerId: userId } }, select: guestSelect, orderBy: { createdAt: "asc" } });
  return rows.map(toRecord);
}

export async function listOwnedGuestGroups(userId: string, eventId: string): Promise<GuestGroupOption[]> {
  if (getDataSource() === "demo") {
    const { event, ownerId, guestGroups } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId && event.id === eventId ? guestGroups : [];
  }
  return prisma.guestGroup.findMany({ where: { eventId, event: { ownerId: userId } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

/** Crea el invitado con un token de invitación nuevo (aleatorio, generado aquí). */
export async function createOwnedGuest(userId: string, eventId: string, input: GuestInput): Promise<GuestWriteResult> {
  requireDatabase();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. El evento es del usuario (el `eventId` del cliente no basta).
        if (!(await tx.event.findFirst({ where: { id: eventId, ownerId: userId }, select: { id: true } }))) return { ok: false, code: "not_found" } as const;

        // 2. El grupo pertenece a ESE evento (o se crea/reutiliza uno por nombre).
        const group = await resolveGroupId(tx, eventId, input);
        if (!group.ok) return { ok: false, code: "group_not_found" } as const;
        const groupId = group.groupId;

        const guest = await tx.guest.create({
          data: { eventId, groupId, name: input.name, email: input.email, phone: input.phone, maxCompanions: input.maxCompanions, status: input.status ?? "PENDING", inviteToken: generateInviteToken() },
          select: guestSelect,
        });
        return { ok: true, guest: toRecord(guest) } as const;
      });
    } catch (error) {
      // Colisión (prácticamente imposible) del token: se reintenta con otro.
      if (uniqueViolationFields(error)?.includes("inviteToken")) continue;
      throw error;
    }
  }
  throw new Error("No se pudo generar un token de invitación único.");
}

/** Actualiza un invitado del evento del usuario. Mantiene coherente la respuesta (`Rsvp`) si existe. */
export async function updateOwnedGuest(userId: string, eventId: string, guestId: string, input: GuestInput): Promise<GuestWriteResult> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const scope = { id: guestId, eventId, event: { ownerId: userId } };
    const current = await tx.guest.findFirst({ where: scope, select: { id: true, status: true } });
    if (!current) return { ok: false, code: "not_found" } as const;

    const group = await resolveGroupId(tx, eventId, input);
    if (!group.ok) return { ok: false, code: "group_not_found" } as const;
    const groupId = group.groupId;

    const status = input.status ?? current.status;
    // La escritura lleva el mismo filtro de propiedad que la lectura.
    const { count } = await tx.guest.updateMany({ where: scope, data: { name: input.name, email: input.email, phone: input.phone, maxCompanions: input.maxCompanions, groupId } });
    if (count !== 1) return { ok: false, code: "not_found" } as const;

    // El estado se escribe SIEMPRE por el escritor único (Guest.status y, si existe, Rsvp.status a la vez).
    if (status !== current.status) await writeGuestResponse(tx, { eventId, guestId, status });

    const guest = await tx.guest.findFirst({ where: scope, select: guestSelect });
    return guest ? ({ ok: true, guest: toRecord(guest) } as const) : ({ ok: false, code: "not_found" } as const);
  });
}

/** Elimina un invitado del evento del usuario. Su `Rsvp` (y respuestas) se borran en cascada (Prisma). */
export async function deleteOwnedGuest(userId: string, eventId: string, guestId: string): Promise<boolean> {
  requireDatabase();
  const { count } = await prisma.guest.deleteMany({ where: { id: guestId, eventId, event: { ownerId: userId } } });
  return count === 1;
}
