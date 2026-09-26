import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Con base de datos, cada consulta privada debe llevar el propietario EN la propia consulta. Aquí se
 * sustituye Prisma por un doble que captura los argumentos: si alguien quita `ownerId` de un `where`,
 * esta prueba falla. (La prueba con datos reales de dos usuarios se hizo contra PostgreSQL: ver informe.)
 */
const calls = vi.hoisted(() => ({ event: [] as unknown[], invitation: [] as unknown[], list: [] as unknown[] }));

vi.mock("@/server/db/client", () => ({
  prisma: {
    event: {
      findFirst: vi.fn(async (args: unknown) => {
        calls.event.push(args);
        return null;
      }),
      findMany: vi.fn(async (args: unknown) => {
        calls.list.push(args);
        return [];
      }),
    },
    invitation: {
      findFirst: vi.fn(async (args: unknown) => {
        calls.invitation.push(args);
        return null;
      }),
    },
  },
}));

import { getOwnedDashboardData } from "@/server/repositories/dashboard";
import { getOwnedEventByRef, listOwnedEvents } from "@/server/repositories/events";
import { getOwnedInvitation } from "@/server/repositories/invitations";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  calls.event.length = calls.invitation.length = calls.list.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("Las consultas privadas filtran por propietario (modo base de datos)", () => {
  it("getOwnedEventByRef incluye ownerId además del id/slug", async () => {
    await getOwnedEventByRef("usr_A", "evt_B");
    expect(calls.event[0]).toMatchObject({ where: { ownerId: "usr_A", OR: [{ id: "evt_B" }, { slug: "evt_B" }] } });
  });

  it("el alias `demo` solo se expande a un slug fuera de producción, y siempre con ownerId", async () => {
    await getOwnedEventByRef("usr_A", "demo");
    expect(calls.event[0]).toMatchObject({ where: { ownerId: "usr_A", OR: [{ id: "demo" }, { slug: "andrea-fernando" }] } });

    vi.stubEnv("NODE_ENV", "production");
    await getOwnedEventByRef("usr_A", "demo");
    expect(calls.event[1]).toMatchObject({ where: { ownerId: "usr_A", OR: [{ id: "demo" }] } });
  });

  it("getOwnedInvitation filtra por el propietario del evento", async () => {
    await getOwnedInvitation("usr_A", "evt_B");
    expect(calls.invitation[0]).toMatchObject({ where: { eventId: "evt_B", event: { ownerId: "usr_A" } } });
  });

  it("listOwnedEvents y getOwnedDashboardData filtran por ownerId", async () => {
    await listOwnedEvents("usr_A");
    expect(calls.list[0]).toMatchObject({ where: { ownerId: "usr_A" } });
    expect(await getOwnedDashboardData("usr_A", "evt_B")).toBeUndefined();
    expect(calls.event.at(-1)).toMatchObject({ where: { ownerId: "usr_A" } });
  });
});
