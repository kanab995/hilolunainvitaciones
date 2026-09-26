import { describe, expect, it, vi } from "vitest";
import { isTransientDatabaseError } from "@/server/db/errors";
import { WebhookSignatureError } from "@/server/billing/provider";
import { handleBillingWebhook, type BillingWebhookDeps } from "@/server/services/billing-webhook";
import { checkoutIdempotencyKey, CHECKOUT_SESSION_TTL_MS, startEventCheckout } from "@/server/services/billing-service";
import { billingDeps, fakeProvider, PRICE_REFS, purchaseWorld, readyState, payment } from "../helpers/billing-world";
import type { BillingStore } from "@/server/repositories/billing";

const userA = { id: "usr_A", email: "a@example.com", name: "Ana" };
const eventsWorld = () => purchaseWorld({ events: { evt_A: { ownerId: "usr_A", title: "Andrea & Fernando", startsAt: new Date("2027-05-17T23:00:00Z") } } });
const NOW = new Date("2027-01-15T00:00:00Z");

describe("(22/23) webhook: reintento tras un fallo de base de datos", () => {
  const completed = { id: "evt_1", type: "checkout.session.completed", createdAt: new Date("2027-01-15T00:00:00Z"), action: "confirm_payment" as const, checkoutSessionId: "cs_1" };

  function setup(store?: (real: BillingStore) => BillingStore) {
    const world = eventsWorld();
    const { provider } = fakeProvider({ payments: { cs_1: payment() }, webhook: () => completed });
    const real = world.store;
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: store ? store(real) : real };
    return { world, deps };
  }

  it("un fallo TEMPORAL de la base de datos responde 503 con causa transitoria: el evento NO queda registrado y el reintento SÍ concede el plan", async () => {
    let failures = 1;
    const { world, deps } = setup((real) => ({
      ...real,
      async recordEventAndApply(event, apply) {
        if (failures-- > 0) throw Object.assign(new Error("no se pudo conectar con db.internal:5432"), { code: "P1001" });
        return real.recordEventAndApply(event, apply);
      },
    }));

    const first = await handleBillingWebhook({ rawBody: "{}", signature: "sig" }, deps);
    expect(first).toEqual({ status: 503, body: { error: "temporarily_unavailable" } });
    expect(world.webhookEvents.size).toBe(0);
    expect(world.purchases).toHaveLength(0);

    const retry = await handleBillingWebhook({ rawBody: "{}", signature: "sig" }, deps);
    expect(retry).toEqual({ status: 200, body: { received: true } });
    expect(world.webhookEvents.size).toBe(1);
    expect(world.purchases[0]).toMatchObject({ status: "PAID", plan: "ESSENTIAL", checkoutSessionId: "cs_1" });
    // Una tercera entrega (Stripe reenvía) es idempotente.
    expect(await handleBillingWebhook({ rawBody: "{}", signature: "sig" }, deps)).toEqual({ status: 200, body: { received: true, duplicate: true } });
    expect(world.purchases).toHaveLength(1);
  });

  it("un fallo a MITAD de la transacción revierte TODO (ni compra ni evento registrado) y responde 500 para que Stripe reintente", async () => {
    const world = eventsWorld();
    const { provider } = fakeProvider({ payments: { cs_1: payment() }, webhook: () => completed });
    const failing: BillingStore = {
      ...world.store,
      async recordEventAndApply(event, apply) {
        return world.store.recordEventAndApply(event, async (ops) => {
          await apply({ ...ops, setPaidAccessEnd: async () => { throw new Error("violación de restricción"); } });
        });
      },
    };
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: failing };
    expect(await handleBillingWebhook({ rawBody: "{}", signature: "sig" }, deps)).toEqual({ status: 500, body: { error: "processing_failed" } });
    expect(world.webhookEvents.size).toBe(0);
    expect(world.purchases).toHaveLength(0);
    // Reintento con la base de datos sana → se procesa.
    const healthy: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: world.store };
    expect((await handleBillingWebhook({ rawBody: "{}", signature: "sig" }, healthy)).status).toBe(200);
    expect(world.purchases[0]?.status).toBe("PAID");
  });

  it("si Stripe no responde al releer el pago (fallo del proveedor) → 500 sin registrar nada", async () => {
    const world = eventsWorld();
    const { provider } = fakeProvider({ webhook: () => completed, getPayment: async () => { throw Object.assign(new Error("timeout"), { type: "StripeConnectionError" }); } });
    const result = await handleBillingWebhook({ rawBody: "{}", signature: "sig" }, { getProviderState: () => readyState(provider), store: world.store });
    expect(result.status).toBe(500);
    expect(world.webhookEvents.size).toBe(0);
  });

  it("firma inválida → 400 sin tocar la base de datos; los errores de los registros no contienen mensajes del proveedor", async () => {
    const world = eventsWorld();
    const record = vi.spyOn(world.store, "recordEventAndApply");
    const { provider } = fakeProvider({ webhook: () => { throw new WebhookSignatureError(); } });
    expect((await handleBillingWebhook({ rawBody: "{}", signature: "mala" }, { getProviderState: () => readyState(provider), store: world.store })).status).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });

  it("clasificación de fallos temporales de la base de datos (códigos de Prisma)", () => {
    for (const code of ["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"]) expect(isTransientDatabaseError({ code }), code).toBe(true);
    expect(isTransientDatabaseError({ name: "PrismaClientInitializationError" })).toBe(true);
    for (const value of [{ code: "P2002" }, { code: "P2025" }, new Error("otro"), null, undefined, "P1001"]) expect(isTransientDatabaseError(value)).toBe(false);
  });
});

describe("(24/25) checkout: protección contra doble cobro", () => {
  it("doble clic / dos peticiones SIMULTÁNEAS: una sola sesión efectiva y una sola compra pendiente (misma clave de idempotencia)", async () => {
    const { provider, calls, sessionsByKey } = fakeProvider();
    const { deps, world } = billingDeps({ provider, world: eventsWorld() });
    const [a, b] = await Promise.all([startEventCheckout(userA, "evt_A", "ESSENTIAL", deps), startEventCheckout(userA, "evt_A", "ESSENTIAL", deps)]);
    expect(a).toMatchObject({ ok: true });
    expect(b).toEqual(a);
    expect(calls.createEventCheckout).toHaveBeenCalledTimes(2);
    expect(calls.createEventCheckout.mock.calls[0]?.[0].idempotencyKey).toBe(calls.createEventCheckout.mock.calls[1]?.[0].idempotencyKey);
    expect(sessionsByKey.size).toBe(1);
    expect(world.purchases.filter((purchase) => purchase.status === "PENDING")).toHaveLength(1);
  });

  it("un segundo intento posterior REUTILIZA la sesión abierta (mismo enlace) en vez de abrir otra", async () => {
    const { provider, calls } = fakeProvider();
    const { deps, world } = billingDeps({ provider, world: eventsWorld() });
    const first = await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    const second = await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    expect(second).toEqual(first);
    expect(calls.createEventCheckout).toHaveBeenCalledTimes(1);
    expect(world.purchases).toHaveLength(1);
  });

  it("si la sesión anterior CADUCÓ, se puede reintentar: la compra vieja pasa a CANCELED y se abre una sesión nueva", async () => {
    const { provider, calls, sessionStatus } = fakeProvider();
    const { deps, world } = billingDeps({ provider, world: eventsWorld() });
    await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    sessionStatus.set("cs_new_1", "expired");
    const retry = await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    expect(retry).toMatchObject({ ok: true });
    expect(calls.createEventCheckout).toHaveBeenCalledTimes(2);
    expect(world.purchases.map((purchase) => purchase.status)).toEqual(["CANCELED", "PENDING"]);
  });

  it("si la sesión anterior ya se COMPLETÓ (pago hecho, webhook en camino) NO se abre otra: se avisa que se está confirmando", async () => {
    const { provider, calls, sessionStatus } = fakeProvider();
    const { deps } = billingDeps({ provider, world: eventsWorld() });
    await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    sessionStatus.set("cs_new_1", "complete");
    const result = await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    expect(result).toMatchObject({ ok: false, code: "payment_pending" });
    expect(calls.createEventCheckout).toHaveBeenCalledTimes(1);
  });

  it("dos planes distintos a la vez: al elegir otro plan, la sesión abierta del anterior se CADUCA para que no puedan pagarse los dos", async () => {
    const { provider, calls, sessionStatus } = fakeProvider();
    const { deps, world } = billingDeps({ provider, world: eventsWorld() });
    await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    const premium = await startEventCheckout(userA, "evt_A", "PREMIUM", deps);
    expect(premium).toMatchObject({ ok: true });
    expect(calls.expireCheckoutSession).toHaveBeenCalledWith("cs_new_1");
    expect(sessionStatus.get("cs_new_1")).toBe("expired");
    expect(world.purchases.map((purchase) => `${purchase.plan}:${purchase.status}`)).toEqual(["ESSENTIAL:CANCELED", "PREMIUM:PENDING"]);
    // Volver al primer plan dentro de la misma ventana NO devuelve la sesión caducada (la clave cambia con el nº de compras).
    const again = await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    expect(again).toMatchObject({ ok: true });
    expect(sessionStatus.get("cs_new_3")).toBe("open");
  });

  it("un intento FAILED cuya sesión sigue abierta también se reutiliza (aún podría pagarse): no se abre una segunda", async () => {
    const { provider, calls } = fakeProvider();
    const { deps, world } = billingDeps({ provider, world: eventsWorld() });
    const first = await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    world.purchases[0]!.status = "FAILED";
    expect(await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps)).toEqual(first);
    expect(calls.createEventCheckout).toHaveBeenCalledTimes(1);
  });

  it("la clave de idempotencia es estable por intento y cambia con el usuario, el evento, el plan, el tipo, la ventana de 30 min o las compras del evento", () => {
    const base = { userId: "usr_A", eventId: "evt_A", plan: "ESSENTIAL", kind: "INITIAL", now: NOW, purchaseCount: 0 };
    const key = checkoutIdempotencyKey(base);
    expect(key).toMatch(/^hl-co-[0-9a-f]{40}$/);
    expect(checkoutIdempotencyKey({ ...base, now: new Date(NOW.getTime() + 60_000) })).toBe(key);
    for (const change of [{ userId: "usr_B" }, { eventId: "evt_B" }, { plan: "PREMIUM" }, { kind: "UPGRADE" }, { purchaseCount: 1 }, { now: new Date(NOW.getTime() + 31 * 60_000) }]) expect(checkoutIdempotencyKey({ ...base, ...change }), JSON.stringify(change)).not.toBe(key);
    expect(key).not.toContain("usr_A");
  });

  it("la sesión caduca sola (≥ 30 min, límite de Stripe) y la clave viaja al proveedor", async () => {
    const { provider, calls } = fakeProvider();
    const { deps } = billingDeps({ provider, world: eventsWorld() });
    await startEventCheckout(userA, "evt_A", "PREMIUM", deps);
    const input = calls.createEventCheckout.mock.calls[0]?.[0] as { expiresAt: Date; idempotencyKey: string };
    expect(input.expiresAt.getTime() - NOW.getTime()).toBe(CHECKOUT_SESSION_TTL_MS);
    expect(CHECKOUT_SESSION_TTL_MS).toBeGreaterThanOrEqual(30 * 60_000);
    expect(input.idempotencyKey).toMatch(/^hl-co-/);
  });

  it("la clave de idempotencia y expires_at se envían de verdad a Stripe (adaptador)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("server/billing/stripe/stripe-provider.ts", "utf8");
    expect(source).toMatch(/expires_at: Math\.floor\(input\.expiresAt\.getTime\(\) \/ 1000\)/);
    expect(source).toMatch(/\{ idempotencyKey: input\.idempotencyKey \}/);
    expect(PRICE_REFS.STRIPE_PRICE_ESSENTIAL_ONE_TIME).toBeTruthy();
  });
});
