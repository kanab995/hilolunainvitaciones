import { readFileSync } from "node:fs";
import { join } from "node:path";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { getEffectiveEventPlan } from "@/lib/billing/purchase";
import { WebhookSignatureError, type NormalizedWebhookEvent } from "@/server/billing/provider";
import { normalizeStripeEvent, normalizeStripeSession, StripeBillingProvider } from "@/server/billing/stripe/stripe-provider";
import { isPrivatePath } from "@/server/auth/access";
import { handleBillingWebhook, type BillingWebhookDeps } from "@/server/services/billing-webhook";
import { confirmPayment } from "@/server/services/purchase-sync";
import { fakeProvider, paidPurchase, payment, premiumPayment, PRICE_REFS, purchaseWorld, readyState, upgradePayment } from "../helpers/billing-world";

const ROOT = process.cwd();
const SECRET = "whsec_prueba_local";
const code = (file: string) => readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ───────── Firma y normalización con el SDK REAL de Stripe (sin red) ─────────
const stripe = new Stripe("sk_test_no_se_usa_para_red");
const stripeProvider = new StripeBillingProvider({ webhooks: stripe.webhooks } as unknown as Stripe, { webhookSecret: SECRET, prices: new Map(Object.entries(PRICE_REFS)) });
const START = 1_800_000_000;
const stripeEvent = (type: string, object: unknown, id = "evt_1", created = START) => JSON.stringify({ id, object: "event", type, created, data: { object } });
const signed = (payload: string) => ({ rawBody: payload, signature: stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) });
const session = (over: Record<string, unknown> = {}) => ({ id: "cs_1", object: "checkout.session", mode: "payment", payment_status: "paid", status: "complete", amount_total: 49900, currency: "mxn", customer: "cus_A", payment_intent: "pi_1", metadata: { hiloLunaUserId: "usr_A", eventId: "evt_A", targetPlan: "ESSENTIAL" }, line_items: { data: [{ price: { id: PRICE_REFS.STRIPE_PRICE_ESSENTIAL_ONE_TIME } }] }, ...over });

describe("Firma del webhook (77.1, 24)", () => {
  it("(77.1) una firma inválida, ausente o de otro secreto se rechaza con 400 y no se procesa nada", async () => {
    const world = purchaseWorld();
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(stripeProvider), store: world.store };
    const payload = stripeEvent("checkout.session.completed", session());
    const wrong = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_otro_secreto" });
    expect(await handleBillingWebhook({ rawBody: payload, signature: wrong }, deps)).toEqual({ status: 400, body: { error: "invalid_signature" } });
    expect(await handleBillingWebhook({ rawBody: payload, signature: null }, deps)).toEqual({ status: 400, body: { error: "invalid_signature" } });
    expect(await handleBillingWebhook({ rawBody: payload, signature: "t=1,v1=00" }, deps)).toMatchObject({ status: 400 });
    expect(world.webhookEvents.size).toBe(0);
    expect(world.writes).toEqual([]);
  });

  it("un cuerpo alterado después de firmar se rechaza", async () => {
    const world = purchaseWorld();
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(stripeProvider), store: world.store };
    const original = stripeEvent("checkout.session.completed", session());
    const header = stripe.webhooks.generateTestHeaderString({ payload: original, secret: SECRET });
    expect((await handleBillingWebhook({ rawBody: original.replace("cs_1", "cs_9"), signature: header }, deps)).status).toBe(400);
  });

  it("el adaptador verifica con el SDK real: firma válida → evento normalizado; inválida → WebhookSignatureError", () => {
    const { rawBody, signature } = signed(stripeEvent("checkout.session.completed", session()));
    expect(stripeProvider.parseWebhook(rawBody, signature)).toMatchObject({ id: "evt_1", action: "confirm_payment", checkoutSessionId: "cs_1" });
    expect(() => stripeProvider.parseWebhook(rawBody, "t=1,v1=abc")).toThrow(WebhookSignatureError);
    expect(() => stripeProvider.parseWebhook(rawBody, null)).toThrow(WebhookSignatureError);
  });

  it("sin pagos configurados el webhook responde 503 y no procesa nada", async () => {
    const world = purchaseWorld();
    expect((await handleBillingWebhook({ rawBody: "{}", signature: "x" }, { getProviderState: () => ({ status: "not_configured" }), store: world.store })).status).toBe(503);
    expect(world.webhookEvents.size).toBe(0);
  });

  it("(27) no requiere Clerk: la ruta y los servicios no importan autenticación, y /api/webhooks no es privada", async () => {
    for (const file of ["app/api/webhooks/stripe/route.ts", "server/services/billing-webhook.ts", "server/services/purchase-sync.ts"]) expect(code(file), file).not.toMatch(/clerk|requireAuth|getOrCreateCurrentUser|server\/auth/i);
    expect(isPrivatePath("/api/webhooks/stripe")).toBe(false);
    expect(code("proxy.ts")).toMatch(/matcher: \["\/dashboard\/:path\*", "\/preview\/:path\*", "\/admin\/:path\*", "\/pricing"\]/);
    const response = await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=x" } }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("Normalización de eventos de Stripe (22, 63)", () => {
  const normalize = (type: string, object: unknown) => normalizeStripeEvent(JSON.parse(stripeEvent(type, object)));

  it("(22) checkout.session.completed y async_payment_succeeded de un pago → confirmar por sesión", () => {
    expect(normalize("checkout.session.completed", session())).toMatchObject({ action: "confirm_payment", checkoutSessionId: "cs_1" });
    expect(normalize("checkout.session.async_payment_succeeded", session())).toMatchObject({ action: "confirm_payment", checkoutSessionId: "cs_1" });
  });

  it("(22) payment_intent.succeeded → confirmar por payment_intent; payment_intent.payment_failed → cerrar como FAILED con la metadata del intento", () => {
    expect(normalize("payment_intent.succeeded", { id: "pi_1", object: "payment_intent" })).toMatchObject({ action: "confirm_payment", paymentIntentId: "pi_1" });
    expect(normalize("payment_intent.payment_failed", { id: "pi_1", metadata: { eventId: "evt_A", targetPlan: "PREMIUM", hiloLunaUserId: "usr_A" } })).toEqual(expect.objectContaining({ action: "close_payment", outcome: "FAILED", paymentIntentId: "pi_1", metadata: { eventId: "evt_A", targetPlan: "PREMIUM" } }));
  });

  it("sesión fallida asíncrona → FAILED; sesión caducada → CANCELED; reembolso total → refund; parcial → ignorado", () => {
    expect(normalize("checkout.session.async_payment_failed", session())).toMatchObject({ action: "close_payment", outcome: "FAILED", checkoutSessionId: "cs_1" });
    expect(normalize("checkout.session.expired", session({ payment_status: "unpaid", status: "expired" }))).toMatchObject({ action: "close_payment", outcome: "CANCELED", checkoutSessionId: "cs_1" });
    expect(normalize("charge.refunded", { id: "ch_1", refunded: true, payment_intent: "pi_1" })).toMatchObject({ action: "refund_payment", paymentIntentId: "pi_1" });
    expect(normalize("charge.refunded", { id: "ch_1", refunded: false, payment_intent: "pi_1" })).toMatchObject({ action: "ignore" });
  });

  it("(63/8) los eventos de SUSCRIPCIÓN del modelo anterior se ignoran: no conceden ni cambian nada", () => {
    for (const type of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed", "invoice.paid", "invoice.payment_failed"]) {
      expect(normalize(type, { id: "sub_1", object: "subscription", status: "active", customer: "cus_A" }), type).toMatchObject({ action: "ignore" });
    }
    // Una sesión de suscripción (no de pago) tampoco.
    expect(normalize("checkout.session.completed", session({ mode: "subscription" }))).toMatchObject({ action: "ignore" });
  });

  it("(8/77.8) un webhook de suscripción firmado responde 200 «ignored» y NO crea compras ni consulta al proveedor", async () => {
    const world = purchaseWorld({ events: { evt_A: { ownerId: "usr_A", startsAt: new Date("2027-05-17T23:00:00Z") } } });
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(stripeProvider), store: world.store };
    const result = await handleBillingWebhook(signed(stripeEvent("customer.subscription.updated", { id: "sub_1", object: "subscription", status: "active", customer: "cus_A", metadata: { eventId: "evt_A", targetPlan: "PREMIUM", hiloLunaUserId: "usr_A" } })), deps);
    expect(result).toEqual({ status: 200, body: { received: true, ignored: true } });
    expect(world.purchases).toEqual([]);
    expect(world.webhookEvents.size).toBe(0);
  });

  it("la sesión se traduce a un pago neutral con precio, importe (centavos), moneda en mayúsculas y metadata", () => {
    expect(normalizeStripeSession(session() as unknown as Stripe.Checkout.Session)).toEqual({
      checkoutSessionId: "cs_1",
      paymentIntentId: "pi_1",
      providerCustomerId: "cus_A",
      status: "PAID",
      amountMinor: 49900,
      currency: "MXN",
      priceRefs: [PRICE_REFS.STRIPE_PRICE_ESSENTIAL_ONE_TIME],
      metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "ESSENTIAL" },
    });
    expect(normalizeStripeSession(session({ payment_status: "unpaid" }) as unknown as Stripe.Checkout.Session).status).toBe("PENDING");
    expect(normalizeStripeSession(session({ payment_status: "unpaid", status: "expired" }) as unknown as Stripe.Checkout.Session).status).toBe("EXPIRED");
    expect(normalizeStripeSession(session({ payment_status: "no_payment_required" }) as unknown as Stripe.Checkout.Session).status).toBe("PENDING");
  });
});

// ───────── Servicio del webhook con proveedor de pruebas ─────────
const NOW_EVENT = new Date("2027-01-10T12:00:00Z");
const EVENT_DATE = new Date("2027-05-17T23:00:00Z");

/** El evento «llega» como JSON del evento neutral (el proveedor de pruebas solo lo devuelve). */
function harness(payments: Record<string, ReturnType<typeof payment>> = {}, seed: Parameters<typeof purchaseWorld>[0] = {}) {
  const world = purchaseWorld({ events: { evt_A: { ownerId: "usr_A", startsAt: EVENT_DATE }, evt_B: { ownerId: "usr_A", startsAt: new Date("2027-08-01T20:00:00Z") }, evt_of_b: { ownerId: "usr_B", startsAt: EVENT_DATE } }, customers: { usr_A: "cus_A", usr_B: "cus_B" }, ...seed });
  const { provider, calls } = fakeProvider({ payments, webhook: (raw) => ({ ...(JSON.parse(raw) as object), createdAt: NOW_EVENT }) as NormalizedWebhookEvent });
  const deps: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: world.store };
  let n = 0;
  const send = (event: Record<string, unknown>) => handleBillingWebhook({ rawBody: JSON.stringify({ id: `evt_${++n}`, type: "test", ...event }), signature: "firmado" }, deps);
  const confirm = (sessionId: string) => send({ action: "confirm_payment", checkoutSessionId: sessionId });
  return { world, calls, send, confirm, provider };
}

describe("Compra confirmada → EventPurchase (25, 77)", () => {
  it("(77.3/25) un pago válido de Esencial crea la compra PAID con plan, importe, moneda y ventana de acceso; y fija el fin del acceso del evento", async () => {
    const h = harness({ cs_1: payment() });
    expect((await h.confirm("cs_1")).status).toBe(200);
    expect(h.world.purchases).toHaveLength(1);
    expect(h.world.purchases[0]).toMatchObject({ eventId: "evt_A", userId: "usr_A", plan: "ESSENTIAL", kind: "INITIAL", status: "PAID", amount: 49900, currency: "MXN", paidAt: NOW_EVENT, accessStartsAt: NOW_EVENT, checkoutSessionId: "cs_1", paymentIntentId: "pi_1" });
    expect(h.world.purchases[0]?.accessEndsAt?.toISOString()).toBe("2027-06-16T23:00:00.000Z");
    expect(h.world.events.get("evt_A")?.paidAccessEndsAt?.toISOString()).toBe("2027-06-16T23:00:00.000Z");
    expect(getEffectiveEventPlan(h.world.purchases)).toBe("ESSENTIAL");
    expect(getEffectiveEventPlan(h.world.state("evt_B")?.purchases ?? [])).toBe("FREE"); // el otro evento del mismo usuario sigue Gratis (F)
  });

  it("(77.2/23) un evento repetido no se procesa dos veces (idempotencia)", async () => {
    const h = harness({ cs_1: payment() });
    const raw = JSON.stringify({ id: "evt_same", type: "checkout.session.completed", action: "confirm_payment", checkoutSessionId: "cs_1" });
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(h.provider), store: h.world.store };
    expect((await handleBillingWebhook({ rawBody: raw, signature: "s" }, deps)).body).toEqual({ received: true });
    expect((await handleBillingWebhook({ rawBody: raw, signature: "s" }, deps)).body).toEqual({ received: true, duplicate: true });
    expect((await handleBillingWebhook({ rawBody: raw, signature: "s" }, deps)).body).toEqual({ received: true, duplicate: true });
    expect(h.world.purchases).toHaveLength(1);
    expect(h.world.writes.filter((write) => write.startsWith("save:"))).toHaveLength(1);
  });

  it("aunque lleguen dos eventos DISTINTOS de la misma sesión (completed y payment_intent.succeeded) hay UNA sola compra", async () => {
    const h = harness({ cs_1: payment() });
    await h.confirm("cs_1");
    await h.send({ action: "confirm_payment", paymentIntentId: "pi_1" });
    expect(h.world.purchases).toHaveLength(1);
    expect(h.calls.findPaymentByIntent).toHaveBeenCalledWith("pi_1");
  });

  it("(77.4/24) un importe incorrecto NO concede el plan", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const amountMinor of [1, 30000, 49899, 79900, -1]) {
      const h = harness({ cs_1: payment({ amountMinor }) });
      await h.confirm("cs_1");
      expect(h.world.purchases, String(amountMinor)).toEqual([]);
    }
  });

  it("(77.5/54) una moneda incorrecta NO concede el plan (sin conversión de divisas)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const currency of ["USD", "EUR", "", "mxn "]) {
      const h = harness({ cs_1: payment({ currency }) });
      await h.confirm("cs_1");
      expect(h.world.purchases, currency).toEqual([]);
    }
  });

  it("(77.6) un eventId inexistente NO concede el plan", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const h = harness({ cs_1: payment({ metadata: { userId: "usr_A", eventId: "evt_no_existe", targetPlan: "ESSENTIAL" } }) });
    await h.confirm("cs_1");
    expect(h.world.purchases).toEqual([]);
  });

  it("(77.7/11) un usuario que NO es el dueño del evento (metadata de A sobre el evento de B) NO concede el plan; un cliente del proveedor de otro usuario tampoco", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const h = harness({
      cs_1: payment({ metadata: { userId: "usr_A", eventId: "evt_of_b", targetPlan: "ESSENTIAL" } }),
      cs_2: payment({ checkoutSessionId: "cs_2", providerCustomerId: "cus_B", metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "ESSENTIAL" } }),
    });
    await h.confirm("cs_1");
    await h.confirm("cs_2");
    expect(h.world.purchases).toEqual([]);
  });

  it("(24) la metadata falsa NO basta: un precio de Esencial con metadata «PREMIUM» no concede Premium ni Esencial", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const h = harness({ cs_1: payment({ metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "PREMIUM" } }) });
    await h.confirm("cs_1");
    expect(h.world.purchases).toEqual([]);
  });

  it("(24/29) un precio DESCONOCIDO o varios precios no conceden nada; faltan metadata → nada", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const override of [{ priceRefs: ["price_desconocido"] }, { priceRefs: [] }, { priceRefs: [PRICE_REFS.STRIPE_PRICE_ESSENTIAL_ONE_TIME, PRICE_REFS.STRIPE_PRICE_PREMIUM_ONE_TIME] }, { metadata: {} }, { metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "FREE" } }]) {
      const h = harness({ cs_1: payment(override) });
      await h.confirm("cs_1");
      expect(h.world.purchases, JSON.stringify(override)).toEqual([]);
    }
  });

  it("un pago no cobrado (pendiente o caducado) no concede nada, aunque llegue «completed»", async () => {
    for (const status of ["PENDING", "EXPIRED"] as const) {
      const h = harness({ cs_1: payment({ status }) });
      await h.confirm("cs_1");
      expect(h.world.purchases, status).toEqual([]);
    }
  });

  it("(41/26) Gratis → Premium directo: compra INITIAL por 79900; la compra posterior al evento da 30 días desde la compra", async () => {
    const h = harness({ cs_2: premiumPayment() }, { events: { evt_A: { ownerId: "usr_A", startsAt: new Date("2026-12-01T20:00:00Z") } } });
    await h.confirm("cs_2");
    expect(h.world.purchases[0]).toMatchObject({ plan: "PREMIUM", kind: "INITIAL", amount: 79900 });
    expect(h.world.purchases[0]?.accessEndsAt?.getTime()).toBe(NOW_EVENT.getTime() + 30 * 86_400_000);
  });
});

describe("Mejora Esencial → Premium e historial (14, 47, 48, 52, 76)", () => {
  it("(76.3/52/47/48) con Esencial pagada, la mejora cobra 30000 y crea OTRA compra (UPGRADE): el plan es Premium y el historial conserva 499 y 300", async () => {
    const h = harness({ cs_3: upgradePayment() }, { purchases: [paidPurchase({ id: "p_ess", checkoutSessionId: "cs_1", paymentIntentId: "pi_1" })] });
    await h.confirm("cs_3");
    expect(h.world.purchases).toHaveLength(2);
    expect(h.world.purchases.map((purchase) => [purchase.plan, purchase.kind, purchase.amount, purchase.status])).toEqual([["ESSENTIAL", "INITIAL", 49900, "PAID"], ["PREMIUM", "UPGRADE", 30000, "PAID"]]);
    expect(getEffectiveEventPlan(h.world.purchases)).toBe("PREMIUM");
    // La compra de Esencial NO se sobrescribió por Premium.
    expect(h.world.purchases[0]).toMatchObject({ id: "p_ess", plan: "ESSENTIAL", amount: 49900 });
  });

  it("una mejora NUNCA acorta el acceso ya pagado", async () => {
    const h = harness({ cs_3: upgradePayment() }, { events: { evt_A: { ownerId: "usr_A", startsAt: EVENT_DATE, paidAccessEndsAt: new Date("2027-12-31T00:00:00Z") } }, purchases: [paidPurchase()] });
    await h.confirm("cs_3");
    expect(h.world.events.get("evt_A")?.paidAccessEndsAt?.toISOString()).toBe("2027-12-31T00:00:00.000Z");
  });

  it("(52) un cobro de mejora (30000) sobre un evento SIN Esencial pagada NO concede Premium", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const h = harness({ cs_3: upgradePayment() });
    await h.confirm("cs_3");
    expect(h.world.purchases).toEqual([]);
  });

  it("el importe de la mejora se verifica: 79900 con el precio de mejora (o 30000 con el de Premium completo) no concede nada", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const seed = { purchases: [paidPurchase()] };
    const wrongAmount = harness({ cs_3: upgradePayment({ amountMinor: 79900 }) }, seed);
    await wrongAmount.confirm("cs_3");
    const wrongPrice = harness({ cs_2: premiumPayment({ amountMinor: 30000 }) }, seed);
    await wrongPrice.confirm("cs_2");
    expect(wrongAmount.world.purchases).toHaveLength(1);
    expect(wrongPrice.world.purchases).toHaveLength(1);
  });

  it("(76.6/45) un pago de mejora FALLIDO conserva Esencial: la compra pendiente pasa a FAILED y el plan no cambia", async () => {
    const h = harness({}, { purchases: [paidPurchase(), paidPurchase({ id: "p_up", status: "PENDING", plan: "PREMIUM", kind: "UPGRADE", amount: 30000, paidAt: null, checkoutSessionId: "cs_3", paymentIntentId: null })] });
    await h.send({ action: "close_payment", outcome: "FAILED", checkoutSessionId: "cs_3" });
    expect(h.world.purchases.find((purchase) => purchase.id === "p_up")?.status).toBe("FAILED");
    expect(getEffectiveEventPlan(h.world.purchases)).toBe("ESSENTIAL");
  });

  it("un intento fallido dentro de una sesión abierta (payment_intent.payment_failed) marca la compra pendiente de ese evento y plan; nunca toca una PAID", async () => {
    const h = harness({}, { purchases: [paidPurchase({ id: "p_ess" }), paidPurchase({ id: "p_up", status: "PENDING", plan: "PREMIUM", kind: "UPGRADE", amount: 30000, paidAt: null, checkoutSessionId: "cs_3", paymentIntentId: null })] });
    await h.send({ action: "close_payment", outcome: "FAILED", paymentIntentId: "pi_x", metadata: { eventId: "evt_A", targetPlan: "PREMIUM" } });
    expect(h.world.purchases.map((purchase) => [purchase.id, purchase.status])).toEqual([["p_ess", "PAID"], ["p_up", "FAILED"]]);
    await h.send({ action: "close_payment", outcome: "FAILED", checkoutSessionId: "cs_1" });
    expect(h.world.purchases[0]?.status).toBe("PAID");
  });

  it("(45) FREE intentando Premium con un pago fallido sigue FREE; una sesión caducada queda CANCELED", async () => {
    const h = harness({}, { purchases: [paidPurchase({ id: "p_pre", status: "PENDING", plan: "PREMIUM", amount: 79900, paidAt: null, checkoutSessionId: "cs_2", paymentIntentId: null })] });
    await h.send({ action: "close_payment", outcome: "CANCELED", checkoutSessionId: "cs_2" });
    expect(h.world.purchases[0]?.status).toBe("CANCELED");
    expect(getEffectiveEventPlan(h.world.purchases)).toBe("FREE");
  });

  it("(73.5) un reembolso total retira el plan que concedía esa compra: pasa a REFUNDED (Premium reembolsado → vuelve a Esencial); nada se borra", async () => {
    const h = harness({}, { purchases: [paidPurchase({ id: "p_ess", paymentIntentId: "pi_1" }), paidPurchase({ id: "p_up", plan: "PREMIUM", kind: "UPGRADE", amount: 30000, checkoutSessionId: "cs_3", paymentIntentId: "pi_3" })] });
    await h.send({ action: "refund_payment", paymentIntentId: "pi_3" });
    expect(h.world.purchases.map((purchase) => [purchase.id, purchase.status])).toEqual([["p_ess", "PAID"], ["p_up", "REFUNDED"]]);
    expect(getEffectiveEventPlan(h.world.purchases)).toBe("ESSENTIAL");
    expect(h.world.purchases).toHaveLength(2);
  });

  it("si aplicar falla, la transacción se revierte (el evento NO queda registrado) y Stripe recibe 500; el reintento sí funciona", async () => {
    const h = harness({ cs_1: payment() });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing: BillingWebhookDeps = {
      getProviderState: () => readyState(h.provider),
      store: { ...h.world.store, recordEventAndApply: (event, apply) => h.world.store.recordEventAndApply(event, (ops) => apply({ ...ops, savePurchase: async () => Promise.reject(new Error("db caída con datos sensibles")) })) },
    };
    const raw = JSON.stringify({ id: "evt_retry", type: "checkout.session.completed", action: "confirm_payment", checkoutSessionId: "cs_1" });
    expect(await handleBillingWebhook({ rawBody: raw, signature: "s" }, failing)).toEqual({ status: 500, body: { error: "processing_failed" } });
    expect(h.world.webhookEvents.size).toBe(0);
    expect(h.world.purchases).toEqual([]);
    expect(JSON.stringify(error.mock.calls)).not.toContain("datos sensibles");
    expect((await handleBillingWebhook({ rawBody: raw, signature: "s" }, { getProviderState: () => readyState(h.provider), store: h.world.store })).status).toBe(200);
    expect(h.world.purchases[0]?.status).toBe("PAID");
    error.mockRestore();
  });

  it("confirmPayment es idempotente por sesión: repetirlo no crea otra compra ni cambia el fin del acceso", async () => {
    const world = purchaseWorld({ events: { evt_A: { ownerId: "usr_A", startsAt: EVENT_DATE } }, customers: { usr_A: "cus_A" } });
    const provider = fakeProvider().provider;
    await world.store.apply(async (ops) => {
      expect(await confirmPayment(ops, provider, payment(), NOW_EVENT)).toBe("granted");
      expect(await confirmPayment(ops, provider, payment(), new Date("2027-02-01T00:00:00Z"))).toBe("already_paid");
    });
    expect(world.purchases).toHaveLength(1);
    expect(world.purchases[0]?.paidAt).toEqual(NOW_EVENT);
  });

  it("(64) nunca se registran cuerpos ni datos de pago: solo el tipo del evento", () => {
    expect(code("server/services/billing-webhook.ts")).not.toMatch(/console\.\w+\([^)]*(rawBody|body|payload|input\.signature)/);
    expect(code("server/repositories/billing.ts")).not.toMatch(/rawBody|payload|snapshot/);
    expect(code("server/services/purchase-sync.ts")).not.toMatch(/console\.\w+\([^)]*(amountMinor|metadata|email)/);
  });
});

describe("Cada verificación rechaza por SU motivo (24)", () => {
  it("confirmPayment devuelve el motivo exacto de cada rechazo y solo concede cuando TODO cuadra", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const provider = fakeProvider().provider;
    const run = async (candidate: ReturnType<typeof payment>, seed: Parameters<typeof purchaseWorld>[0] = {}) => {
      const world = purchaseWorld({ events: { evt_A: { ownerId: "usr_A", startsAt: EVENT_DATE }, evt_of_b: { ownerId: "usr_B", startsAt: EVENT_DATE } }, customers: { usr_A: "cus_A", usr_B: "cus_B" }, ...seed });
      let outcome = "";
      await world.store.apply(async (ops) => {
        outcome = await confirmPayment(ops, provider, candidate, NOW_EVENT);
      });
      return outcome;
    };
    expect(await run(payment())).toBe("granted");
    expect(await run(payment({ status: "PENDING" }))).toBe("not_paid");
    expect(await run(payment({ metadata: {} }))).toBe("rejected_metadata");
    expect(await run(payment({ priceRefs: ["price_x"] }))).toBe("rejected_price");
    expect(await run(payment({ metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "PREMIUM" } }))).toBe("rejected_mismatch");
    expect(await run(payment({ currency: "USD" }))).toBe("rejected_currency");
    expect(await run(payment({ amountMinor: 49800 }))).toBe("rejected_amount");
    expect(await run(payment({ metadata: { userId: "usr_A", eventId: "evt_zzz", targetPlan: "ESSENTIAL" } }))).toBe("rejected_event");
    expect(await run(payment({ metadata: { userId: "usr_A", eventId: "evt_of_b", targetPlan: "ESSENTIAL" } }))).toBe("rejected_owner");
    expect(await run(payment({ providerCustomerId: "cus_B" }))).toBe("rejected_owner");
    expect(await run(upgradePayment())).toBe("rejected_upgrade");
    expect(await run(upgradePayment(), { purchases: [paidPurchase()] })).toBe("granted");
  });
});
