import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "@/lib/site-url";
import { resolveStripeConfig } from "@/server/billing/stripe/config";
import { createBillingPortal, getBillingOverview, getEventUpgradeView, reconcileEventPayments, startEventCheckout } from "@/server/services/billing-service";
import { billingDeps, fakeProvider, paidPurchase, payment, purchaseWorld } from "../helpers/billing-world";

const ROOT = process.cwd();
const userA = { id: "usr_A", email: "a@example.com", name: "Ana" };
const userB = { id: "usr_B", email: "b@example.com", name: "Beto" };
const code = (file: string) => readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const eventsWorld = (purchases = [] as ReturnType<typeof paidPurchase>[]) =>
  purchaseWorld({
    events: {
      evt_A: { ownerId: "usr_A", title: "Andrea & Fernando", startsAt: new Date("2027-05-17T23:00:00Z") },
      evt_B: { ownerId: "usr_A", title: "Cumpleaños", startsAt: new Date("2027-08-01T20:00:00Z") },
      evt_of_b: { ownerId: "usr_B", title: "De Beto", startsAt: new Date("2027-09-01T20:00:00Z") },
    },
    purchases,
  });

describe("Checkout de UN evento (18, 19, 75)", () => {
  it("(75.1) el checkout exige un evento PROPIO: un id inexistente o ajeno responde igual y no toca al proveedor", async () => {
    const { provider, calls } = fakeProvider();
    const { deps } = billingDeps({ provider, world: eventsWorld() });
    for (const eventId of ["evt_inexistente", "evt_of_b"]) expect(await startEventCheckout(userA, eventId, "ESSENTIAL", deps), eventId).toEqual({ ok: false, code: "not_found", message: "No encontramos este evento." });
    expect(calls.createCustomer).not.toHaveBeenCalled();
    expect(calls.createEventCheckout).not.toHaveBeenCalled();
  });

  it("(75.2/11) el usuario B NO puede pagar el evento A: no crea sesión, ni cliente, ni compra pendiente", async () => {
    const { provider, calls } = fakeProvider();
    const { deps, world, pending } = billingDeps({ provider, world: eventsWorld() });
    expect(await startEventCheckout(userB, "evt_A", "PREMIUM", deps)).toMatchObject({ ok: false, code: "not_found" });
    expect(calls.createEventCheckout).not.toHaveBeenCalled();
    expect(pending).toEqual([]);
    expect(world.customers.size).toBe(0);
  });

  it("(75.3) el cliente no puede enviar un Price ID ni un plan arbitrario", async () => {
    const { provider, calls } = fakeProvider();
    const { deps } = billingDeps({ provider, world: eventsWorld() });
    for (const hostile of ["price_hackeado", "price_ess_once", "FREE", "free", "", "essential", null, undefined, 42, { plan: "PREMIUM" }, ["PREMIUM"]]) {
      expect(await startEventCheckout(userA, "evt_A", hostile, deps), String(hostile)).toMatchObject({ ok: false, code: "invalid_plan" });
    }
    expect(calls.createEventCheckout).not.toHaveBeenCalled();
  });

  it("(75.4/18) el servidor resuelve el precio: la sesión recibe la VARIABLE de precio, el plan, el evento y el usuario; nunca un priceId del cliente", async () => {
    const { provider, calls } = fakeProvider();
    const { deps } = billingDeps({ provider, world: eventsWorld() });
    expect(await startEventCheckout(userA, "evt_A", "PREMIUM", deps)).toEqual({ ok: true, url: "https://checkout.stripe.test/session_1" });
    expect(calls.createEventCheckout).toHaveBeenCalledWith(expect.objectContaining({ priceKey: "STRIPE_PRICE_PREMIUM_ONE_TIME", plan: "PREMIUM", eventId: "evt_A", userId: "usr_A" }));
    expect(Object.keys(calls.createEventCheckout.mock.calls[0]![0] as object).sort()).toEqual(["cancelUrl", "eventId", "expiresAt", "idempotencyKey", "plan", "priceKey", "providerCustomerId", "successUrl", "userId"]);
    expect(provider.priceRefFor("STRIPE_PRICE_PREMIUM_ONE_TIME")).toBe("price_pre_once");
  });

  it("(75.5) la sesión de Stripe es de PAGO ÚNICO (mode: payment), con metadata mínima y sin suscripción, cupones ni pruebas", () => {
    const source = code("server/billing/stripe/stripe-provider.ts");
    expect(source).toMatch(/mode: "payment"/);
    expect(source).not.toMatch(/mode: "subscription"|subscription_data|allow_promotion_codes|trial_period_days|coupon|discounts/);
    expect(source).toMatch(/const metadata = \{ hiloLunaUserId: input\.userId, eventId: input\.eventId, targetPlan: input\.plan \}/);
    expect(source).toMatch(/payment_intent_data: \{ metadata \}/);
  });

  it("(75.6/10) el cliente del proveedor se reutiliza entre compras (y entre eventos): se crea una sola vez", async () => {
    const existing = fakeProvider();
    const withCustomer = billingDeps({ provider: existing.provider, world: (() => { const w = eventsWorld(); w.customers.set("usr_A", "cus_existing"); return w; })() });
    await startEventCheckout(userA, "evt_A", "ESSENTIAL", withCustomer.deps);
    expect(existing.calls.createCustomer).not.toHaveBeenCalled();
    expect(existing.calls.createEventCheckout).toHaveBeenCalledWith(expect.objectContaining({ providerCustomerId: "cus_existing" }));

    const fresh = fakeProvider();
    const first = billingDeps({ provider: fresh.provider, world: eventsWorld() });
    await startEventCheckout(userA, "evt_A", "ESSENTIAL", first.deps);
    await startEventCheckout(userA, "evt_B", "PREMIUM", first.deps);
    expect(fresh.calls.createCustomer).toHaveBeenCalledTimes(1);
    expect(first.world.customers.get("usr_A")).toBe("cus_new_usr_A");
  });

  it("(21/20/66) las URL de regreso vuelven al dashboard del EVENTO (?payment=) y salen de getSiteUrl(); nada de dominios escritos a mano", async () => {
    const { provider, calls } = fakeProvider();
    const { deps } = billingDeps({ provider, world: eventsWorld(), siteUrl: () => getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://staging.example.com", NODE_ENV: "production" }) });
    await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    expect(calls.createEventCheckout).toHaveBeenCalledWith(expect.objectContaining({ successUrl: "https://staging.example.com/dashboard/events/evt_A?payment=success", cancelUrl: "https://staging.example.com/dashboard/events/evt_A?payment=canceled" }));
    expect(code("server/services/billing-service.ts")).toMatch(/siteUrl: \(\) => getSiteUrl\(\)/);
    for (const file of ["server/services/billing-service.ts", "server/billing/stripe/stripe-provider.ts", "app/api/webhooks/stripe/route.ts"]) expect(code(file), file).not.toMatch(/hiloluna\.com|localhost/);
  });

  it("(18) la acción exige sesión y solo lee eventId y plan del formulario (ni userId, ni priceId, ni customer)", () => {
    const actions = code("app/(site)/dashboard/(workspace)/billing/actions.ts");
    expect(actions).toMatch(/await requireAuth\(\)/);
    expect([...actions.matchAll(/formData\.get\("(\w+)"\)/g)].map((match) => match[1])).toEqual(["eventId", "plan"]);
    expect(code("server/services/billing-service.ts")).toMatch(/export async function startEventCheckout\(user: Pick<AppUser, "id" \| "email" \| "name">, rawEventId: unknown, rawPlan: unknown/);
  });

  it("al iniciar el pago se anota la compra PENDING con el importe esperado (centavos) y la moneda; aún NO concede nada", async () => {
    const { provider } = fakeProvider();
    const { deps, pending, world } = billingDeps({ provider, world: eventsWorld() });
    await startEventCheckout(userA, "evt_A", "PREMIUM", deps);
    expect(pending).toEqual(["evt_A:PREMIUM:INITIAL:79900:MXN:cs_new_1"]);
    expect(world.purchases[0]).toMatchObject({ status: "PENDING", plan: "PREMIUM", paidAt: null });
  });

  it("(15/52) desde Esencial, Premium se cobra como MEJORA con su precio específico y solo la diferencia (30000 centavos)", async () => {
    const { provider, calls } = fakeProvider();
    const { deps, pending } = billingDeps({ provider, world: eventsWorld([paidPurchase()]) });
    expect((await startEventCheckout(userA, "evt_A", "PREMIUM", deps)).ok).toBe(true);
    expect(calls.createEventCheckout).toHaveBeenCalledWith(expect.objectContaining({ priceKey: "STRIPE_PRICE_ESSENTIAL_TO_PREMIUM", plan: "PREMIUM" }));
    expect(pending[0]).toBe("evt_A:PREMIUM:UPGRADE:30000:MXN:cs_new_1");
  });

  it("(76.4/76.5) sin bajar de plan ni recomprar: Premium no compra Esencial ni Premium; Esencial no repite Esencial", async () => {
    const premiumWorld = () => eventsWorld([paidPurchase({ plan: "PREMIUM", kind: "INITIAL", amount: 79900 })]);
    const { provider, calls } = fakeProvider();
    const p = billingDeps({ provider, world: premiumWorld() });
    expect(await startEventCheckout(userA, "evt_A", "ESSENTIAL", p.deps)).toMatchObject({ ok: false, code: "downgrade" });
    expect(await startEventCheckout(userA, "evt_A", "PREMIUM", p.deps)).toMatchObject({ ok: false, code: "already_at_plan" });
    const e = billingDeps({ provider, world: eventsWorld([paidPurchase()]) });
    expect(await startEventCheckout(userA, "evt_A", "ESSENTIAL", e.deps)).toMatchObject({ ok: false, code: "already_at_plan" });
    expect(calls.createEventCheckout).not.toHaveBeenCalled();
  });

  it("(76.1) Gratis → Esencial y (76.2/51) Gratis → Premium directo, cada uno a su precio completo", async () => {
    const { provider, calls } = fakeProvider();
    const { deps, pending } = billingDeps({ provider, world: eventsWorld() });
    await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps);
    await startEventCheckout(userA, "evt_B", "PREMIUM", deps);
    expect(calls.createEventCheckout).toHaveBeenNthCalledWith(1, expect.objectContaining({ priceKey: "STRIPE_PRICE_ESSENTIAL_ONE_TIME" }));
    expect(calls.createEventCheckout).toHaveBeenNthCalledWith(2, expect.objectContaining({ priceKey: "STRIPE_PRICE_PREMIUM_ONE_TIME" }));
    expect(pending.map((row) => row.split(":").slice(0, 5).join(":"))).toEqual(["evt_A:ESSENTIAL:INITIAL:49900:MXN", "evt_B:PREMIUM:INITIAL:79900:MXN"]);
  });

  it("sin pagos configurados el checkout responde con un mensaje claro y no revienta; configuración inconsistente también", async () => {
    const { deps } = billingDeps({ getProviderState: () => ({ status: "not_configured" }), world: eventsWorld() });
    expect(await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps)).toEqual({ ok: false, code: "not_configured", message: "Los pagos todavía no están configurados en este entorno." });
    const { deps: invalid } = billingDeps({ getProviderState: () => ({ status: "invalid", problems: ["STRIPE_WEBHOOK_SECRET"] }), world: eventsWorld() });
    expect(await startEventCheckout(userA, "evt_A", "ESSENTIAL", invalid)).toMatchObject({ ok: false, code: "invalid_config" });
  });

  it("un precio no configurado impide comprar ese plan", async () => {
    const { provider } = fakeProvider({ priceRefFor: (key) => (key === "STRIPE_PRICE_ESSENTIAL_ONE_TIME" ? "price_ess_once" : undefined) });
    const { deps } = billingDeps({ provider, world: eventsWorld() });
    expect(await startEventCheckout(userA, "evt_A", "PREMIUM", deps)).toMatchObject({ ok: false, code: "invalid_plan" });
    expect((await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps)).ok).toBe(true);
  });

  it("un error del proveedor se traduce a un mensaje seguro (sin el texto del SDK) y no deja compra pendiente", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { provider } = fakeProvider({ createEventCheckout: async () => Promise.reject(Object.assign(new Error("No such price: 'price_secreto' sk_test_ABC"), { code: "resource_missing" })) });
    const { deps, pending } = billingDeps({ provider, world: eventsWorld() });
    expect(await startEventCheckout(userA, "evt_A", "ESSENTIAL", deps)).toEqual({ ok: false, code: "error", message: "No pudimos iniciar el pago. Inténtalo de nuevo en unos instantes." });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/price_secreto|sk_test/);
    expect(pending).toEqual([]);
    spy.mockRestore();
  });
});

describe("Configuración de precios de pago único (17, 54, 61)", () => {
  const ok = { STRIPE_SECRET_KEY: "sk_test_a", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_a", STRIPE_WEBHOOK_SECRET: "whsec_a", STRIPE_PRICE_ESSENTIAL_ONE_TIME: "price_e", STRIPE_PRICE_PREMIUM_ONE_TIME: "price_p", STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "price_u" };

  it("los precios salen de STRIPE_PRICE_ESSENTIAL_ONE_TIME, STRIPE_PRICE_PREMIUM_ONE_TIME y STRIPE_PRICE_ESSENTIAL_TO_PREMIUM", () => {
    const result = resolveStripeConfig(ok);
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect([...result.config.prices]).toEqual([["STRIPE_PRICE_ESSENTIAL_ONE_TIME", "price_e"], ["STRIPE_PRICE_PREMIUM_ONE_TIME", "price_p"], ["STRIPE_PRICE_ESSENTIAL_TO_PREMIUM", "price_u"]]);
  });

  it("las variables mensuales anteriores ya no significan nada (no configuran ningún precio)", () => {
    const legacyOnly = resolveStripeConfig({ STRIPE_SECRET_KEY: "sk_test_a", STRIPE_WEBHOOK_SECRET: "whsec_a", STRIPE_PRICE_ESSENTIAL_MONTHLY: "price_m1", STRIPE_PRICE_PREMIUM_MONTHLY: "price_m2" });
    expect(legacyOnly.status).toBe("invalid");
    if (legacyOnly.status === "invalid") expect(legacyOnly.problems.join(" ")).toMatch(/ningún precio/);
  });

  it("(68) sin clave secreta no está configurado; sin secreto de webhook, con modos mezclados o precios mal formados o repetidos → inválido sin exponer valores", () => {
    expect(resolveStripeConfig({})).toEqual({ status: "not_configured" });
    expect(resolveStripeConfig({ ...ok, STRIPE_WEBHOOK_SECRET: "" }).status).toBe("invalid");
    expect(resolveStripeConfig({ ...ok, STRIPE_PRICE_ESSENTIAL_ONE_TIME: "prod_x" }).status).toBe("invalid");
    expect(resolveStripeConfig({ ...ok, STRIPE_PRICE_PREMIUM_ONE_TIME: "price_e" }).status).toBe("invalid");
    const mixed = resolveStripeConfig({ ...ok, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_a" });
    expect(mixed.status).toBe("invalid");
    if (mixed.status === "invalid") expect(JSON.stringify(mixed.problems)).not.toMatch(/sk_test_a|pk_live_a/);
  });

  it("solo con los dos precios de compra inicial (sin el de mejora) la configuración es válida y la mejora simplemente no se ofrece", async () => {
    const result = resolveStripeConfig({ ...ok, STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "" });
    expect(result.status).toBe("ready");
    const { provider } = fakeProvider({ priceRefFor: (key) => (key === "STRIPE_PRICE_ESSENTIAL_TO_PREMIUM" ? undefined : `price_${key}`) });
    const { deps } = billingDeps({ provider, world: eventsWorld([paidPurchase()]) });
    expect(await startEventCheckout(userA, "evt_A", "PREMIUM", deps)).toMatchObject({ ok: false, code: "invalid_plan" });
  });
});

describe("Vistas para la interfaz y reconciliación", () => {
  it("(66) las opciones del panel: Gratis ofrece Esencial $499 y Premium $799; con Esencial, Premium es una mejora de $300; con Premium no hay nada que comprar", async () => {
    const free = billingDeps({ world: eventsWorld() });
    expect((await getEventUpgradeView(userA, "evt_A", free.deps))?.options).toEqual([
      { plan: "ESSENTIAL", state: "available", kind: "INITIAL", amount: 499 },
      { plan: "PREMIUM", state: "available", kind: "INITIAL", amount: 799 },
    ]);
    const essential = billingDeps({ world: eventsWorld([paidPurchase()]) });
    expect((await getEventUpgradeView(userA, "evt_A", essential.deps))?.options).toEqual([
      { plan: "ESSENTIAL", state: "current", kind: null, amount: null },
      { plan: "PREMIUM", state: "available", kind: "UPGRADE", amount: 300 },
    ]);
    const premium = billingDeps({ world: eventsWorld([paidPurchase({ plan: "PREMIUM", amount: 79900 })]) });
    const view = await getEventUpgradeView(userA, "evt_A", premium.deps);
    expect(view?.plan).toBe("PREMIUM");
    expect(view?.options.every((option) => option.state !== "available")).toBe(true);
  });

  it("(11) la vista de un evento ajeno no existe (undefined)", async () => {
    const { deps } = billingDeps({ world: eventsWorld() });
    expect(await getEventUpgradeView(userB, "evt_A", deps)).toBeUndefined();
  });

  it("(20/63) «Estamos confirmando tu pago…» solo si hay una compra PENDING reciente; una abandonada hace horas no cuenta", async () => {
    const recent = billingDeps({ world: eventsWorld([paidPurchase({ id: "p1", status: "PENDING", paidAt: null, createdAt: new Date("2027-01-14T23:30:00Z") })]) });
    expect((await getEventUpgradeView(userA, "evt_A", recent.deps))?.pendingPayment).toBe(true);
    const stale = billingDeps({ world: eventsWorld([paidPurchase({ id: "p1", status: "PENDING", paidAt: null, createdAt: new Date("2027-01-10T00:00:00Z") })]) });
    expect((await getEventUpgradeView(userA, "evt_A", stale.deps))?.pendingPayment).toBe(false);
  });

  it("(39/71) «Compras y planes» lista SOLO los eventos del usuario, con el plan de cada uno y su historial (sin conteos de eventos)", async () => {
    const world = eventsWorld([paidPurchase({ eventId: "evt_A", plan: "PREMIUM", amount: 79900 }), paidPurchase({ id: "p2", eventId: "evt_of_b", userId: "usr_B", checkoutSessionId: "cs_b" })]);
    const { deps } = billingDeps({ world });
    const overview = await getBillingOverview(userA, deps);
    expect(overview.events.map((event) => [event.title, event.plan])).toEqual([["Andrea & Fernando", "PREMIUM"], ["Cumpleaños", "FREE"]]);
    expect(overview.events[0]?.purchases).toEqual([expect.objectContaining({ plan: "PREMIUM", amount: 79900, status: "PAID" })]);
    expect(overview.events[0]?.guests.max).toBe(300);
    expect(overview.events[1]?.guests.max).toBe(30);
    expect(overview.events[0]?.canUpgrade).toBe(false);
    expect(overview.events[1]?.canUpgrade).toBe(true);
    expect(JSON.stringify(overview)).not.toContain("usr_B");
    expect(Object.keys(overview)).not.toContain("plan");
  });

  it("la reconciliación aplica los pagos PENDING de ESE evento con las mismas verificaciones que el webhook", async () => {
    const world = eventsWorld([paidPurchase({ id: "p1", status: "PENDING", paidAt: null, checkoutSessionId: "cs_1", paymentIntentId: null })]);
    world.customers.set("usr_A", "cus_A");
    const { provider } = fakeProvider({ payments: { cs_1: payment() } });
    const { deps } = billingDeps({ provider, world });
    expect(await reconcileEventPayments(userA, "evt_A", deps)).toEqual({ granted: 1 });
    expect(world.purchases.find((purchase) => purchase.checkoutSessionId === "cs_1")).toMatchObject({ status: "PAID", plan: "ESSENTIAL" });
    expect(await reconcileEventPayments(userB, "evt_A", deps)).toEqual({ granted: 0 });
  });

  it("la reconciliación rechaza un pago que no cuadra (importe distinto): no concede nada", async () => {
    const world = eventsWorld([paidPurchase({ id: "p1", status: "PENDING", paidAt: null, checkoutSessionId: "cs_1", paymentIntentId: null })]);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { provider } = fakeProvider({ payments: { cs_1: payment({ amountMinor: 100 }) } });
    const { deps } = billingDeps({ provider, world });
    expect(await reconcileEventPayments(userA, "evt_A", deps)).toEqual({ granted: 0 });
    expect(world.purchases[0]?.status).toBe("PENDING");
  });
});

describe("Portal del cliente (41) y datos de pago (32)", () => {
  it("el portal se conserva para recibos, pero solo con el cliente guardado PARA ESTE usuario, y ninguna pantalla lo presenta como gestión del plan", async () => {
    const { provider, calls } = fakeProvider();
    const world = eventsWorld();
    world.customers.set("usr_A", "cus_A");
    world.customers.set("usr_B", "cus_B");
    const { deps } = billingDeps({ provider, world });
    expect(await createBillingPortal(userA, deps)).toEqual({ ok: true, url: "https://billing.stripe.test/portal_1" });
    expect(calls.createPortalSession).toHaveBeenCalledWith({ providerCustomerId: "cus_A", returnUrl: "https://hiloluna.example/dashboard/billing" });
    expect(await createBillingPortal({ id: "usr_C" }, deps)).toMatchObject({ ok: false, code: "no_customer" });
    for (const file of ["components/billing/billing-overview.tsx", "components/billing/upgrade-event-dialog.tsx", "components/billing/pricing-plans.tsx"]) expect(code(file), file).not.toMatch(/Administrar suscripci|Portal|createBillingPortal/);
  });

  it("(32) Hilo Luna nunca recibe ni guarda datos de tarjeta: ningún módulo maneja número ni CVC", () => {
    for (const file of ["server/services/billing-service.ts", "server/billing/stripe/stripe-provider.ts", "server/repositories/billing.ts", "components/billing/billing-forms.tsx", "components/billing/upgrade-event-dialog.tsx"]) {
      expect(code(file), file).not.toMatch(/card_?number|cvc|cvv|card\[number\]|payment_method_data|type="(password|tel)"/i);
    }
    expect(readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")).not.toMatch(/cardNumber|cvc|last4/i);
  });
});

