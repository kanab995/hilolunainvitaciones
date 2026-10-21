import type { NormalizedWebhookEvent, ProviderPayment } from "@/server/billing/provider";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import type { AddonPurchaseRecord } from "@/server/repositories/addon-purchases";
import type { OwnedPublication } from "@/server/repositories/publishing";
import type { AddonServiceDeps } from "@/server/services/addon-service";
import { handleBillingWebhook } from "@/server/services/billing-webhook";
import { fakeProvider, paidPurchase, payment, PRICE_REFS, purchaseWorld, readyState } from "./billing-world";

/**
 * MUNDO EN MEMORIA del complemento «Archivo listo para imprimir» (D-48): un evento Esencial de `usr_A`, el proveedor falso y las dependencias
 * del servicio del complemento con las mismas reglas que la base de datos real (propiedad, una sola compra pendiente por evento y complemento).
 */
export const USER = { id: "usr_A", email: "a@example.com", name: "Andrea" };
export const EVENT = "evt_A";
export const NOW = new Date("2027-01-15T00:00:00Z");

export const addonPayment = (over: Partial<ProviderPayment> = {}): ProviderPayment =>
  payment({ checkoutSessionId: "cs_addon_1", paymentIntentId: "pi_addon_1", amountMinor: 19900, priceRefs: [PRICE_REFS.STRIPE_PRICE_ADDON_PRINT_FILE], metadata: { userId: "usr_A", eventId: EVENT, addon: "PRINT_FILE" }, ...over });

export const addonRow = (over: Partial<AddonPurchaseRecord> = {}): AddonPurchaseRecord => ({
  id: "add_seed",
  eventId: EVENT,
  userId: "usr_A",
  addon: "PRINT_FILE",
  provider: "STRIPE",
  checkoutSessionId: "cs_addon_seed",
  paymentIntentId: "pi_addon_seed",
  status: "PAID",
  amount: 19900,
  currency: "MXN",
  paidAt: new Date("2027-01-10T00:00:00Z"),
  refundedAt: null,
  unlockKey: `${EVENT}:PRINT_FILE`,
  createdAt: new Date("2027-01-10T00:00:00Z"),
  ...over,
});

export const published: Extract<OwnedPublication, { state: "published" }> = { state: "published", invitation: andreaFernandoInvitation, slug: "andrea-y-fernando", title: "Boda", expired: false };

/** Un evento Esencial pagado (por defecto) en el mundo en memoria. */
export function setup(options: { plan?: "FREE" | "ESSENTIAL" | "PREMIUM"; addons?: AddonPurchaseRecord[]; sale?: boolean; publication?: OwnedPublication | undefined; provider?: ReturnType<typeof fakeProvider> } = {}) {
  const plan = options.plan ?? "ESSENTIAL";
  const world = purchaseWorld({
    events: { [EVENT]: { ownerId: "usr_A", title: "Andrea & Fernando", startsAt: new Date("2027-05-17T23:00:00Z"), paidAccessEndsAt: plan === "FREE" ? null : new Date("2027-06-16T23:00:00Z") } },
    customers: { usr_A: "cus_A" },
    purchases: plan === "FREE" ? [] : [paidPurchase({ plan, amount: plan === "PREMIUM" ? 79900 : 49900 })],
    addonPurchases: options.addons ?? [],
  });
  const fake = options.provider ?? fakeProvider();
  const pending: string[] = [];
  const deps: AddonServiceDeps = {
    getProviderState: () => readyState(fake.provider),
    saleEnabled: () => options.sale ?? true,
    findOwnedEventBilling: async (userId, eventId) => {
      const state = world.state(eventId);
      return state && state.ownerId === userId ? state : null;
    },
    findOwnedAddonPurchases: async (userId, eventId) => (world.state(eventId)?.ownerId === userId ? world.addonPurchases.filter((purchase) => purchase.eventId === eventId) : null),
    loadPublication: async () => ("publication" in options ? options.publication : published),
    findCustomer: async (userId) => world.customers.get(userId) ?? null,
    saveCustomer: async (_userId, _provider, id) => id,
    createPending: async (input) => {
      if (world.addonPurchases.some((purchase) => purchase.checkoutSessionId === input.checkoutSessionId)) return false;
      // Índice parcial de la base de datos: a lo sumo UNA compra PENDIENTE por evento y complemento.
      if (world.addonPurchases.some((purchase) => purchase.eventId === input.eventId && purchase.addon === input.addon && purchase.status === "PENDING")) return false;
      pending.push(input.checkoutSessionId);
      world.addonPurchases.push({ id: `pending_${pending.length}`, eventId: input.eventId, userId: input.userId, addon: input.addon, provider: input.provider, checkoutSessionId: input.checkoutSessionId, paymentIntentId: null, status: "PENDING", amount: input.amount, currency: input.currency, paidAt: null, refundedAt: null, unlockKey: null, createdAt: NOW });
      return true;
    },
    store: world.store,
    siteUrl: () => "https://hiloluna.example",
    now: () => NOW,
    sleep: async () => undefined,
    notifyConfirmed: () => undefined,
  };
  return { world, deps, fake, pending };
}

export const webhook = (world: ReturnType<typeof purchaseWorld>, fake: ReturnType<typeof fakeProvider>, event: NormalizedWebhookEvent) =>
  handleBillingWebhook({ rawBody: "{}", signature: "firmado" }, { getProviderState: () => readyState({ ...fake.provider, parseWebhook: () => event }), store: world.store });
export const completed = (sessionId: string, id = "evt_wh_1"): NormalizedWebhookEvent => ({ id, type: "checkout.session.completed", createdAt: NOW, action: "confirm_payment", checkoutSessionId: sessionId });
