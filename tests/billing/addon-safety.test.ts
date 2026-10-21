import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ADDON_PRICE_ENV_KEYS, hasPaidAddon } from "@/lib/billing/addons";
import { getPlanConfig, PRICE_ENV_KEYS } from "@/lib/billing/plans";
import { getEffectiveEventPlan } from "@/lib/billing/purchase";
import type { BillingProvider, NormalizedWebhookEvent } from "@/server/billing/provider";
import { addonCheckoutExpiry, getAddonHistory, reconcilePrintAddon, startPrintAddonCheckout } from "@/server/services/addon-service";
import { addonPayment, addonRow, completed, EVENT, NOW, setup, USER, webhook } from "../helpers/addon-world";
import { fakeProvider, readyState } from "../helpers/billing-world";

/**
 * ETAPA 4 del complemento (D-48): dos pestañas a la vez, cobros duplicados y su reembolso seguro, el correo de confirmación disparado una sola
 * vez y la garantía de que un complemento nunca toca planes, precios ni compras de planes. Todo en memoria: ni PostgreSQL ni Stripe ni Resend.
 */
const mail = vi.hoisted(() => ({ sendPrintAddonConfirmation: vi.fn(async () => undefined), sendPurchaseConfirmation: vi.fn(async () => undefined), sendUpgradeConfirmation: vi.fn(async () => undefined) }));
vi.mock("@/server/email/service", () => mail);

const ROOT = process.cwd();
const MINUTE = 60 * 1000;

/** Una promesa que se resuelve desde fuera (para detener una llamada a «Stripe» a mitad de camino). */
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

const pendingRows = (world: ReturnType<typeof setup>["world"]) => world.addonPurchases.filter((purchase) => purchase.status === "PENDING");
const refund = (intentId: string, id = `evt_refund_${intentId}`): NormalizedWebhookEvent => ({ id, type: "charge.refunded", createdAt: NOW, action: "refund_payment", paymentIntentId: intentId });

describe("dos pestañas abren el pago a la vez", () => {
  it("misma clave de idempotencia: las dos reciben la MISMA sesión y queda UNA sola compra pendiente", async () => {
    const { deps, world, fake } = setup();
    const [first, second] = await Promise.all([startPrintAddonCheckout(USER, EVENT, deps), startPrintAddonCheckout(USER, EVENT, deps)]);
    expect(first).toEqual({ ok: true, url: "https://checkout.stripe.test/cs_addon_1" });
    expect(second).toEqual(first);
    expect(pendingRows(world)).toHaveLength(1);
    expect(fake.sessionsByKey.size).toBe(1);
  });

  it("claves distintas (justo en el cambio de ventana): la segunda sesión se CADUCA y las dos pestañas pagan la primera", async () => {
    const { deps, world, fake } = setup();
    const gate = deferred();
    let arrived = 0;
    // Las dos peticiones llegan a «Stripe» antes de que ninguna registre su compra pendiente.
    const provider: BillingProvider = {
      ...fake.provider,
      createAddonCheckout: async (input) => {
        arrived += 1;
        if (arrived === 2) gate.resolve();
        await gate.promise;
        return fake.provider.createAddonCheckout(input);
      },
    };
    const at = (now: Date) => ({ ...deps, getProviderState: () => readyState(provider), now: () => now });
    const [first, second] = await Promise.all([startPrintAddonCheckout(USER, EVENT, at(new Date(NOW.getTime() - 1))), startPrintAddonCheckout(USER, EVENT, at(NOW))]);

    expect(fake.sessionsByKey.size).toBe(2); // dos claves → dos sesiones en el proveedor…
    expect(pendingRows(world)).toHaveLength(1); // …pero la base de datos solo admite UNA pendiente
    const winner = pendingRows(world)[0]?.checkoutSessionId as string;
    const loser = [...fake.sessionsByKey.values()].find((id) => id !== winner) as string;
    expect(fake.sessionStatus.get(loser)).toBe("expired");
    expect(first).toEqual({ ok: true, url: `https://checkout.stripe.test/${winner}` });
    expect(second).toEqual(first);
  });

  it("Stripe responde «clave en uso» a la segunda: espera un momento y reutiliza la sesión de la primera", async () => {
    const { deps, world, fake } = setup();
    const firstDone = deferred();
    let calls = 0;
    const provider: BillingProvider = {
      ...fake.provider,
      createAddonCheckout: async (input) => {
        calls += 1;
        if (calls === 2) throw Object.assign(new Error("idempotency_key_in_use"), { type: "StripeIdempotencyError" });
        return fake.provider.createAddonCheckout(input);
      },
    };
    const concurrentDeps = { ...deps, getProviderState: () => readyState(provider), sleep: () => firstDone.promise };
    const first = startPrintAddonCheckout(USER, EVENT, concurrentDeps).finally(() => firstDone.resolve());
    const second = startPrintAddonCheckout(USER, EVENT, concurrentDeps);
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual({ ok: true, url: "https://checkout.stripe.test/cs_addon_1" });
    expect(results[1]).toEqual(results[0]);
    expect(pendingRows(world)).toHaveLength(1);
  });

  it("si la otra pestaña YA pagó mientras tanto: «estamos confirmando tu pago», nunca otra sesión", async () => {
    const { deps, fake } = setup();
    const first = await startPrintAddonCheckout(USER, EVENT, deps);
    expect(first.ok).toBe(true);
    fake.sessionStatus.set("cs_addon_1", "complete");
    expect(await startPrintAddonCheckout(USER, EVENT, deps)).toMatchObject({ ok: false, code: "payment_pending" });
    expect(fake.sessionsByKey.size).toBe(1);
  });

  it("una compra pendiente ANTIGUA (más de 25 h) ya caducada se cierra y no bloquea un intento nuevo", async () => {
    const old = addonRow({ id: "add_old", status: "PENDING", unlockKey: null, paidAt: null, paymentIntentId: null, checkoutSessionId: "cs_old", createdAt: new Date(NOW.getTime() - 48 * 60 * MINUTE) });
    const { deps, world, fake } = setup({ addons: [old] });
    fake.sessionStatus.set("cs_old", "expired");
    const result = await startPrintAddonCheckout(USER, EVENT, deps);
    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.test/cs_addon_1" });
    expect(world.addonPurchases.find((purchase) => purchase.id === "add_old")?.status).toBe("CANCELED");
    expect(pendingRows(world).map((purchase) => purchase.checkoutSessionId)).toEqual(["cs_addon_1"]);
  });

  it("una sesión abierta SIN enlace que reutilizar se caduca antes de cerrarla (no queda una segunda sesión pagable)", async () => {
    const stuck = addonRow({ id: "add_stuck", status: "PENDING", unlockKey: null, paidAt: null, paymentIntentId: null, checkoutSessionId: "cs_stuck", createdAt: NOW });
    const base = fakeProvider();
    const provider = { ...base, provider: { ...base.provider, getCheckoutSession: async (id: string) => (id === "cs_stuck" ? { status: "open" as const, url: null } : base.provider.getCheckoutSession(id)) } };
    const { deps, world } = setup({ addons: [stuck], provider });
    expect((await startPrintAddonCheckout(USER, EVENT, deps)).ok).toBe(true);
    expect(base.calls.expireCheckoutSession).toHaveBeenCalledWith("cs_stuck");
    expect(world.addonPurchases.find((purchase) => purchase.id === "add_stuck")?.status).toBe("CANCELED");
  });

  it("la caducidad de la sesión es FIJA dentro de la ventana de la clave (mismos parámetros → misma sesión) y siempre ≥ 30 min", () => {
    for (const offset of [0, 1, 17 * MINUTE, 30 * MINUTE - 1]) {
      const now = new Date(NOW.getTime() + offset);
      expect(addonCheckoutExpiry(now)).toEqual(addonCheckoutExpiry(NOW));
      const ahead = addonCheckoutExpiry(now).getTime() - now.getTime();
      expect(ahead).toBeGreaterThanOrEqual(31 * MINUTE);
      expect(ahead).toBeLessThanOrEqual(61 * MINUTE);
    }
  });
});

describe("cobro duplicado: identificado y con reembolso seguro", () => {
  /** Evento con el complemento desbloqueado (`cs_addon_1`) y un SEGUNDO cobro pagado sin desbloqueo (`cs_dup`). */
  async function withDuplicate() {
    const provider = fakeProvider({ payments: { cs_addon_1: addonPayment(), cs_dup: addonPayment({ checkoutSessionId: "cs_dup", paymentIntentId: "pi_dup" }) } });
    const world = setup({ provider });
    await webhook(world.world, provider, completed("cs_addon_1", "evt_wh_1"));
    await webhook(world.world, provider, completed("cs_dup", "evt_wh_2"));
    return { ...world, provider };
  }

  it("el segundo cobro queda PAGADO sin desbloqueo y aparece como duplicado en el historial del cliente", async () => {
    const { world } = await withDuplicate();
    const rows = world.addonPurchases.filter((purchase) => purchase.status === "PAID");
    expect(rows.map((purchase) => [purchase.checkoutSessionId, purchase.unlockKey])).toEqual([
      ["cs_addon_1", `${EVENT}:PRINT_FILE`],
      ["cs_dup", null],
    ]);
    const history = await getAddonHistory(USER, async () => world.addonPurchases);
    expect(history.map((row) => [row.id, row.duplicate])).toEqual(rows.map((row) => [row.id, row.checkoutSessionId === "cs_dup"]));
  });

  it("reembolsar el DUPLICADO (lo correcto) deja la descarga intacta", async () => {
    const { world, provider } = await withDuplicate();
    await webhook(world, provider, refund("pi_dup"));
    expect(world.addonPurchases.find((purchase) => purchase.checkoutSessionId === "cs_dup")).toMatchObject({ status: "REFUNDED", unlockKey: null });
    expect(world.addonPurchases.find((purchase) => purchase.checkoutSessionId === "cs_addon_1")).toMatchObject({ status: "PAID", unlockKey: `${EVENT}:PRINT_FILE` });
    expect(hasPaidAddon(world.addonPurchases, "PRINT_FILE")).toBe(true);
  });

  it("reembolsar por error el cobro que DESBLOQUEABA traspasa el desbloqueo al otro pago: el cliente no pierde la descarga", async () => {
    const { world, provider } = await withDuplicate();
    await webhook(world, provider, refund("pi_addon_1"));
    expect(world.addonPurchases.find((purchase) => purchase.checkoutSessionId === "cs_addon_1")).toMatchObject({ status: "REFUNDED", unlockKey: null });
    expect(world.addonPurchases.find((purchase) => purchase.checkoutSessionId === "cs_dup")).toMatchObject({ status: "PAID", unlockKey: `${EVENT}:PRINT_FILE` });
    expect(hasPaidAddon(world.addonPurchases, "PRINT_FILE")).toBe(true);
    // Reembolsar también el segundo: ya no queda ningún pago y la descarga se retira.
    await webhook(world, provider, refund("pi_dup"));
    expect(hasPaidAddon(world.addonPurchases, "PRINT_FILE")).toBe(false);
    expect(world.addonPurchases.every((purchase) => purchase.unlockKey === null)).toBe(true);
  });
});

describe("el correo de confirmación se dispara una sola vez y solo por la compra que desbloquea", () => {
  it("webhook que concede → un aviso; el mismo webhook repetido → ninguno; un cobro duplicado → ninguno", async () => {
    mail.sendPrintAddonConfirmation.mockClear();
    const provider = fakeProvider({ payments: { cs_addon_1: addonPayment(), cs_dup: addonPayment({ checkoutSessionId: "cs_dup", paymentIntentId: "pi_dup" }) } });
    const { world } = setup({ provider });
    await webhook(world, provider, completed("cs_addon_1", "evt_wh_1"));
    expect(mail.sendPrintAddonConfirmation).toHaveBeenCalledTimes(1);
    expect(mail.sendPrintAddonConfirmation).toHaveBeenCalledWith({ eventId: EVENT, provider: "STRIPE", checkoutSessionId: "cs_addon_1" });
    await webhook(world, provider, completed("cs_addon_1", "evt_wh_1")); // reintento del MISMO evento: no se aplica dos veces
    expect(mail.sendPrintAddonConfirmation).toHaveBeenCalledTimes(1);
    await webhook(world, provider, completed("cs_dup", "evt_wh_2"));
    expect(mail.sendPrintAddonConfirmation).toHaveBeenCalledTimes(1);
  });

  it("si la reconciliación del regreso del pago concedió primero, el webhook posterior pide el aviso (el envío es idempotente por compra)", async () => {
    mail.sendPrintAddonConfirmation.mockClear();
    const provider = fakeProvider({ payments: { cs_addon_1: addonPayment() } });
    const { world, deps } = setup({ provider });
    const notifyConfirmed = vi.fn();
    expect((await startPrintAddonCheckout(USER, EVENT, { ...deps, notifyConfirmed })).ok).toBe(true);
    expect(await reconcilePrintAddon(USER, EVENT, { ...deps, notifyConfirmed })).toEqual({ granted: 1 });
    expect(notifyConfirmed).toHaveBeenCalledWith({ eventId: EVENT, provider: "STRIPE", checkoutSessionId: "cs_addon_1" });
    await webhook(world, provider, completed("cs_addon_1", "evt_wh_late"));
    expect(mail.sendPrintAddonConfirmation).toHaveBeenCalledTimes(1);
  });

  it("un pago rechazado (importe incorrecto) no avisa de nada", async () => {
    mail.sendPrintAddonConfirmation.mockClear();
    const provider = fakeProvider({ payments: { cs_addon_1: addonPayment({ amountMinor: 100 }) } });
    const { world } = setup({ provider });
    await webhook(world, provider, completed("cs_addon_1"));
    expect(mail.sendPrintAddonConfirmation).not.toHaveBeenCalled();
  });
});

describe("un complemento nunca concede un plan ni altera precios ni compras de planes", () => {
  it("el pago del complemento no crea, cambia ni reembolsa compras de planes, ni el acceso del evento", async () => {
    const provider = fakeProvider({ payments: { cs_addon_1: addonPayment() } });
    const { world } = setup({ provider });
    const before = { purchases: structuredClone(world.purchases), event: structuredClone(world.events.get(EVENT)), plan: getEffectiveEventPlan(world.purchases) };
    await webhook(world, provider, completed("cs_addon_1"));
    await webhook(world, provider, refund("pi_addon_1"));
    expect(world.purchases).toEqual(before.purchases);
    expect(world.events.get(EVENT)).toEqual(before.event);
    expect(getEffectiveEventPlan(world.purchases)).toBe(before.plan);
    expect(world.writes.filter((write) => !write.startsWith("addon"))).toEqual([]);
  });

  it("los precios de los planes siguen siendo $0 / $499 / $799 y el precio del complemento no es el de ningún plan", () => {
    expect([getPlanConfig("FREE"), getPlanConfig("ESSENTIAL"), getPlanConfig("PREMIUM")].map((plan) => plan.pricing.displayPrice)).toEqual([0, 499, 799]);
    for (const key of ADDON_PRICE_ENV_KEYS) expect(PRICE_ENV_KEYS).not.toContain(key);
  });

  it("migración aditiva: un valor de enum y el índice parcial; no toca EventPurchase ni otras tablas", () => {
    const migration = readFileSync(join(ROOT, "prisma/migrations/20261020120000_addon_single_pending_and_confirmation_email/migration.sql"), "utf8");
    const statements = migration.split("\n").filter((line) => line.trim() && !line.startsWith("--"));
    expect(statements).toEqual([
      `ALTER TYPE "EmailDeliveryKind" ADD VALUE 'ADDON_PURCHASE_CONFIRMATION';`,
      `CREATE UNIQUE INDEX "EventAddonPurchase_one_pending_per_event_addon" ON "EventAddonPurchase"("eventId", "addon") WHERE "status" = 'PENDING';`,
    ]);
    expect(readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")).toMatch(/enum EmailDeliveryKind \{[^}]*ADDON_PURCHASE_CONFIRMATION/);
  });
});
