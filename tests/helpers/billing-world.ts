import { vi } from "vitest";
import type { PlanId } from "@/lib/billing/plans";
import type { BillingProviderId, PurchaseKindId, PurchaseStatusId } from "@/lib/billing/purchase";
import type { BillingProvider, BillingProviderState, NormalizedWebhookEvent, ProviderPayment } from "@/server/billing/provider";
import { WebhookSignatureError } from "@/server/billing/provider";
import type { BillingStore, BillingWriteOps, EventBillingState, OwnedEventBillingRow, PurchaseRecord } from "@/server/repositories/billing";
import type { BillingServiceDeps } from "@/server/services/billing-service";

/** Precios del proveedor de prueba, por variable de la configuración de planes. */
export const PRICE_REFS = {
  STRIPE_PRICE_ESSENTIAL_ONE_TIME: "price_ess_once",
  STRIPE_PRICE_PREMIUM_ONE_TIME: "price_pre_once",
  STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "price_upgrade",
} as const;

export interface FakeEvent {
  ownerId: string;
  title?: string;
  slug?: string;
  startsAt: Date;
  paidAccessEndsAt?: Date | null;
}

/**
 * MUNDO DE PRUEBA de las compras por evento: la «base de datos» es un objeto en memoria con la misma semántica que la de Prisma
 * (eventos de webhook únicos, todo-o-nada al aplicar, propiedad en cada lectura del usuario). Ninguna prueba toca PostgreSQL ni Stripe.
 */
export function purchaseWorld(seed: { events?: Record<string, FakeEvent>; customers?: Record<string, string>; purchases?: PurchaseRecord[] } = {}) {
  const events = new Map<string, FakeEvent>(Object.entries(seed.events ?? {}).map(([id, event]) => [id, { paidAccessEndsAt: null, ...event }]));
  const customers = new Map<string, string>(Object.entries(seed.customers ?? {})); // userId → providerCustomerId
  const purchases: PurchaseRecord[] = [...(seed.purchases ?? [])];
  const webhookEvents = new Set<string>();
  const writes: string[] = [];
  let seq = 0;

  const state = (eventId: string): EventBillingState | null => {
    const event = events.get(eventId);
    return event ? { eventId, ownerId: event.ownerId, title: event.title ?? eventId, startsAt: event.startsAt, paidAccessEndsAt: event.paidAccessEndsAt ?? null, purchases: purchases.filter((purchase) => purchase.eventId === eventId) } : null;
  };

  const ops = (target: { purchases: PurchaseRecord[]; events: Map<string, FakeEvent> }): BillingWriteOps => ({
    async findEvent(eventId) {
      const event = target.events.get(eventId);
      return event ? { ownerId: event.ownerId, startsAt: event.startsAt, paidAccessEndsAt: event.paidAccessEndsAt ?? null } : null;
    },
    async findCustomerUserId(_provider, customerId) {
      return [...customers].find(([, id]) => id === customerId)?.[0] ?? null;
    },
    async listPurchases(eventId) {
      return target.purchases.filter((purchase) => purchase.eventId === eventId);
    },
    async findPurchaseBySession(_provider, sessionId) {
      return target.purchases.find((purchase) => purchase.checkoutSessionId === sessionId) ?? null;
    },
    async findPurchasesByIntent(_provider, intentId) {
      return target.purchases.filter((purchase) => purchase.paymentIntentId === intentId);
    },
    async savePurchase(record) {
      writes.push(`save:${record.eventId}:${record.plan}:${record.kind}:${record.status}`);
      const index = target.purchases.findIndex((purchase) => purchase.checkoutSessionId === record.checkoutSessionId);
      if (index >= 0) target.purchases[index] = { ...(target.purchases[index] as PurchaseRecord), ...record };
      else target.purchases.push({ ...record, id: `pur_${++seq}`, createdAt: new Date("2027-01-01T00:00:00Z") });
    },
    async setPurchaseStatus(purchaseId, status) {
      writes.push(`status:${purchaseId}:${status}`);
      const purchase = target.purchases.find((candidate) => candidate.id === purchaseId);
      if (purchase) purchase.status = status;
    },
    async setPaidAccessEnd(eventId, end) {
      writes.push(`access:${eventId}:${end.toISOString()}`);
      const event = target.events.get(eventId);
      if (event) event.paidAccessEndsAt = end;
    },
  });

  const store: BillingStore = {
    async recordEventAndApply(event, apply) {
      const key = `${event.provider}:${event.externalEventId}`;
      if (webhookEvents.has(key)) return "duplicate";
      // Transacción: se trabaja sobre una copia y solo se confirma si `apply` no falla (el evento tampoco se registra).
      const draft = { purchases: purchases.map((purchase) => ({ ...purchase })), events: new Map([...events].map(([id, value]) => [id, { ...value }])) };
      await apply(ops(draft));
      purchases.splice(0, purchases.length, ...draft.purchases);
      for (const [id, value] of draft.events) events.set(id, value);
      webhookEvents.add(key);
      return "processed";
    },
    async apply(apply) {
      await apply(ops({ purchases, events }));
    },
  };

  return { events, customers, purchases, webhookEvents, writes, store, state };
}

export function paidPurchase(over: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: "pur_seed",
    eventId: "evt_A",
    userId: "usr_A",
    provider: "STRIPE",
    checkoutSessionId: "cs_seed",
    paymentIntentId: "pi_seed",
    plan: "ESSENTIAL",
    kind: "INITIAL",
    status: "PAID",
    amount: 49900,
    currency: "MXN",
    paidAt: new Date("2027-01-10T00:00:00Z"),
    accessStartsAt: new Date("2027-01-10T00:00:00Z"),
    accessEndsAt: new Date("2027-06-16T00:00:00Z"),
    createdAt: new Date("2027-01-10T00:00:00Z"),
    ...over,
  };
}

/** Un pago cobrado correctamente de Esencial (por defecto); cada prueba cambia lo que necesita. */
export function payment(over: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    checkoutSessionId: "cs_1",
    paymentIntentId: "pi_1",
    providerCustomerId: "cus_A",
    status: "PAID",
    amountMinor: 49900,
    currency: "MXN",
    priceRefs: [PRICE_REFS.STRIPE_PRICE_ESSENTIAL_ONE_TIME],
    metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "ESSENTIAL" },
    ...over,
  };
}

export const premiumPayment = (over: Partial<ProviderPayment> = {}) => payment({ checkoutSessionId: "cs_2", paymentIntentId: "pi_2", amountMinor: 79900, priceRefs: [PRICE_REFS.STRIPE_PRICE_PREMIUM_ONE_TIME], metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "PREMIUM" }, ...over });
export const upgradePayment = (over: Partial<ProviderPayment> = {}) => payment({ checkoutSessionId: "cs_3", paymentIntentId: "pi_3", amountMinor: 30000, priceRefs: [PRICE_REFS.STRIPE_PRICE_ESSENTIAL_TO_PREMIUM], metadata: { userId: "usr_A", eventId: "evt_A", targetPlan: "PREMIUM" }, ...over });

/** Proveedor de pruebas: precios conocidos, sin red. `payments` es «Stripe ahora»; `webhook` decide qué evento «llega». */
export function fakeProvider(over: Partial<BillingProvider> & { payments?: Record<string, ProviderPayment>; webhook?: (raw: string, signature: string | null) => NormalizedWebhookEvent } = {}) {
  const { webhook, payments = {}, ...rest } = over;
  const calls = { createCustomer: vi.fn(), createEventCheckout: vi.fn(), createPortalSession: vi.fn(), getPayment: vi.fn(), findPaymentByIntent: vi.fn(), getCheckoutSession: vi.fn(), expireCheckoutSession: vi.fn() };
  /** Sesiones de cobro del «proveedor»: con la MISMA clave de idempotencia devuelve la MISMA sesión (como Stripe). */
  const sessionsByKey = new Map<string, string>();
  const sessionStatus = new Map<string, "open" | "complete" | "expired">();
  /** La primera sesión conserva la URL histórica de las pruebas (`session_1`); las demás, su id. */
  const urlFor = (id: string) => `https://checkout.stripe.test/${id === "cs_new_1" ? "session_1" : id}`;
  const keysByRef = new Map<string, string>(Object.entries(PRICE_REFS).map(([key, ref]) => [ref, key]));
  let sessions = 0;
  const provider: BillingProvider = {
    id: "STRIPE",
    priceRefFor: (key) => (PRICE_REFS as Record<string, string>)[key],
    priceKeyFor: (ref) => keysByRef.get(ref),
    verifyPrice: async () => true,
    createCustomer: async (input) => {
      calls.createCustomer(input);
      return { providerCustomerId: `cus_new_${input.userId}` };
    },
    createEventCheckout: async (input) => {
      calls.createEventCheckout(input);
      const known = sessionsByKey.get(input.idempotencyKey);
      if (known) return { url: urlFor(known), checkoutSessionId: known };
      const id = `cs_new_${++sessions}`;
      sessionsByKey.set(input.idempotencyKey, id);
      sessionStatus.set(id, "open");
      return { url: urlFor(id), checkoutSessionId: id };
    },
    getCheckoutSession: async (id) => {
      calls.getCheckoutSession(id);
      const status = sessionStatus.get(id);
      return status ? { status, url: status === "open" ? urlFor(id) : null } : undefined;
    },
    expireCheckoutSession: async (id) => {
      calls.expireCheckoutSession(id);
      if (sessionStatus.get(id) === "open") sessionStatus.set(id, "expired");
    },
    createPortalSession: async (input) => {
      calls.createPortalSession(input);
      return { url: "https://billing.stripe.test/portal_1" };
    },
    getPayment: async (id) => {
      calls.getPayment(id);
      return payments[id];
    },
    findPaymentByIntent: async (id) => {
      calls.findPaymentByIntent(id);
      return Object.values(payments).find((candidate) => candidate.paymentIntentId === id);
    },
    parseWebhook: (raw, signature) => {
      if (!signature) throw new WebhookSignatureError();
      if (!webhook) throw new Error("sin evento de prueba");
      return webhook(raw, signature);
    },
    ...rest,
  };
  return { provider, calls, sessionStatus, sessionsByKey };
}

export const readyState = (provider: BillingProvider): BillingProviderState => ({ status: "ready", provider });

/** Dependencias del servicio de facturación sobre el mundo en memoria (propiedad aplicada como en el repositorio real). */
export function billingDeps(over: Partial<BillingServiceDeps> & { provider?: BillingProvider; world?: ReturnType<typeof purchaseWorld> } = {}) {
  const world = over.world ?? purchaseWorld({ events: { evt_A: { ownerId: "usr_A", title: "Andrea & Fernando", startsAt: new Date("2027-05-17T23:00:00Z") } } });
  const { provider = fakeProvider().provider, world: _world, ...rest } = over;
  void _world;
  const pending: string[] = [];
  const deps: BillingServiceDeps = {
    getProviderState: () => readyState(provider),
    findOwnedEventBilling: async (userId, eventId) => {
      const state = world.state(eventId);
      return state && state.ownerId === userId ? state : null;
    },
    listOwnedEventsBilling: async (userId) =>
      [...world.events]
        .filter(([, event]) => event.ownerId === userId)
        .map(([eventId, event]): OwnedEventBillingRow => ({ ...(world.state(eventId) as EventBillingState), slug: event.slug ?? eventId, guestCount: 0, galleryCount: 0 })),
    findCustomer: async (userId) => world.customers.get(userId) ?? null,
    saveCustomer: async (userId, _provider: BillingProviderId, customerId) => {
      if (!world.customers.has(userId)) world.customers.set(userId, customerId);
      return world.customers.get(userId) as string;
    },
    createPending: async (input) => {
      // Igual que la base de datos real (`skipDuplicates`): una compra por sesión de cobro.
      if (world.purchases.some((purchase) => purchase.checkoutSessionId === input.checkoutSessionId)) return;
      pending.push(`${input.eventId}:${input.plan}:${input.kind}:${input.amount}:${input.currency}:${input.checkoutSessionId}`);
      world.purchases.push({ id: `pending_${pending.length}`, eventId: input.eventId, userId: input.userId, provider: input.provider, checkoutSessionId: input.checkoutSessionId, paymentIntentId: null, plan: input.plan, kind: input.kind, status: "PENDING", amount: input.amount, currency: input.currency, paidAt: null, accessStartsAt: null, accessEndsAt: null, createdAt: new Date("2027-01-15T00:00:00Z") });
    },
    store: world.store,
    siteUrl: () => "https://hiloluna.example",
    now: () => new Date("2027-01-15T00:00:00Z"),
    ...rest,
  };
  return { deps, world, pending };
}

export type { PlanId, PurchaseKindId, PurchaseStatusId };
