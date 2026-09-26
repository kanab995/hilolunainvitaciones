import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { StripeBillingProvider } from "@/server/billing/stripe/stripe-provider";
import { startEventCheckout } from "@/server/services/billing-service";
import { billingDeps, fakeProvider, PRICE_REFS, purchaseWorld } from "../helpers/billing-world";

const user = { id: "usr_A", email: "a@example.com", name: "Ana" };
const world = () => purchaseWorld({ events: { evt_A: { ownerId: "usr_A", title: "Andrea & Fernando", startsAt: new Date("2027-05-17T23:00:00Z") } } });

/** Regresión de staging (punto 15): un Price de Stripe mal configurado NO debe llegar a cobrar (el webhook lo rechazaría y el cliente quedaría cobrado sin plan). */
describe("checkout: verificación del Price real de Stripe antes de cobrar", () => {
  it("si el Price no coincide, el checkout FALLA de forma segura: sin cliente, sin sesión y sin compra pendiente", async () => {
    const verifyPrice = vi.fn(async (_key: string, _expected: { amountMinor: number; currency: string }) => false);
    const { provider, calls } = fakeProvider({ verifyPrice });
    const { deps, pending, world: state } = billingDeps({ provider, world: world() });
    expect(await startEventCheckout(user, "evt_A", "ESSENTIAL", deps)).toMatchObject({ ok: false, code: "invalid_config" });
    expect(verifyPrice).toHaveBeenCalledWith("STRIPE_PRICE_ESSENTIAL_ONE_TIME", { amountMinor: 49900, currency: "MXN" });
    expect(calls.createEventCheckout).not.toHaveBeenCalled();
    expect(pending).toEqual([]);
    expect(state.customers.size).toBe(0);
  });

  it("pregunta por los importes reales: Esencial 499, Premium 799 y la mejora 300 MXN", async () => {
    const verifyPrice = vi.fn(async (_key: string, _expected: { amountMinor: number; currency: string }) => true);
    const { provider } = fakeProvider({ verifyPrice });
    await startEventCheckout(user, "evt_A", "ESSENTIAL", billingDeps({ provider, world: world() }).deps);
    await startEventCheckout(user, "evt_A", "PREMIUM", billingDeps({ provider, world: world() }).deps);
    expect(verifyPrice.mock.calls.map(([key, expected]) => [key, expected.amountMinor])).toEqual([
      ["STRIPE_PRICE_ESSENTIAL_ONE_TIME", 49900],
      ["STRIPE_PRICE_PREMIUM_ONE_TIME", 79900],
    ]);
  });
});

describe("StripeBillingProvider.verifyPrice", () => {
  const price = (over: Partial<Stripe.Price> = {}) => ({ id: "price_ess_once", active: true, type: "one_time", unit_amount: 49900, currency: "mxn", ...over }) as Stripe.Price;
  const build = (retrieve: () => Promise<Stripe.Price>) => {
    const spy = vi.fn(retrieve);
    const provider = new StripeBillingProvider({ prices: { retrieve: spy } } as unknown as Stripe, { webhookSecret: "whsec_x", prices: new Map(Object.entries(PRICE_REFS)) });
    return { provider, spy };
  };
  const expected = { amountMinor: 49900, currency: "MXN" };

  it("acepta un Price activo, de pago único, con el importe y la moneda esperados (y lo recuerda unos minutos)", async () => {
    const { provider, spy } = build(async () => price());
    expect(await provider.verifyPrice("STRIPE_PRICE_ESSENTIAL_ONE_TIME", expected)).toBe(true);
    expect(await provider.verifyPrice("STRIPE_PRICE_ESSENTIAL_ONE_TIME", expected)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rechaza importe distinto, moneda distinta, precio recurrente, inactivo o por tramos", async () => {
    for (const bad of [{ unit_amount: 79900 }, { currency: "usd" }, { type: "recurring" }, { active: false }, { unit_amount: null }] as Array<Partial<Stripe.Price>>) {
      const { provider } = build(async () => price(bad));
      expect(await provider.verifyPrice("STRIPE_PRICE_ESSENTIAL_ONE_TIME", expected), JSON.stringify(bad)).toBe(false);
    }
  });

  it("un Price inexistente es un desajuste (false); un fallo transitorio se propaga y NO se cachea como válido", async () => {
    const missing = new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "resource_missing", message: "No such price" });
    expect(await build(async () => Promise.reject(missing)).provider.verifyPrice("STRIPE_PRICE_ESSENTIAL_ONE_TIME", expected)).toBe(false);
    const { provider } = build(async () => Promise.reject(new Error("red caída")));
    await expect(provider.verifyPrice("STRIPE_PRICE_ESSENTIAL_ONE_TIME", expected)).rejects.toThrow();
  });

  it("una variable de precio sin configurar no se verifica: false", async () => {
    const { provider, spy } = build(async () => price());
    expect(await provider.verifyPrice("STRIPE_PRICE_INEXISTENTE", expected)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
