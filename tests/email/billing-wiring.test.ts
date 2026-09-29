import { describe, expect, it, vi } from "vitest";

const { sendPurchaseConfirmation, sendUpgradeConfirmation, runAfterResponse } = vi.hoisted(() => ({
  sendPurchaseConfirmation: vi.fn(async () => undefined),
  sendUpgradeConfirmation: vi.fn(async () => undefined),
  runAfterResponse: vi.fn((effect: () => Promise<void>) => void effect()),
}));

vi.mock("@/server/email/service", () => ({ sendPurchaseConfirmation, sendUpgradeConfirmation }));
vi.mock("@/server/email/run-after", () => ({ runAfterResponse }));

import { handleBillingWebhook, type BillingWebhookDeps } from "@/server/services/billing-webhook";
import { fakeProvider, payment, purchaseWorld, readyState, upgradePayment } from "../helpers/billing-world";

const eventsWorld = () => purchaseWorld({ events: { evt_A: { ownerId: "usr_A", title: "Andrea & Fernando", startsAt: new Date("2027-05-17T23:00:00Z") } } });

/** (13/14/15/37) el correo de compra/mejora se dispara SOLO cuando el webhook concede el plan de verdad, después de confirmar en la BD. */
describe("billing-webhook: dispara el correo de compra/mejora solo al conceder", () => {
  it("una compra INICIAL concedida dispara sendPurchaseConfirmation con los datos reales, después de confirmar", async () => {
    sendPurchaseConfirmation.mockClear();
    sendUpgradeConfirmation.mockClear();
    const world = eventsWorld();
    const { provider } = fakeProvider({ payments: { cs_1: payment() }, webhook: () => ({ id: "evt_1", type: "checkout.session.completed", createdAt: new Date("2027-01-05T00:00:00Z"), action: "confirm_payment", checkoutSessionId: "cs_1" }) });
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: world.store };
    const result = await handleBillingWebhook({ rawBody: "{}", signature: "firma" }, deps);
    expect(result.status).toBe(200);
    expect(sendPurchaseConfirmation).toHaveBeenCalledTimes(1);
    expect(sendUpgradeConfirmation).not.toHaveBeenCalled();
    expect(sendPurchaseConfirmation).toHaveBeenCalledWith(expect.objectContaining({ eventId: "evt_A", plan: "ESSENTIAL", amountMinor: 49900, currency: "MXN", checkoutSessionId: "cs_1" }));
    expect(runAfterResponse).toHaveBeenCalledTimes(1);
  });

  it("una MEJORA concedida dispara sendUpgradeConfirmation, no sendPurchaseConfirmation", async () => {
    sendPurchaseConfirmation.mockClear();
    sendUpgradeConfirmation.mockClear();
    const world = eventsWorld();
    await world.store.apply(async (ops) => ops.savePurchase({ eventId: "evt_A", userId: "usr_A", provider: "STRIPE", checkoutSessionId: "cs_prev", paymentIntentId: "pi_prev", plan: "ESSENTIAL", kind: "INITIAL", status: "PAID", amount: 49900, currency: "MXN", paidAt: new Date("2027-01-01T00:00:00Z"), accessStartsAt: new Date(), accessEndsAt: new Date("2027-06-17T00:00:00Z") }));
    const { provider } = fakeProvider({ payments: { cs_3: upgradePayment() }, webhook: () => ({ id: "evt_2", type: "checkout.session.completed", createdAt: new Date("2027-02-01T00:00:00Z"), action: "confirm_payment", checkoutSessionId: "cs_3" }) });
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: world.store };
    await handleBillingWebhook({ rawBody: "{}", signature: "firma" }, deps);
    expect(sendUpgradeConfirmation).toHaveBeenCalledTimes(1);
    expect(sendPurchaseConfirmation).not.toHaveBeenCalled();
    expect(sendUpgradeConfirmation).toHaveBeenCalledWith(expect.objectContaining({ plan: "PREMIUM", amountMinor: 30000 }));
  });

  it("un webhook REPETIDO (mismo id de evento) no dispara el correo una segunda vez", async () => {
    sendPurchaseConfirmation.mockClear();
    const world = eventsWorld();
    const { provider } = fakeProvider({ payments: { cs_1: payment() }, webhook: () => ({ id: "evt_1", type: "checkout.session.completed", createdAt: new Date(), action: "confirm_payment", checkoutSessionId: "cs_1" }) });
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: world.store };
    await handleBillingWebhook({ rawBody: "{}", signature: "firma" }, deps);
    await handleBillingWebhook({ rawBody: "{}", signature: "firma" }, deps); // mismo id de evento → "duplicate": apply ni siquiera corre
    expect(sendPurchaseConfirmation).toHaveBeenCalledTimes(1);
  });

  it("un pago FALLIDO o cancelado nunca dispara ningún correo de confirmación", async () => {
    sendPurchaseConfirmation.mockClear();
    sendUpgradeConfirmation.mockClear();
    const world = eventsWorld();
    const { provider } = fakeProvider({ webhook: () => ({ id: "evt_3", type: "checkout.session.expired", createdAt: new Date(), action: "close_payment", outcome: "CANCELED", checkoutSessionId: "cs_1" }) });
    const deps: BillingWebhookDeps = { getProviderState: () => readyState(provider), store: world.store };
    await handleBillingWebhook({ rawBody: "{}", signature: "firma" }, deps);
    expect(sendPurchaseConfirmation).not.toHaveBeenCalled();
    expect(sendUpgradeConfirmation).not.toHaveBeenCalled();
  });
});
