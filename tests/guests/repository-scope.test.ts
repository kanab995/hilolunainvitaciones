import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Con base de datos, TODA operación de invitados lleva el propietario en la propia consulta (también las
 * escrituras). Prisma se sustituye por un doble que captura los argumentos: si alguien quita `ownerId`
 * de un `where`, estas pruebas fallan. (La comprobación con datos reales de dos usuarios se hizo contra
 * PostgreSQL: ver el informe.)
 */
const log = vi.hoisted(() => ({ calls: [] as { op: string; args: unknown }[] }));
const record = (op: string, result: unknown) =>
  vi.fn(async (args: unknown) => {
    log.calls.push({ op, args });
    return typeof result === "function" ? (result as () => unknown)() : result;
  });

const guestRow = { id: "gst_new", name: "Ana", email: null, phone: null, groupId: null, maxCompanions: 0, status: "PENDING", inviteToken: "x".repeat(32), createdAt: new Date(), group: null };

const tx = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
  guestGroup: { findFirst: vi.fn(), create: vi.fn() },
  guest: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  rsvp: { updateMany: vi.fn() },
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    ...tx,
    $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  },
}));

import { createOwnedGuest, deleteOwnedGuest, listOwnedGuestGroups, listOwnedGuests, updateOwnedGuest } from "@/server/repositories/guests";
import type { GuestInput } from "@/server/services/guest-input";

const input: GuestInput = { name: "Ana", email: null, phone: null, maxCompanions: 1, status: undefined, groupId: null, newGroupName: null };
const wrap = (op: string, fn: ReturnType<typeof vi.fn>, result: unknown) => fn.mockImplementation(record(op, result));

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  log.calls.length = 0;
  wrap("event.findFirst", tx.event.findFirst, { id: "evt_A" });
  wrap("group.findFirst", tx.guestGroup.findFirst, null);
  wrap("group.create", tx.guestGroup.create, { id: "grp_new" });
  wrap("guest.create", tx.guest.create, guestRow);
  wrap("guest.findFirst", tx.guest.findFirst, { ...guestRow, status: "PENDING" });
  wrap("guest.updateMany", tx.guest.updateMany, { count: 1 });
  wrap("guest.deleteMany", tx.guest.deleteMany, { count: 1 });
  wrap("guest.findMany", tx.guest.findMany, []);
  wrap("rsvp.updateMany", tx.rsvp.updateMany, { count: 1 });
});
afterEach(() => vi.unstubAllEnvs());

const args = (op: string) => log.calls.filter((call) => call.op === op).map((call) => call.args as Record<string, unknown>);

describe("Repositorio de invitados: propiedad en cada consulta (modo base de datos)", () => {
  it("1. listar: solo invitados del evento Y del propietario", async () => {
    await listOwnedGuests("usr_A", "evt_A");
    expect(args("guest.findMany")[0]).toMatchObject({ where: { eventId: "evt_A", event: { ownerId: "usr_A" } } });
  });

  it("los grupos también se filtran por propietario", async () => {
    tx.guestGroup.findFirst.mockClear();
    const { prisma } = await import("@/server/db/client");
    (prisma as unknown as { guestGroup: { findMany: ReturnType<typeof vi.fn> } }).guestGroup.findMany = vi.fn(async (a: unknown) => {
      log.calls.push({ op: "group.findMany", args: a });
      return [];
    });
    await listOwnedGuestGroups("usr_A", "evt_A");
    expect(args("group.findMany")[0]).toMatchObject({ where: { eventId: "evt_A", event: { ownerId: "usr_A" } } });
  });

  it("2. crear: primero verifica que el evento es del usuario; si no, no escribe nada", async () => {
    await createOwnedGuest("usr_A", "evt_A", input);
    expect(args("event.findFirst")[0]).toMatchObject({ where: { id: "evt_A", ownerId: "usr_A" } });
    expect(args("guest.create")).toHaveLength(1);

    log.calls.length = 0;
    wrap("event.findFirst", tx.event.findFirst, null); // evento de otra persona
    const result = await createOwnedGuest("usr_A", "evt_B", input);
    expect(result).toEqual({ ok: false, code: "not_found" });
    expect(args("guest.create")).toHaveLength(0);
  });

  it("el invitado se crea con el eventId verificado y un token generado en el servidor (nunca del cliente)", async () => {
    await createOwnedGuest("usr_A", "evt_A", input);
    const data = (args("guest.create")[0] as { data: Record<string, unknown> }).data;
    expect(data.eventId).toBe("evt_A");
    expect(String(data.inviteToken)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(data).not.toHaveProperty("ownerId");
    expect(data).not.toHaveProperty("id");
  });

  it("un grupo debe pertenecer al MISMO evento; uno ajeno se rechaza sin crear el invitado", async () => {
    const result = await createOwnedGuest("usr_A", "evt_A", { ...input, groupId: "grp_de_B" });
    expect(args("group.findFirst")[0]).toMatchObject({ where: { id: "grp_de_B", eventId: "evt_A" } });
    expect(result).toEqual({ ok: false, code: "group_not_found" });
    expect(args("guest.create")).toHaveLength(0);
  });

  it("un grupo nuevo se crea (o reutiliza) dentro del evento", async () => {
    await createOwnedGuest("usr_A", "evt_A", { ...input, newGroupName: "Familia de Andrea" });
    expect(args("group.findFirst")[0]).toMatchObject({ where: { eventId: "evt_A", name: { equals: "Familia de Andrea", mode: "insensitive" } } });
    expect(args("group.create")[0]).toMatchObject({ data: { eventId: "evt_A", name: "Familia de Andrea" } });
  });

  it("3. editar: la lectura Y la escritura llevan id + eventId + propietario", async () => {
    await updateOwnedGuest("usr_A", "evt_A", "gst_B", input);
    const scope = { id: "gst_B", eventId: "evt_A", event: { ownerId: "usr_A" } };
    expect(args("guest.findFirst")[0]).toMatchObject({ where: scope });
    expect(args("guest.updateMany")[0]).toMatchObject({ where: scope });

    log.calls.length = 0;
    wrap("guest.findFirst", tx.guest.findFirst, null); // invitado de otra persona
    expect(await updateOwnedGuest("usr_A", "evt_A", "gst_B", input)).toEqual({ ok: false, code: "not_found" });
    expect(args("guest.updateMany")).toHaveLength(0);
  });

  it("cambiar el estado mantiene coherente la respuesta existente (Rsvp), acotada al evento", async () => {
    await updateOwnedGuest("usr_A", "evt_A", "gst_1", { ...input, status: "DECLINED" });
    expect(args("rsvp.updateMany")[0]).toMatchObject({ where: { guestId: "gst_1", eventId: "evt_A" }, data: { status: "DECLINED", attendeeCount: 0 } });
    // El escritor único también actualiza Guest.status en la misma transacción.
    expect(args("guest.updateMany").some((call) => JSON.stringify(call).includes('"data":{"status":"DECLINED"}'))).toBe(true);
  });

  it("4. eliminar: el borrado lleva id + eventId + propietario; sin fila afectada devuelve false", async () => {
    const { prisma } = await import("@/server/db/client");
    (prisma as unknown as { guest: { deleteMany: ReturnType<typeof vi.fn> } }).guest.deleteMany = vi.fn(async (a: unknown) => {
      log.calls.push({ op: "guest.deleteMany", args: a });
      return { count: 0 };
    });
    expect(await deleteOwnedGuest("usr_A", "evt_A", "gst_B")).toBe(false);
    expect(args("guest.deleteMany")[0]).toMatchObject({ where: { id: "gst_B", eventId: "evt_A", event: { ownerId: "usr_A" } } });
  });
});

describe("Sin base de datos (origen de demostración)", () => {
  it("las lecturas respetan al propietario y las escrituras se rechazan", async () => {
    vi.unstubAllEnvs();
    const { DEMO_USER, DEMO_EVENT_ID } = await import("@/server/seed/demo-data");
    expect((await listOwnedGuests(DEMO_USER.id, DEMO_EVENT_ID)).map((g) => g.name)).toEqual(["Mariana López", "Luis Hernández", "Carolina Méndez", "Javier Torres"]);
    expect(await listOwnedGuests("usr_otra_persona", DEMO_EVENT_ID)).toEqual([]);
    expect(await listOwnedGuests(DEMO_USER.id, "evt_ajeno")).toEqual([]);
    await expect(createOwnedGuest(DEMO_USER.id, DEMO_EVENT_ID, input)).rejects.toThrow(/DATABASE_URL/);
  });
});
