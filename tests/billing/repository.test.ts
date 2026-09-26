import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Persistencia de compras con Prisma sustituido por un doble que captura los argumentos: el registro del evento es idempotente
 * (`skipDuplicates`), todo ocurre en UNA transacción, la compra se guarda una fila por sesión de cobro, el cliente del proveedor es único
 * por usuario y toda lectura del usuario lleva el propietario en la propia consulta.
 */
const tx = vi.hoisted(() => ({
  webhookEvent: { createMany: vi.fn() },
  billingCustomer: { findUnique: vi.fn(), createMany: vi.fn() },
  eventPurchase: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), createMany: vi.fn() },
  event: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}));

vi.mock("@/server/db/client", () => ({
  prisma: { ...tx, $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)) },
}));

import { createPendingPurchase, findEventBillingById, findOwnedEventBilling, findProviderCustomerId, listOwnedEventsBilling, prismaBillingStore, saveProviderCustomer, type PurchaseWrite } from "@/server/repositories/billing";

const purchase: PurchaseWrite = { eventId: "evt_A", userId: "usr_A", provider: "STRIPE", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", plan: "ESSENTIAL", kind: "INITIAL", status: "PAID", amount: 49900, currency: "MXN", paidAt: new Date("2027-01-10T00:00:00Z"), accessStartsAt: new Date("2027-01-10T00:00:00Z"), accessEndsAt: new Date("2027-06-16T00:00:00Z") };
const event = { provider: "STRIPE" as const, externalEventId: "evt_1", type: "checkout.session.completed" };
const row = { id: "evt_A", ownerId: "usr_A", title: "Andrea", startsAt: new Date("2027-05-17T23:00:00Z"), paidAccessEndsAt: null, purchases: [{ id: "pur_1", eventId: "evt_A", userId: "usr_A", provider: "STRIPE", providerCheckoutSessionId: "cs_1", providerPaymentIntentId: "pi_1", plan: "ESSENTIAL", kind: "INITIAL", status: "PAID", amount: 49900, currency: "MXN", paidAt: null, accessStartsAt: null, accessEndsAt: null, createdAt: new Date("2027-01-10T00:00:00Z") }] };

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  for (const table of Object.values(tx)) for (const fn of Object.values(table)) fn.mockReset();
});

describe("Repositorio de compras por evento (D-32)", () => {
  it("un evento nuevo se registra con INSERT … ON CONFLICT DO NOTHING y se aplica en la misma transacción", async () => {
    tx.webhookEvent.createMany.mockResolvedValue({ count: 1 });
    tx.event.findUnique.mockResolvedValue({ ownerId: "usr_A", startsAt: new Date(), paidAccessEndsAt: null });
    const apply = vi.fn(async (ops: Parameters<Parameters<typeof prismaBillingStore.recordEventAndApply>[1]>[0]) => {
      expect(await ops.findEvent("evt_A")).toMatchObject({ ownerId: "usr_A" });
      await ops.savePurchase(purchase);
      await ops.setPaidAccessEnd("evt_A", new Date("2027-06-16T00:00:00Z"));
    });
    expect(await prismaBillingStore.recordEventAndApply(event, apply)).toBe("processed");
    expect(tx.webhookEvent.createMany).toHaveBeenCalledWith({ data: [{ provider: "STRIPE", externalEventId: "evt_1", type: "checkout.session.completed" }], skipDuplicates: true });
    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "evt_A" }, data: { paidAccessEndsAt: new Date("2027-06-16T00:00:00Z") } });
  });

  it("(23) un evento ya registrado devuelve «duplicate» y NO aplica nada", async () => {
    tx.webhookEvent.createMany.mockResolvedValue({ count: 0 });
    const apply = vi.fn();
    expect(await prismaBillingStore.recordEventAndApply(event, apply)).toBe("duplicate");
    expect(apply).not.toHaveBeenCalled();
    expect(tx.eventPurchase.upsert).not.toHaveBeenCalled();
  });

  it("si aplicar lanza, el error se propaga (la transacción real se revierte y el evento no queda registrado)", async () => {
    tx.webhookEvent.createMany.mockResolvedValue({ count: 1 });
    await expect(prismaBillingStore.recordEventAndApply(event, async () => Promise.reject(new Error("falló")))).rejects.toThrow("falló");
  });

  it("(25) la compra se guarda con upsert por (proveedor, sesión de cobro): una fila por sesión, nunca dos", async () => {
    tx.webhookEvent.createMany.mockResolvedValue({ count: 1 });
    await prismaBillingStore.recordEventAndApply(event, async (ops) => ops.savePurchase(purchase));
    expect(tx.eventPurchase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider_providerCheckoutSessionId: { provider: "STRIPE", providerCheckoutSessionId: "cs_1" } },
        create: expect.objectContaining({ eventId: "evt_A", userId: "usr_A", providerCheckoutSessionId: "cs_1", providerPaymentIntentId: "pi_1", plan: "ESSENTIAL", kind: "INITIAL", status: "PAID", amount: 49900, currency: "MXN" }),
      }),
    );
  });

  it("(11) el estado de un evento del usuario se lee CON el propietario en la consulta; uno ajeno no aparece", async () => {
    tx.event.findFirst.mockResolvedValue(null);
    expect(await findOwnedEventBilling("usr_B", "evt_A")).toBeNull();
    expect(tx.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "evt_A", ownerId: "usr_B" } }));
    tx.event.findFirst.mockResolvedValue(row);
    expect(await findOwnedEventBilling("usr_A", "evt_A")).toMatchObject({ eventId: "evt_A", purchases: [expect.objectContaining({ checkoutSessionId: "cs_1", paymentIntentId: "pi_1", plan: "ESSENTIAL" })] });
  });

  it("la lectura por id (sin propietario) existe solo para servicios que ya resolvieron la propiedad y para el webhook", async () => {
    tx.event.findUnique.mockResolvedValue(row);
    expect(await findEventBillingById("evt_A")).toMatchObject({ ownerId: "usr_A" });
    expect(tx.event.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "evt_A" } }));
  });

  it("«Compras y planes» lista solo los eventos del usuario que no están archivados", async () => {
    tx.event.findMany.mockResolvedValue([{ ...row, slug: "andrea", _count: { guests: 3, galleryImages: 2 } }]);
    const rows = await listOwnedEventsBilling("usr_A");
    expect(tx.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "usr_A", status: { not: "ARCHIVED" } } }));
    expect(rows[0]).toMatchObject({ slug: "andrea", guestCount: 3, galleryCount: 2 });
  });

  it("(18) la compra PENDING se crea al iniciar el checkout, idempotente por sesión, con el importe en centavos", async () => {
    await createPendingPurchase({ eventId: "evt_A", userId: "usr_A", provider: "STRIPE", checkoutSessionId: "cs_1", plan: "PREMIUM", kind: "UPGRADE", amount: 30000, currency: "MXN" });
    expect(tx.eventPurchase.createMany).toHaveBeenCalledWith({ data: [{ eventId: "evt_A", userId: "usr_A", provider: "STRIPE", providerCheckoutSessionId: "cs_1", plan: "PREMIUM", kind: "UPGRADE", status: "PENDING", amount: 30000, currency: "MXN" }], skipDuplicates: true });
  });

  it("(10) el cliente del proveedor es único por usuario: si otro lo guardó antes, gana el existente", async () => {
    tx.billingCustomer.createMany.mockResolvedValue({ count: 0 });
    tx.billingCustomer.findUnique.mockResolvedValue({ providerCustomerId: "cus_primero" });
    expect(await saveProviderCustomer("usr_A", "STRIPE", "cus_segundo")).toBe("cus_primero");
    expect(tx.billingCustomer.createMany).toHaveBeenCalledWith({ data: [{ userId: "usr_A", provider: "STRIPE", providerCustomerId: "cus_segundo" }], skipDuplicates: true });
    tx.billingCustomer.findUnique.mockResolvedValue({ providerCustomerId: "cus_A" });
    expect(await findProviderCustomerId("usr_A", "STRIPE")).toBe("cus_A");
    expect(tx.billingCustomer.findUnique).toHaveBeenCalledWith({ where: { userId_provider: { userId: "usr_A", provider: "STRIPE" } }, select: { providerCustomerId: true } });
  });

  it("sin base de datos (demostración): las lecturas devuelven «sin compras» (Gratis) y las escrituras se rechazan", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await findOwnedEventBilling("usr_A", "evt_A")).toBeNull();
    expect(await findEventBillingById("evt_A")).toBeNull();
    expect(await listOwnedEventsBilling("usr_A")).toEqual([]);
    expect(await findProviderCustomerId("usr_A", "STRIPE")).toBeNull();
    await expect(saveProviderCustomer("usr_A", "STRIPE", "cus")).rejects.toMatchObject({ name: "StoreUnavailableError" });
    await expect(createPendingPurchase({ eventId: "e", userId: "u", provider: "STRIPE", checkoutSessionId: "cs", plan: "ESSENTIAL", kind: "INITIAL", amount: 1, currency: "MXN" })).rejects.toMatchObject({ name: "StoreUnavailableError" });
    await expect(prismaBillingStore.recordEventAndApply(event, async () => undefined)).rejects.toMatchObject({ name: "StoreUnavailableError" });
  });
});
