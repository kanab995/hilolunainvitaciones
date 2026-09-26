import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Un evento recién creado por A no existe para B. Prisma se sustituye por un almacén en memoria que EVALÚA
 * los `where` de propietario: si una consulta privada dejara de filtrar por `ownerId`, B podría verlo y
 * estas pruebas fallarían. (La misma comprobación con dos usuarios reales se hizo contra PostgreSQL.)
 */
const store = vi.hoisted(() => ({
  events: [{ id: "evt_new", slug: "sofia-y-diego", ownerId: "usr_A", title: "Sofía & Diego", type: "WEDDING", status: "DRAFT", startsAt: new Date("2027-05-17T23:00:00Z"), timezone: "America/Mexico_City" }],
  guests: [] as { id: string; eventId: string }[],
}));

type Where = { ownerId?: string; id?: string; eventId?: string; OR?: { id?: string; slug?: string }[]; event?: { ownerId?: string } };
const eventMatches = (event: (typeof store.events)[number], where: Where) =>
  (where.ownerId === undefined || event.ownerId === where.ownerId) && (where.id === undefined || event.id === where.id) && (where.OR === undefined || where.OR.some((clause) => clause.id === event.id || clause.slug === event.slug));

vi.mock("@/server/db/client", () => ({
  prisma: {
    event: {
      findFirst: vi.fn(async (args: { where: Where }) => store.events.find((event) => eventMatches(event, args.where)) ?? null),
      findMany: vi.fn(async (args: { where: Where }) => store.events.filter((event) => eventMatches(event, args.where)).map((event) => ({ ...event, invitation: { status: "DRAFT", template: { name: "Magnolia" } } }))),
    },
    invitation: { findFirst: vi.fn(async (args: { where: Where }) => (store.events.some((event) => event.id === args.where.eventId && event.ownerId === args.where.event?.ownerId) ? { id: "inv_1", slug: "sofia-y-diego" } : null)) },
    guest: { findMany: vi.fn(async (args: { where: Where }) => store.guests.filter((guest) => guest.eventId === args.where.eventId && store.events.some((event) => event.id === guest.eventId && event.ownerId === args.where.event?.ownerId))) },
  },
}));

import { getOwnedEventByRef, listOwnedEvents } from "@/server/repositories/events";
import { getOwnedInvitationSlug } from "@/server/repositories/invitations";
import { listOwnedGuests } from "@/server/repositories/guests";

beforeEach(() => vi.stubEnv("DATABASE_URL", "postgresql://prueba"));
afterEach(() => vi.unstubAllEnvs());

describe("67. Usuario B no ve ni gestiona el evento recién creado por A", () => {
  it("A lo ve: por id, por slug y en «Mis eventos» (aparece sin más pasos)", async () => {
    expect(await getOwnedEventByRef("usr_A", "evt_new")).toMatchObject({ id: "evt_new", status: "draft", type: "wedding" });
    expect(await getOwnedEventByRef("usr_A", "sofia-y-diego")).toMatchObject({ id: "evt_new" });
    expect(await listOwnedEvents("usr_A")).toMatchObject([{ id: "evt_new", invitationStatus: "draft", templateName: "Magnolia" }]);
    expect(await getOwnedInvitationSlug("usr_A", "evt_new")).toBe("sofia-y-diego");
  });

  it("B recibe exactamente lo mismo que para un evento inexistente (404 seguro), por id y por slug", async () => {
    expect(await getOwnedEventByRef("usr_B", "evt_new")).toBeUndefined();
    expect(await getOwnedEventByRef("usr_B", "sofia-y-diego")).toBeUndefined();
    expect(await getOwnedEventByRef("usr_B", "no-existe")).toEqual(await getOwnedEventByRef("usr_B", "evt_new"));
    expect(await listOwnedEvents("usr_B")).toEqual([]);
  });

  it("B no abre la invitación (editor) ni lista o gestiona invitados del evento de A", async () => {
    expect(await getOwnedInvitationSlug("usr_B", "evt_new")).toBeUndefined();
    store.guests.push({ id: "gst_1", eventId: "evt_new" });
    expect(await listOwnedGuests("usr_B", "evt_new")).toEqual([]);
    expect(await listOwnedGuests("usr_A", "evt_new")).toHaveLength(1);
    store.guests.length = 0;
  });
});
