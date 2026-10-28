import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { addonForPriceKey, ADDON_PRICE_ENV_KEYS, expectedAddonAmountMinor, hasPaidAddon, quoteAddonPurchase } from "@/lib/billing/addons";
import { getEffectiveEventPlan } from "@/lib/billing/purchase";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import type { ProviderPayment } from "@/server/billing/provider";
import { resolveStripeConfig } from "@/server/billing/stripe/config";
import { normalizeStripeSession, StripeBillingProvider } from "@/server/billing/stripe/stripe-provider";
import { validateEnv } from "@/server/config/env";
import { getPrintAddonState, hasPaidPrintAddon, reconcilePrintAddon, startPrintAddonCheckout } from "@/server/services/addon-service";
import { confirmAddonPayment } from "@/server/services/addon-sync";
import { addonPayment, addonRow, completed, EVENT, NOW, published, setup, USER, webhook } from "../helpers/addon-world";
import { fakeProvider, paidPurchase, payment, PRICE_REFS } from "../helpers/billing-world";

/**
 * COMPLEMENTO «Archivo listo para imprimir» (D-48): compra opcional, aparte del plan, con Stripe. Todo en memoria: ni PostgreSQL ni Stripe.
 */
const ROOT = process.cwd();

describe("política del complemento (pura)", () => {
  it("$199 MXN = 19 900 centavos; solo Esencial y Premium; una sola compra pagada por evento", () => {
    expect(expectedAddonAmountMinor("PRINT_FILE")).toBe(19900);
    expect(quoteAddonPurchase("PRINT_FILE", "FREE", [])).toEqual({ ok: false, reason: "ineligible_plan" });
    expect(quoteAddonPurchase("PRINT_FILE", "ESSENTIAL", [])).toMatchObject({ ok: true, amountMinor: 19900, currency: "MXN", priceEnvKey: "STRIPE_PRICE_ADDON_PRINT_FILE" });
    expect(quoteAddonPurchase("PRINT_FILE", "PREMIUM", [{ addon: "PRINT_FILE", status: "PAID" }])).toEqual({ ok: false, reason: "already_purchased" });
    // Un intento pendiente, fallido o un reembolso no cuentan como comprado.
    expect(hasPaidAddon([{ addon: "PRINT_FILE", status: "REFUNDED" }, { addon: "PRINT_FILE", status: "PENDING" }, { addon: "PRINT_FILE", status: "FAILED" }], "PRINT_FILE")).toBe(false);
    expect(addonForPriceKey("STRIPE_PRICE_ADDON_PRINT_FILE")).toBe("PRINT_FILE");
    expect(addonForPriceKey("STRIPE_PRICE_ESSENTIAL_ONE_TIME")).toBeUndefined();
  });

  it("un complemento NUNCA cambia el plan del evento: el plan solo se calcula de las compras de planes", () => {
    // `getEffectiveEventPlan` recibe compras de PLANES; las de complementos viven en otra tabla y ni siquiera tienen `plan`.
    expect(getEffectiveEventPlan([paidPurchase({ plan: "ESSENTIAL" })])).toBe("ESSENTIAL");
    const code = readFileSync(join(ROOT, "server/repositories/billing.ts"), "utf8");
    expect(code).not.toMatch(/eventAddonPurchase\.(findMany|findFirst)\([^)]*plan/);
    expect(readFileSync(join(ROOT, "lib/billing/purchase.ts"), "utf8")).not.toMatch(/addon/i);
  });
});

describe("configuración", () => {
  const base = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_ESSENTIAL_ONE_TIME: "price_e" };

  it("el precio del complemento se lee como los de los planes; uno repetido o mal formado solo apaga el complemento (los planes siguen)", () => {
    const ok = resolveStripeConfig({ ...base, STRIPE_PRICE_ADDON_PRINT_FILE: "price_print" });
    expect(ok.status === "ready" && ok.config.prices.get("STRIPE_PRICE_ADDON_PRINT_FILE")).toBe("price_print");
    for (const bad of ["price_e", "prod_123", "199"]) {
      const result = resolveStripeConfig({ ...base, STRIPE_PRICE_ADDON_PRINT_FILE: bad });
      expect(result.status, bad).toBe("ready");
      if (result.status !== "ready") continue;
      expect(result.config.prices.has("STRIPE_PRICE_ADDON_PRINT_FILE"), bad).toBe(false);
      expect(result.config.prices.get("STRIPE_PRICE_ESSENTIAL_ONE_TIME"), bad).toBe("price_e");
      expect(result.addonProblems, bad).toHaveLength(1);
    }
    // Un precio de PLAN mal formado sigue invalidando la configuración (eso sí rompería cobros).
    expect(resolveStripeConfig({ ...base, STRIPE_PRICE_ESSENTIAL_ONE_TIME: "prod_x" }).status).toBe("invalid");
    expect(ADDON_PRICE_ENV_KEYS).toEqual(["STRIPE_PRICE_ADDON_PRINT_FILE"]);
  });

  it("un complemento mal configurado NUNCA impide arrancar en producción: solo avisa (la venta queda apagada)", () => {
    const prodEnv = { NODE_ENV: "production", APP_ENV: "production", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_ESSENTIAL_ONE_TIME: "price_e", STRIPE_PRICE_PREMIUM_ONE_TIME: "price_p", STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "price_u" };
    const addonProblems = (extra: Record<string, string>) => validateEnv({ ...prodEnv, ...extra }, "production").problems.filter((problem) => problem.variable === "STRIPE_PRICE_ADDON_PRINT_FILE");
    expect(addonProblems({ PRINT_ADDON_ENABLED: "1" })).toMatchObject([{ severity: "warning" }]);
    expect(addonProblems({ PRINT_ADDON_ENABLED: "1", STRIPE_PRICE_ADDON_PRINT_FILE: "prod_123" })).toMatchObject([{ severity: "warning" }]);
    expect(addonProblems({})).toEqual([]);
    expect(addonProblems({ PRINT_ADDON_ENABLED: "1", STRIPE_PRICE_ADDON_PRINT_FILE: "price_print" })).toEqual([]);
    // Ningún problema de Stripe es un error por culpa del complemento.
    expect(validateEnv({ ...prodEnv, PRINT_ADDON_ENABLED: "1", STRIPE_PRICE_ADDON_PRINT_FILE: "prod_123" }, "production").problems.filter((problem) => problem.group === "stripe" && problem.severity === "error")).toEqual([]);
  });

  it("con el precio descartado, la venta queda cerrada (sin botón de compra) aunque el interruptor esté encendido", async () => {
    const fake = fakeProvider({ priceRefFor: (key) => (key === "STRIPE_PRICE_ADDON_PRINT_FILE" ? undefined : (PRICE_REFS as Record<string, string>)[key]) });
    const { deps } = setup({ provider: fake });
    expect(await startPrintAddonCheckout(USER, EVENT, deps)).toMatchObject({ ok: false, code: "not_available" });
    expect((await getPrintAddonState(USER, EVENT, deps))?.saleOpen).toBe(false);
  });

  it(".env.example declara las dos variables, vacías (la venta nace APAGADA)", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(example).toMatch(/^STRIPE_PRICE_ADDON_PRINT_FILE=$/m);
    expect(example).toMatch(/^PRINT_ADDON_ENABLED=$/m);
  });
});

describe("abrir el pago", () => {
  it("evento Esencial: sesión de PAGO ÚNICO del complemento, metadata sin plan, regreso a la versión para imprimir y compra PENDIENTE de 19 900", async () => {
    const { deps, fake, world } = setup();
    const result = await startPrintAddonCheckout(USER, EVENT, deps);
    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.test/cs_addon_1" });
    expect(fake.calls.createEventCheckout).not.toHaveBeenCalled();
    expect(fake.calls.createAddonCheckout).toHaveBeenCalledWith(expect.objectContaining({ priceKey: "STRIPE_PRICE_ADDON_PRINT_FILE", addon: "PRINT_FILE", eventId: EVENT, userId: "usr_A", successUrl: "https://hiloluna.example/dashboard/events/evt_A/print?payment=success", cancelUrl: "https://hiloluna.example/dashboard/events/evt_A/print?payment=canceled" }));
    expect(world.addonPurchases).toMatchObject([{ status: "PENDING", amount: 19900, currency: "MXN", addon: "PRINT_FILE" }]);
    // El plan del evento no se tocó.
    expect(world.purchases).toHaveLength(1);
  });

  it("doble clic: la MISMA sesión de Stripe y una sola compra pendiente", async () => {
    const { deps, world } = setup();
    const first = await startPrintAddonCheckout(USER, EVENT, deps);
    const second = await startPrintAddonCheckout(USER, EVENT, deps);
    expect(second).toEqual(first);
    expect(world.addonPurchases).toHaveLength(1);
  });

  it("una sesión ya COMPLETADA (pago hecho, webhook en camino) no abre otra: «confirmando»", async () => {
    const { deps, fake } = setup();
    await startPrintAddonCheckout(USER, EVENT, deps);
    fake.sessionStatus.set("cs_addon_1", "complete");
    expect(await startPrintAddonCheckout(USER, EVENT, deps)).toMatchObject({ ok: false, code: "payment_pending" });
  });

  it("una sesión caducada se cierra y se puede volver a pagar", async () => {
    const { deps, fake, world } = setup();
    await startPrintAddonCheckout(USER, EVENT, deps);
    fake.sessionStatus.set("cs_addon_1", "expired");
    const again = await startPrintAddonCheckout(USER, EVENT, deps);
    expect(again.ok).toBe(true);
    expect(world.addonPurchases.map((purchase) => purchase.status)).toEqual(["CANCELED", "PENDING"]);
  });

  it("rechazos seguros, sin abrir ningún pago", async () => {
    const cases: [ReturnType<typeof setup>, string][] = [
      [setup({ sale: false }), "not_available"],
      [setup({ plan: "FREE" }), "ineligible_plan"],
      [setup({ addons: [addonRow()] }), "already_purchased"],
      [setup({ publication: { state: "draft" } }), "not_printable"],
      [setup({ publication: { ...published, invitation: { ...andreaFernandoInvitation, eventType: "quinceanera" } } }), "not_printable"],
    ];
    for (const [{ deps, fake }, code] of cases) {
      expect(await startPrintAddonCheckout(USER, EVENT, deps)).toMatchObject({ ok: false, code });
      expect(fake.calls.createAddonCheckout).not.toHaveBeenCalled();
    }
    const { deps } = setup();
    expect(await startPrintAddonCheckout({ ...USER, id: "usr_B" }, EVENT, deps)).toMatchObject({ ok: false, code: "not_found" });
    expect(await startPrintAddonCheckout(USER, "evt A; drop", deps)).toMatchObject({ ok: false, code: "not_found" });
  });

  it("si el precio real de Stripe no es el aprobado (199 MXN, pago único), falla ANTES de cobrar", async () => {
    const fake = fakeProvider({ verifyPrice: async () => false });
    const { deps, world } = setup({ provider: fake });
    expect(await startPrintAddonCheckout(USER, EVENT, deps)).toMatchObject({ ok: false, code: "invalid_config" });
    expect(fake.calls.createAddonCheckout).not.toHaveBeenCalled();
    expect(world.addonPurchases).toEqual([]);
  });
});

describe("webhook del complemento", () => {
  it("pago verificado → complemento PAGADO con su desbloqueo; el plan, el acceso y los correos de plan no cambian", async () => {
    const fake = fakeProvider({ payments: { cs_addon_1: addonPayment() } });
    const { world } = setup({ provider: fake });
    const accessBefore = world.events.get(EVENT)?.paidAccessEndsAt;
    expect(await webhook(world, fake, completed("cs_addon_1"))).toEqual({ status: 200, body: { received: true } });
    expect(world.addonPurchases).toMatchObject([{ status: "PAID", unlockKey: "evt_A:PRINT_FILE", amount: 19900, checkoutSessionId: "cs_addon_1" }]);
    expect(world.purchases).toHaveLength(1);
    expect(getEffectiveEventPlan(world.purchases)).toBe("ESSENTIAL");
    expect(world.events.get(EVENT)?.paidAccessEndsAt).toEqual(accessBefore);
    expect(world.writes.some((write) => write.startsWith("save:") || write.startsWith("access:"))).toBe(false);
  });

  it("con un código de descuento (incluso de 100 %), se desbloquea si precio − descuento = cobrado", async () => {
    for (const [index, item] of [addonPayment({ amountMinor: 9900, subtotalMinor: 19900, discountMinor: 10000 }), addonPayment({ amountMinor: 0, subtotalMinor: 19900, discountMinor: 19900, paymentIntentId: null })].entries()) {
      const fake = fakeProvider({ payments: { [item.checkoutSessionId]: item } });
      const { world } = setup({ provider: fake });
      await webhook(world, fake, completed(item.checkoutSessionId, `evt_discount_${index}`));
      expect(world.addonPurchases, `caso ${index}`).toMatchObject([{ status: "PAID", unlockKey: "evt_A:PRINT_FILE", amount: item.amountMinor }]);
    }
  });

  it("el mismo evento de webhook dos veces no se aplica dos veces", async () => {
    const fake = fakeProvider({ payments: { cs_addon_1: addonPayment() } });
    const { world } = setup({ provider: fake });
    await webhook(world, fake, completed("cs_addon_1"));
    expect(await webhook(world, fake, completed("cs_addon_1"))).toEqual({ status: 200, body: { received: true, duplicate: true } });
    expect(world.addonPurchases).toHaveLength(1);
  });

  it("verificación estricta: importe, moneda, precio, metadata, propietario", async () => {
    const bad: ProviderPayment[] = [
      addonPayment({ amountMinor: 100 }),
      // Un «descuento» que no cuadra con el precio de lista no desbloquea nada.
      addonPayment({ amountMinor: 0, subtotalMinor: 100, discountMinor: 100 }),
      addonPayment({ amountMinor: 9900, subtotalMinor: 19900, discountMinor: 0 }),
      addonPayment({ currency: "USD" }),
      // Precio de un PLAN con metadata de complemento: ni complemento ni plan.
      addonPayment({ priceRefs: [PRICE_REFS.STRIPE_PRICE_ESSENTIAL_ONE_TIME], amountMinor: 49900 }),
      // Precio del complemento con metadata de plan: jamás concede un plan.
      addonPayment({ metadata: { userId: "usr_A", eventId: EVENT, targetPlan: "PREMIUM" } }),
      addonPayment({ metadata: { userId: "usr_B", eventId: EVENT, addon: "PRINT_FILE" } }),
      addonPayment({ metadata: { userId: "usr_A", eventId: "evt_ajeno", addon: "PRINT_FILE" } }),
    ];
    for (const [index, item] of bad.entries()) {
      const fake = fakeProvider({ payments: { [item.checkoutSessionId]: item } });
      const { world } = setup({ plan: "FREE", provider: fake });
      await webhook(world, fake, completed(item.checkoutSessionId, `evt_bad_${index}`));
      expect(world.addonPurchases.filter((purchase) => purchase.status === "PAID"), `caso ${index}`).toEqual([]);
      expect(world.purchases.filter((purchase) => purchase.status === "PAID"), `caso ${index}`).toEqual([]);
    }
  });

  it("un SEGUNDO pago cobrado del mismo complemento no crea otro desbloqueo y queda señalado para reembolsar", async () => {
    const world = setup({ addons: [addonRow()] }).world;
    const ops = { ...(await new Promise<Parameters<Parameters<typeof world.store.apply>[0]>[0]>((resolve) => void world.store.apply(async (o) => resolve(o)))) };
    const outcome = await confirmAddonPayment(ops, fakeProvider().provider, addonPayment({ checkoutSessionId: "cs_addon_2", paymentIntentId: "pi_addon_2" }), NOW);
    expect(outcome).toBe("duplicate_payment");
    expect(world.addonPurchases.filter((purchase) => purchase.unlockKey)).toHaveLength(1);
    expect(world.addonPurchases.find((purchase) => purchase.checkoutSessionId === "cs_addon_2")).toMatchObject({ status: "PAID", unlockKey: null });
  });

  it("reembolso total → REFUNDED: se retira la descarga y se libera el desbloqueo (se puede volver a comprar); el plan no cambia", async () => {
    const fake = fakeProvider();
    const { world, deps } = setup({ addons: [addonRow()], provider: fake });
    expect(await hasPaidPrintAddon("usr_A", EVENT, deps)).toBe(true);
    await webhook(world, fake, { id: "evt_ref", type: "charge.refunded", createdAt: NOW, action: "refund_payment", paymentIntentId: "pi_addon_seed" });
    expect(world.addonPurchases[0]).toMatchObject({ status: "REFUNDED", unlockKey: null });
    expect(await hasPaidPrintAddon("usr_A", EVENT, deps)).toBe(false);
    expect(getEffectiveEventPlan(world.purchases)).toBe("ESSENTIAL");
    expect(quoteAddonPurchase("PRINT_FILE", "ESSENTIAL", world.addonPurchases).ok).toBe(true);
  });

  it("reembolsar el PLAN no toca el complemento (se pagó aparte)", async () => {
    const fake = fakeProvider();
    const { world } = setup({ addons: [addonRow()], provider: fake });
    await webhook(world, fake, { id: "evt_ref_plan", type: "charge.refunded", createdAt: NOW, action: "refund_payment", paymentIntentId: "pi_seed" });
    expect(world.purchases[0]?.status).toBe("REFUNDED");
    expect(world.addonPurchases[0]).toMatchObject({ status: "PAID", unlockKey: "evt_A:PRINT_FILE" });
  });

  it("una sesión caducada cierra la compra pendiente del complemento (CANCELED) sin tocar compras de planes", async () => {
    const { world, deps, fake } = setup();
    await startPrintAddonCheckout(USER, EVENT, deps);
    await webhook(world, fake, { id: "evt_exp", type: "checkout.session.expired", createdAt: NOW, action: "close_payment", outcome: "CANCELED", checkoutSessionId: "cs_addon_1" });
    expect(world.addonPurchases[0]?.status).toBe("CANCELED");
    expect(world.purchases[0]?.status).toBe("PAID");
  });

  it("los pagos de PLANES siguen exactamente igual con el precio del complemento configurado", async () => {
    const fake = fakeProvider({ payments: { cs_1: payment() } });
    const { world } = setup({ plan: "FREE", provider: fake });
    await webhook(world, fake, completed("cs_1"));
    expect(getEffectiveEventPlan(world.purchases)).toBe("ESSENTIAL");
    expect(world.addonPurchases).toEqual([]);
  });
});

describe("regreso del pago y estado en la página", () => {
  it("al volver de Stripe se reconcilia con las MISMAS verificaciones y queda comprado", async () => {
    const fake = fakeProvider();
    const { deps, world } = setup({ provider: fake });
    await startPrintAddonCheckout(USER, EVENT, deps);
    fake.provider.getPayment = vi.fn(async () => addonPayment({ checkoutSessionId: "cs_addon_1" }));
    expect(await reconcilePrintAddon(USER, EVENT, deps)).toEqual({ granted: 1 });
    expect(world.addonPurchases[0]?.status).toBe("PAID");
    expect(await getPrintAddonState(USER, EVENT, deps)).toMatchObject({ purchased: true, pendingPayment: false, eligible: true, saleOpen: true, qrValidUntil: new Date("2027-06-16T23:00:00Z") });
  });

  it("estado: venta cerrada si el interruptor está apagado o falta el precio; pago pendiente visible", async () => {
    expect((await getPrintAddonState(USER, EVENT, setup({ sale: false }).deps))?.saleOpen).toBe(false);
    const noPrice = fakeProvider({ priceRefFor: (key) => (key === "STRIPE_PRICE_ADDON_PRINT_FILE" ? undefined : "price_x") });
    expect((await getPrintAddonState(USER, EVENT, setup({ provider: noPrice }).deps))?.saleOpen).toBe(false);
    const { deps } = setup();
    await startPrintAddonCheckout(USER, EVENT, deps);
    expect(await getPrintAddonState(USER, EVENT, deps)).toMatchObject({ pendingPayment: true, purchased: false });
  });
});

describe("Stripe: metadata y migración", () => {
  it("la sesión normalizada conserva `addon` (orientativo: la autoridad es el precio)", () => {
    const session = { id: "cs_x", object: "checkout.session", mode: "payment", payment_status: "paid", status: "complete", amount_total: 19900, currency: "mxn", customer: "cus_A", payment_intent: "pi_x", metadata: { hiloLunaUserId: "usr_A", eventId: EVENT, addon: "PRINT_FILE" }, line_items: { data: [{ price: { id: "price_print_file" } }] } } as unknown as Stripe.Checkout.Session;
    expect(normalizeStripeSession(session).metadata).toEqual({ userId: "usr_A", eventId: EVENT, addon: "PRINT_FILE" });
    const provider = new StripeBillingProvider({} as Stripe, { webhookSecret: "whsec_x", prices: new Map([["STRIPE_PRICE_ADDON_PRINT_FILE", "price_print_file"]]) });
    expect(provider.priceKeyFor("price_print_file")).toBe("STRIPE_PRICE_ADDON_PRINT_FILE");
  });

  it("la sesión del complemento se crea en modo PAGO ÚNICO y sin `targetPlan` (código del adaptador)", () => {
    const source = readFileSync(join(ROOT, "server/billing/stripe/stripe-provider.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    const block = source.slice(source.indexOf("async createAddonCheckout"), source.indexOf("async getCheckoutSession"));
    expect(block).toContain('mode: "payment"');
    expect(block).toContain("addon: input.addon");
    expect(block).not.toContain("targetPlan");
  });

  it("migración ADITIVA: tabla y enum nuevos, desbloqueo único, CHECK de coherencia; EventPurchase intacta", () => {
    const dir = readdirSync(join(ROOT, "prisma/migrations")).find((name) => name.endsWith("_add_event_addon_purchases"));
    expect(dir).toBeDefined();
    const sql = readFileSync(join(ROOT, "prisma/migrations", dir as string, "migration.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE "EventAddonPurchase"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "EventAddonPurchase_unlockKey_key"/);
    expect(sql).toMatch(/"EventAddonPurchase_unlock_requires_paid" CHECK \("unlockKey" IS NULL OR "status" = 'PAID'\)/);
    expect(sql).not.toMatch(/"EventPurchase"/);
    expect(sql.replace(/ON DELETE \w+/g, "")).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bRENAME\b|ALTER COLUMN/i);
  });
});
