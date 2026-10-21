import { describe, expect, it, vi } from "vitest";
import type { NormalizedWebhookEvent } from "@/server/billing/provider";
import { reconcileEventPayments } from "@/server/services/billing-service";
import { handleBillingWebhook } from "@/server/services/billing-webhook";
import { notifyGrantedPurchase } from "@/server/services/purchase-emails";
import { billingDeps, fakeProvider, paidPurchase, payment, purchaseWorld, readyState, upgradePayment } from "../helpers/billing-world";

/**
 * CORREO DE CONFIRMACIÓN DE UN PLAN cuando la reconciliación del regreso del pago (`?payment=success`) concede ANTES que el webhook. Antes,
 * la reconciliación no pedía el correo y el webhook posterior veía `already_paid`: la compra quedaba sin confirmación. Ahora quien concede
 * primero lo pide, y nunca hay dos (además, `EmailDelivery` es único por compra).
 */
const mail = vi.hoisted(() => ({ sendPurchaseConfirmation: vi.fn(async () => undefined), sendUpgradeConfirmation: vi.fn(async () => undefined), sendPrintAddonConfirmation: vi.fn(async () => undefined) }));
vi.mock("@/server/email/service", () => mail);

const user = { id: "usr_A" };
const NOW = new Date("2027-01-15T00:00:00Z");
const event = { ownerId: "usr_A", title: "Andrea & Fernando", startsAt: new Date("2027-05-17T23:00:00Z") };
const completed = (sessionId: string, id: string): NormalizedWebhookEvent => ({ id, type: "checkout.session.completed", createdAt: NOW, action: "confirm_payment", checkoutSessionId: sessionId });

/** Evento con una compra PENDIENTE (`cs_1`, Esencial) y el proveedor que la tiene cobrada. */
function pendingEssential() {
  const world = purchaseWorld({ events: { evt_A: event }, customers: { usr_A: "cus_A" }, purchases: [paidPurchase({ id: "p1", status: "PENDING", paidAt: null, checkoutSessionId: "cs_1", paymentIntentId: null })] });
  const { provider } = fakeProvider({ payments: { cs_1: payment() } });
  const webhook = (event: NormalizedWebhookEvent) => handleBillingWebhook({ rawBody: "{}", signature: "firmado" }, { getProviderState: () => readyState({ ...provider, parseWebhook: () => event }), store: world.store });
  return { world, provider, webhook };
}

const resetMail = () => Object.values(mail).forEach((fn) => fn.mockClear());

describe("correo de confirmación de plan concedido por la reconciliación", () => {
  it("la reconciliación concede y pide el correo UNA vez, con los datos reales de la compra", async () => {
    const { world, provider } = pendingEssential();
    const notifyGranted = vi.fn();
    const { deps } = billingDeps({ provider, world, notifyGranted });
    expect(await reconcileEventPayments(user, "evt_A", deps)).toEqual({ granted: 1 });
    expect(notifyGranted).toHaveBeenCalledTimes(1);
    expect(notifyGranted).toHaveBeenCalledWith("STRIPE", expect.objectContaining({ eventId: "evt_A", plan: "ESSENTIAL", kind: "INITIAL", checkoutSessionId: "cs_1", amountMinor: 49900, currency: "MXN" }));
    // Repetir la reconciliación no vuelve a pedirlo: ya no queda nada pendiente.
    expect(await reconcileEventPayments(user, "evt_A", deps)).toEqual({ granted: 0 });
    expect(notifyGranted).toHaveBeenCalledTimes(1);
  });

  it("reconciliación primero y webhook después: exactamente un correo (el webhook ve `already_paid`)", async () => {
    resetMail();
    const { world, provider, webhook } = pendingEssential();
    const { deps } = billingDeps({ provider, world, notifyGranted: notifyGrantedPurchase });
    await reconcileEventPayments(user, "evt_A", deps);
    expect(mail.sendPurchaseConfirmation).toHaveBeenCalledTimes(1);
    expect(mail.sendPurchaseConfirmation).toHaveBeenCalledWith(expect.objectContaining({ eventId: "evt_A", provider: "STRIPE", checkoutSessionId: "cs_1", plan: "ESSENTIAL", amountMinor: 49900 }));
    expect((await webhook(completed("cs_1", "evt_wh_late"))).status).toBe(200);
    expect(mail.sendPurchaseConfirmation).toHaveBeenCalledTimes(1);
  });

  it("webhook primero (lo habitual): un correo, y la reconciliación posterior no pide otro", async () => {
    resetMail();
    const { world, provider, webhook } = pendingEssential();
    await webhook(completed("cs_1", "evt_wh_1"));
    expect(mail.sendPurchaseConfirmation).toHaveBeenCalledTimes(1);
    const { deps } = billingDeps({ provider, world, notifyGranted: notifyGrantedPurchase });
    expect(await reconcileEventPayments(user, "evt_A", deps)).toEqual({ granted: 0 });
    expect(mail.sendPurchaseConfirmation).toHaveBeenCalledTimes(1);
  });

  it("una mejora Esencial → Premium concedida por la reconciliación envía el correo de MEJORA con la diferencia (300)", async () => {
    resetMail();
    const world = purchaseWorld({
      events: { evt_A: event },
      customers: { usr_A: "cus_A" },
      purchases: [paidPurchase(), paidPurchase({ id: "p3", plan: "PREMIUM", kind: "UPGRADE", status: "PENDING", paidAt: null, checkoutSessionId: "cs_3", paymentIntentId: null, amount: 30000 })],
    });
    const { provider } = fakeProvider({ payments: { cs_3: upgradePayment() } });
    const { deps } = billingDeps({ provider, world, notifyGranted: notifyGrantedPurchase });
    expect(await reconcileEventPayments(user, "evt_A", deps)).toEqual({ granted: 1 });
    expect(mail.sendPurchaseConfirmation).not.toHaveBeenCalled();
    expect(mail.sendUpgradeConfirmation).toHaveBeenCalledWith(expect.objectContaining({ plan: "PREMIUM", amountMinor: 30000, checkoutSessionId: "cs_3" }));
  });

  it("un pago que no cuadra (importe distinto) no concede ni pide correo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const world = purchaseWorld({ events: { evt_A: event }, purchases: [paidPurchase({ id: "p1", status: "PENDING", paidAt: null, checkoutSessionId: "cs_1", paymentIntentId: null })] });
    const { provider } = fakeProvider({ payments: { cs_1: payment({ amountMinor: 100 }) } });
    const notifyGranted = vi.fn();
    const { deps } = billingDeps({ provider, world, notifyGranted });
    expect(await reconcileEventPayments(user, "evt_A", deps)).toEqual({ granted: 0 });
    expect(notifyGranted).not.toHaveBeenCalled();
  });

  it("si la transacción falla, no se pide ningún correo (nunca se confirma una compra no guardada)", async () => {
    const { world, provider } = pendingEssential();
    const notifyGranted = vi.fn();
    const { deps } = billingDeps({ provider, world, notifyGranted, store: { ...world.store, apply: async () => Promise.reject(new Error("base de datos caída")) } });
    await expect(reconcileEventPayments(user, "evt_A", deps)).rejects.toThrow("base de datos caída");
    expect(notifyGranted).not.toHaveBeenCalled();
  });
});
