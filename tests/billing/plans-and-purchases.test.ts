import { describe, expect, it } from "vitest";
import { canUse, canUseTemplate, checkLimit, entitlementsForPlan, limitOf } from "@/lib/billing/entitlements";
import { FEATURE_IDS, formatPlanPrice, formatPrice, LIMIT_IDS, PLAN_IDS, PRICE_ENV_KEYS, planConfigs, planIncludes, planLabel } from "@/lib/billing/plans";
import { computePaidAccessEnd, expectedPurchaseAmountMinor, extendPaidAccessEnd, getEffectiveEventPlan, getEventAccessState, isEventAccessActive, PAID_ACCESS_DAYS, purchaseForPriceKey, quoteEventPurchase, toMinorUnits } from "@/lib/billing/purchase";
import { canUseEventFeature, getEventEntitlements, getEventPlan, getEventPlanState, getOwnedEventEntitlements, getEventLimit, assertEventEntitlement, type EntitlementDeps } from "@/server/services/entitlement-service";
import { paidPurchase, purchaseWorld } from "../helpers/billing-world";

const NOW = new Date("2027-03-01T00:00:00Z");
const world = (purchases = [paidPurchase()]) => purchaseWorld({ events: { evt_A: { ownerId: "usr_A", startsAt: new Date("2027-05-17T23:00:00Z") }, evt_B: { ownerId: "usr_A", startsAt: new Date("2027-08-01T20:00:00Z") } }, purchases });
const depsOf = (w: ReturnType<typeof purchaseWorld>): EntitlementDeps => ({
  findEventBilling: async (eventId) => w.state(eventId),
  findOwnedEventBilling: async (userId, eventId) => {
    const state = w.state(eventId);
    return state && state.ownerId === userId ? state : null;
  },
  now: () => NOW,
});

describe("Modelo comercial: un pago único por evento (D-32)", () => {
  it("(1/3) define FREE, ESSENTIAL y PREMIUM con nombres Gratis / Esencial / Premium y una sola fuente de etiquetas", () => {
    expect(PLAN_IDS).toEqual(["FREE", "ESSENTIAL", "PREMIUM"]);
    expect(PLAN_IDS.map(planLabel)).toEqual(["Gratis", "Esencial", "Premium"]);
  });

  it("(3/16) precios centralizados y configurables: $0, $499 y $799 MXN, con su variable de Stripe de pago único", () => {
    expect(PLAN_IDS.map((id) => planConfigs[id].pricing.displayPrice)).toEqual([0, 499, 799]);
    expect(PLAN_IDS.map(formatPlanPrice)).toEqual(["$0 MXN", "$499 MXN", "$799 MXN"]);
    for (const id of PLAN_IDS) expect(planConfigs[id].pricing.currency).toBe("MXN");
    expect(planConfigs.ESSENTIAL.pricing.stripePriceEnvKey).toBe("STRIPE_PRICE_ESSENTIAL_ONE_TIME");
    expect(planConfigs.PREMIUM.pricing.stripePriceEnvKey).toBe("STRIPE_PRICE_PREMIUM_ONE_TIME");
    expect(planConfigs.PREMIUM.pricing.upgradeFrom.ESSENTIAL?.stripePriceEnvKey).toBe("STRIPE_PRICE_ESSENTIAL_TO_PREMIUM");
    expect([...PRICE_ENV_KEYS].sort()).toEqual(["STRIPE_PRICE_ESSENTIAL_ONE_TIME", "STRIPE_PRICE_ESSENTIAL_TO_PREMIUM", "STRIPE_PRICE_PREMIUM_ONE_TIME"]);
    expect(formatPrice(1234.5)).toBe("$1,234.5 MXN");
  });

  it("(4) límites POR EVENTO: Gratis 30/5, Esencial 100/15, Premium 300/40; no existe un límite de eventos", () => {
    expect(planConfigs.FREE.limits).toEqual({ maxGuestsPerEvent: 30, maxGalleryImages: 5 });
    expect(planConfigs.ESSENTIAL.limits).toEqual({ maxGuestsPerEvent: 100, maxGalleryImages: 15 });
    expect(planConfigs.PREMIUM.limits).toEqual({ maxGuestsPerEvent: 300, maxGalleryImages: 40 });
    expect([...LIMIT_IDS]).toEqual(["maxGuestsPerEvent", "maxGalleryImages"]);
    for (const id of PLAN_IDS) expect(Object.keys(planConfigs[id].limits)).not.toContain("maxEvents");
  });

  it("las features actuales (publicar, enlaces personalizados, QR, calendario, fotos propias) siguen activas en todos los planes por configuración", () => {
    for (const id of PLAN_IDS) {
      expect(Object.keys(planConfigs[id].features).sort()).toEqual([...FEATURE_IDS].sort());
      for (const value of Object.values(planConfigs[id].features)) expect(value).toBe(true);
    }
  });

  it("jerarquía Gratis < Esencial < Premium", () => {
    expect(planIncludes("PREMIUM", "ESSENTIAL")).toBe(true);
    expect(planIncludes("ESSENTIAL", "PREMIUM")).toBe(false);
    expect(planIncludes("FREE", "FREE")).toBe(true);
  });
});

describe("Plan efectivo de un evento (73)", () => {
  it("(73.1) un evento sin compras → FREE", () => {
    expect(getEffectiveEventPlan([])).toBe("FREE");
  });

  it("(73.2/73.3) una compra PAID Esencial → ESSENTIAL; Premium → PREMIUM", () => {
    expect(getEffectiveEventPlan([{ plan: "ESSENTIAL", status: "PAID" }])).toBe("ESSENTIAL");
    expect(getEffectiveEventPlan([{ plan: "PREMIUM", status: "PAID" }])).toBe("PREMIUM");
  });

  it("(47/50) con historial (Esencial + mejora a Premium) gana el MAYOR plan pagado, sin importar el orden", () => {
    const history = [{ plan: "ESSENTIAL", status: "PAID" }, { plan: "PREMIUM", status: "PAID" }] as const;
    expect(getEffectiveEventPlan(history)).toBe("PREMIUM");
    expect(getEffectiveEventPlan([...history].reverse())).toBe("PREMIUM");
  });

  it("(73.4/45) una compra fallida, pendiente o cancelada NO cambia el plan", () => {
    for (const status of ["FAILED", "PENDING", "CANCELED"] as const) {
      expect(getEffectiveEventPlan([{ plan: "PREMIUM", status }]), status).toBe("FREE");
      expect(getEffectiveEventPlan([{ plan: "ESSENTIAL", status: "PAID" }, { plan: "PREMIUM", status }]), status).toBe("ESSENTIAL");
    }
  });

  it("(73.5) una compra reembolsada NO concede el plan (política elegida: el reembolso lo retira)", () => {
    expect(getEffectiveEventPlan([{ plan: "PREMIUM", status: "REFUNDED" }])).toBe("FREE");
    expect(getEffectiveEventPlan([{ plan: "ESSENTIAL", status: "PAID" }, { plan: "PREMIUM", status: "REFUNDED" }])).toBe("ESSENTIAL");
  });

  it("un plan desconocido en una compra no concede nada", () => {
    expect(getEffectiveEventPlan([{ plan: "GOLD" as never, status: "PAID" }])).toBe("FREE");
  });

  it("(73.6/1/35) el plan es del EVENTO: Premium en el evento A no da Premium en el evento B, aunque sea de la misma persona", async () => {
    const w = world([paidPurchase({ eventId: "evt_A", plan: "PREMIUM", kind: "INITIAL", amount: 79900 })]);
    const deps = depsOf(w);
    expect(await getEventPlan("evt_A", deps)).toBe("PREMIUM");
    expect(await getEventPlan("evt_B", deps)).toBe("FREE");
    expect((await getEventEntitlements("evt_B", deps)).limits.maxGuestsPerEvent).toBe(30);
    expect((await getEventEntitlements("evt_A", deps)).limits.maxGuestsPerEvent).toBe(300);
  });
});

describe("Servicio de derechos por evento (12)", () => {
  it("getEventEntitlements / canUseEventFeature / getEventLimit salen del plan del EVENTO", async () => {
    const deps = depsOf(world());
    expect((await getEventEntitlements("evt_A", deps)).plan).toBe("ESSENTIAL");
    expect(await canUseEventFeature("evt_A", "customMedia", deps)).toBe(true);
    expect(await getEventLimit("evt_A", "maxGalleryImages", deps)).toBe(15);
    expect(await getEventLimit("evt_B", "maxGalleryImages", deps)).toBe(5);
  });

  it("(11) getOwnedEventEntitlements comprueba la propiedad: un evento ajeno o inexistente es indistinguible (undefined)", async () => {
    const deps = depsOf(world());
    expect((await getOwnedEventEntitlements("usr_A", "evt_A", deps))?.plan).toBe("ESSENTIAL");
    expect(await getOwnedEventEntitlements("usr_B", "evt_A", deps)).toBeUndefined();
    expect(await getOwnedEventEntitlements("usr_A", "evt_inexistente", deps)).toBeUndefined();
  });

  it("sin evento en la base de datos (demostración) se resuelve como Gratis: nunca se concede un plan de pago por defecto", async () => {
    const deps: EntitlementDeps = { findEventBilling: async () => null, findOwnedEventBilling: async () => null, now: () => NOW };
    expect(await getEventPlan("evt_A", deps)).toBe("FREE");
  });

  it("assertEventEntitlement lanza EntitlementError con código y mensaje aptos para mostrar", async () => {
    const deps = depsOf(world([]));
    await expect(assertEventEntitlement("evt_A", { limit: "maxGuestsPerEvent", current: 30 }, deps)).rejects.toMatchObject({ name: "EntitlementError", code: "limit_reached", message: "Has alcanzado el límite de invitados de este evento." });
    await expect(assertEventEntitlement("evt_A", { minimumPlan: "PREMIUM" }, deps)).rejects.toMatchObject({ code: "plan_required", message: "Esta plantilla requiere Premium para este evento." });
    await expect(assertEventEntitlement("evt_A", { limit: "maxGuestsPerEvent", current: 29 }, deps)).resolves.toMatchObject({ plan: "FREE" });
  });

  it("(57) el estado de acceso se calcula (free / active / expired) pero vencer NO cambia el plan ni borra nada", async () => {
    const w = purchaseWorld({ events: { evt_A: { ownerId: "usr_A", startsAt: new Date("2027-01-01T00:00:00Z"), paidAccessEndsAt: new Date("2027-01-31T00:00:00Z") } }, purchases: [paidPurchase()] });
    const state = await getEventPlanState("evt_A", { ...depsOf(w), now: () => new Date("2027-02-15T00:00:00Z") });
    expect(state).toMatchObject({ plan: "ESSENTIAL", accessState: "expired" });
    expect((await getEventEntitlements("evt_A", { ...depsOf(w), now: () => new Date("2027-02-15T00:00:00Z") })).plan).toBe("ESSENTIAL");
  });

  it("canUse / limitOf / checkLimit / canUseTemplate leen el objeto de derechos del evento", () => {
    const essential = entitlementsForPlan("ESSENTIAL");
    expect(canUse(essential, "qr")).toBe(true);
    expect(limitOf(essential, "maxGuestsPerEvent")).toBe(100);
    expect(checkLimit(essential, "maxGuestsPerEvent", 100)).toMatchObject({ ok: false, limit: 100 });
    expect(canUseTemplate(essential, "PREMIUM")).toBe(false);
  });
});

describe("Mejoras de plan y precio (14, 15, 51, 52)", () => {
  it("(76.1/51) Gratis → Esencial y Gratis → Premium se compran al precio completo directamente", () => {
    expect(quoteEventPurchase("FREE", "ESSENTIAL")).toMatchObject({ ok: true, kind: "INITIAL", plan: "ESSENTIAL", amount: 499, amountMinor: 49900, currency: "MXN", priceEnvKey: "STRIPE_PRICE_ESSENTIAL_ONE_TIME" });
    expect(quoteEventPurchase("FREE", "PREMIUM")).toMatchObject({ ok: true, kind: "INITIAL", plan: "PREMIUM", amount: 799, amountMinor: 79900, priceEnvKey: "STRIPE_PRICE_PREMIUM_ONE_TIME" });
  });

  it("(76.3/52/15) Esencial → Premium cobra SOLO la diferencia (calculada de la configuración, no escrita a mano) con su precio de mejora", () => {
    const quote = quoteEventPurchase("ESSENTIAL", "PREMIUM");
    expect(quote).toMatchObject({ ok: true, kind: "UPGRADE", plan: "PREMIUM", from: "ESSENTIAL", amount: 300, amountMinor: 30000, priceEnvKey: "STRIPE_PRICE_ESSENTIAL_TO_PREMIUM" });
    expect(quote.ok && quote.amount).toBe(planConfigs.PREMIUM.pricing.displayPrice - planConfigs.ESSENTIAL.pricing.displayPrice);
  });

  it("(14/76.4/76.5) no hay bajada de plan ni recompra: Premium no puede comprar Esencial ni volver a pagar Premium; Esencial no repite Esencial", () => {
    expect(quoteEventPurchase("PREMIUM", "ESSENTIAL")).toEqual({ ok: false, reason: "downgrade" });
    expect(quoteEventPurchase("PREMIUM", "PREMIUM")).toEqual({ ok: false, reason: "already_at_plan" });
    expect(quoteEventPurchase("ESSENTIAL", "ESSENTIAL")).toEqual({ ok: false, reason: "already_at_plan" });
    expect(quoteEventPurchase("FREE", "FREE")).toEqual({ ok: false, reason: "not_paid_plan" });
  });

  it("solo los planes de pago del enum son comprables (nada de precios ni planes arbitrarios)", () => {
    for (const hostile of ["price_x", "free", "essential", "", null, undefined, 3, { plan: "PREMIUM" }]) expect(quoteEventPurchase("FREE", hostile).ok, String(hostile)).toBe(false);
  });

  it("cada variable de precio corresponde a una compra conocida; el importe esperado sale de la configuración", () => {
    expect(purchaseForPriceKey("STRIPE_PRICE_ESSENTIAL_ONE_TIME")).toEqual({ plan: "ESSENTIAL", kind: "INITIAL", from: "FREE" });
    expect(purchaseForPriceKey("STRIPE_PRICE_PREMIUM_ONE_TIME")).toEqual({ plan: "PREMIUM", kind: "INITIAL", from: "FREE" });
    expect(purchaseForPriceKey("STRIPE_PRICE_ESSENTIAL_TO_PREMIUM")).toEqual({ plan: "PREMIUM", kind: "UPGRADE", from: "ESSENTIAL" });
    expect(purchaseForPriceKey("STRIPE_PRICE_INVENTADO")).toBeUndefined();
    expect(expectedPurchaseAmountMinor({ plan: "ESSENTIAL", kind: "INITIAL", from: "FREE" })).toBe(49900);
    expect(expectedPurchaseAmountMinor({ plan: "PREMIUM", kind: "INITIAL", from: "FREE" })).toBe(79900);
    expect(expectedPurchaseAmountMinor({ plan: "PREMIUM", kind: "UPGRADE", from: "ESSENTIAL" })).toBe(30000);
    expect(toMinorUnits(499)).toBe(49900);
  });
});

describe("Ventana de acceso pagado (5, 26, 27, 78)", () => {
  const day = 86_400_000;
  const event = new Date("2027-05-17T23:00:00Z");

  it("(78.1) el acceso termina 30 días después del evento", () => {
    const end = computePaidAccessEnd({ startsAt: event, paidAt: new Date("2027-01-10T00:00:00Z") });
    expect(end.getTime()).toBe(event.getTime() + PAID_ACCESS_DAYS * day);
    expect(end.toISOString()).toBe("2027-06-16T23:00:00.000Z");
  });

  it("(78.4/26) comprar DESPUÉS del evento da como mínimo 30 días desde la compra", () => {
    const paidAt = new Date("2027-08-01T00:00:00Z");
    expect(computePaidAccessEnd({ startsAt: event, paidAt }).getTime()).toBe(paidAt.getTime() + 30 * day);
  });

  it("una compra posterior (mejora) nunca acorta el acceso ya pagado", () => {
    const current = new Date("2027-09-01T00:00:00Z");
    expect(computePaidAccessEnd({ startsAt: event, paidAt: new Date("2027-02-01T00:00:00Z"), currentEnd: current })).toEqual(current);
  });

  it("(78.2/27) mover el evento hacia adelante EXTIENDE el acceso: max(fin actual, nueva fecha + 30 días)", () => {
    const current = new Date("2027-06-16T23:00:00Z");
    const later = new Date("2027-07-20T20:00:00Z");
    expect(extendPaidAccessEnd(current, later)?.getTime()).toBe(later.getTime() + 30 * day);
  });

  it("(78.3/27) mover el evento hacia atrás NUNCA reduce el acceso ya pagado", () => {
    const current = new Date("2027-06-16T23:00:00Z");
    expect(extendPaidAccessEnd(current, new Date("2027-04-01T20:00:00Z"))).toEqual(current);
  });

  it("un evento Gratis (sin ventana) no tiene nada que extender", () => {
    expect(extendPaidAccessEnd(null, new Date("2027-07-20T20:00:00Z"))).toBeNull();
    expect(extendPaidAccessEnd(undefined, new Date("2027-07-20T20:00:00Z"))).toBeNull();
  });

  it("(57/58) estado de acceso: free sin compra; active dentro de la ventana; expired al pasarla; isEventAccessActive lo resume", () => {
    const end = new Date("2027-06-16T23:00:00Z");
    expect(getEventAccessState({ plan: "FREE", paidAccessEndsAt: null, now: new Date("2030-01-01T00:00:00Z") })).toBe("free");
    expect(getEventAccessState({ plan: "PREMIUM", paidAccessEndsAt: end, now: new Date("2027-06-16T00:00:00Z") })).toBe("active");
    expect(getEventAccessState({ plan: "PREMIUM", paidAccessEndsAt: end, now: new Date("2027-06-17T00:00:00Z") })).toBe("expired");
    expect(isEventAccessActive({ plan: "PREMIUM", paidAccessEndsAt: end, now: new Date("2027-06-17T00:00:00Z") })).toBe(false);
    expect(isEventAccessActive({ plan: "FREE", paidAccessEndsAt: null, now: new Date("2030-01-01T00:00:00Z") })).toBe(true);
    expect(isEventAccessActive({ plan: "ESSENTIAL", paidAccessEndsAt: end, now: new Date("2027-06-10T00:00:00Z") })).toBe(true);
  });
});
