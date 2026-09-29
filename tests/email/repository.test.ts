import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  calls: [] as { op: string; args: unknown }[],
  guest: undefined as { name: string; event: { id: string; title: string; owner: { id: string; email: string; name: string | null } } } | undefined,
  event: undefined as { id: string; title: string; owner: { id: string; email: string; name: string | null } } | undefined,
  purchaseId: undefined as string | undefined,
  failNextCreateWithUniqueViolation: false,
}));

vi.mock("@/server/db/client", () => {
  const log = (op: string, args: unknown) => store.calls.push({ op, args });
  return {
    prisma: {
      guest: { findFirst: vi.fn(async (args: unknown) => (log("guest.findFirst", args), store.guest ?? null)) },
      event: { findUnique: vi.fn(async (args: unknown) => (log("event.findUnique", args), store.event ?? null)) },
      eventPurchase: { findUnique: vi.fn(async (args: unknown) => (log("eventPurchase.findUnique", args), store.purchaseId ? { id: store.purchaseId } : null)) },
      emailDelivery: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          log("emailDelivery.create", args);
          if (store.failNextCreateWithUniqueViolation) throw Object.assign(new Error("unique"), { code: "P2002", meta: { target: ["kind", "purchaseId"] } });
          return { id: "del_1" };
        }),
        update: vi.fn(async (args: unknown) => (log("emailDelivery.update", args), {})),
      },
    },
  };
});

import { createEmailDeliveryAttempt, findPurchaseIdBySession, resolveEventOwnerContext, resolveGuestRsvpContext } from "@/server/repositories/email-delivery";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  store.calls.length = 0;
  store.guest = undefined;
  store.event = undefined;
  store.purchaseId = undefined;
  store.failNextCreateWithUniqueViolation = false;
});
afterEach(() => vi.unstubAllEnvs());

describe("(8/35) el destinatario se resuelve SIEMPRE en el servidor", () => {
  it("resolveGuestRsvpContext trae el propietario y el nombre del invitado de ESE evento", async () => {
    store.guest = { name: "Mariana López", event: { id: "evt_1", title: "Andrea & Fernando", owner: { id: "usr_1", email: "owner@example.com", name: "Owner" } } };
    const context = await resolveGuestRsvpContext("evt_1", "gst_1");
    expect(context).toEqual({ eventId: "evt_1", eventTitle: "Andrea & Fernando", ownerId: "usr_1", ownerEmail: "owner@example.com", ownerName: "Owner", guestName: "Mariana López" });
    expect(store.calls[0]).toMatchObject({ op: "guest.findFirst", args: { where: { id: "gst_1", eventId: "evt_1" } } });
  });

  it("un invitado que ya no existe en ese evento: null (no se inventa un destinatario)", async () => {
    store.guest = undefined;
    expect(await resolveGuestRsvpContext("evt_1", "gst_x")).toBeNull();
  });

  it("resolveEventOwnerContext trae el propietario del evento para las confirmaciones de compra", async () => {
    store.event = { id: "evt_1", title: "Andrea & Fernando", owner: { id: "usr_1", email: "owner@example.com", name: null } };
    expect(await resolveEventOwnerContext("evt_1")).toEqual({ eventId: "evt_1", eventTitle: "Andrea & Fernando", ownerId: "usr_1", ownerEmail: "owner@example.com", ownerName: null });
  });

  it("findPurchaseIdBySession busca por (provider, sesión), nunca por un id que aporte el cliente", async () => {
    store.purchaseId = "purch_1";
    expect(await findPurchaseIdBySession("STRIPE", "cs_1")).toBe("purch_1");
    expect(store.calls[0]).toMatchObject({ op: "eventPurchase.findUnique", args: { where: { provider_providerCheckoutSessionId: { provider: "STRIPE", providerCheckoutSessionId: "cs_1" } } } });
  });
});

describe("(17) idempotencia: createEmailDeliveryAttempt", () => {
  it("crea una fila PENDING nueva", async () => {
    const result = await createEmailDeliveryAttempt({ kind: "RSVP_NOTIFICATION", recipientUserId: "usr_1", eventId: "evt_1" });
    expect(result).toEqual({ status: "created", id: "del_1" });
    expect(store.calls[0]).toMatchObject({ op: "emailDelivery.create", args: { data: { kind: "RSVP_NOTIFICATION", status: "PENDING" } } });
  });

  it("una violación de la restricción única (kind, purchaseId) se traduce a «duplicate», nunca lanza", async () => {
    store.failNextCreateWithUniqueViolation = true;
    expect(await createEmailDeliveryAttempt({ kind: "PURCHASE_CONFIRMATION", recipientUserId: "usr_1", purchaseId: "purch_1" })).toEqual({ status: "duplicate" });
  });
});
