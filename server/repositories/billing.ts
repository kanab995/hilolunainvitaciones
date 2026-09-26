import type { PlanId } from "@/lib/billing/plans";
import type { BillingProviderId, PurchaseKindId, PurchaseStatusId } from "@/lib/billing/purchase";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";

/**
 * FACTURACIÓN (D-32: pago único por evento): persistencia de clientes, compras por evento y eventos de webhook. Solo este módulo
 * importa Prisma para facturación. Reglas:
 *  - La compra pertenece al EVENTO y a su propietario. Toda lectura desde la interfaz parte del `userId` de la sesión y lo aplica en
 *    la propia consulta (`event.ownerId`): un evento ajeno es indistinguible de uno inexistente. Las funciones `…ById` (sin
 *    propietario) existen solo para servicios que YA comprobaron la propiedad con `resolveOwnedEvent`, o para el webhook, cuya
 *    autoridad es la firma del proveedor.
 *  - Las compras solo se escriben desde el webhook verificado o al iniciar el checkout (`PENDING`): nada que venga del navegador
 *    decide un plan. El historial no se sobrescribe: una mejora es OTRA fila.
 *  - Sin `DATABASE_URL` (origen de demostración) las lecturas devuelven «sin compras» (= plan Gratis) y las escrituras lanzan
 *    `StoreUnavailableError`.
 *  - La tabla `Subscription` es LEGACY (modelo mensual anterior): este módulo no la lee ni la escribe.
 */
export interface PurchaseRecord {
  id: string;
  eventId: string;
  userId: string;
  provider: BillingProviderId;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  plan: PlanId;
  kind: PurchaseKindId;
  status: PurchaseStatusId;
  /** Unidades menores (centavos). */
  amount: number;
  currency: string;
  paidAt: Date | null;
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
  createdAt: Date;
}

/** Lo que se escribe al guardar una compra (el id y la fecha de alta los pone la base de datos si es nueva). */
export type PurchaseWrite = Omit<PurchaseRecord, "id" | "createdAt">;

/** Un evento con sus compras: todo lo necesario para resolver su plan y su ventana de acceso. */
export interface EventBillingState {
  eventId: string;
  ownerId: string;
  title: string;
  startsAt: Date;
  paidAccessEndsAt: Date | null;
  purchases: PurchaseRecord[];
}

const purchaseSelect = {
  id: true,
  eventId: true,
  userId: true,
  provider: true,
  providerCheckoutSessionId: true,
  providerPaymentIntentId: true,
  plan: true,
  kind: true,
  status: true,
  amount: true,
  currency: true,
  paidAt: true,
  accessStartsAt: true,
  accessEndsAt: true,
  createdAt: true,
} as const;

type PurchaseRow = {
  id: string;
  eventId: string;
  userId: string;
  provider: BillingProviderId;
  providerCheckoutSessionId: string;
  providerPaymentIntentId: string | null;
  plan: PlanId;
  kind: PurchaseKindId;
  status: PurchaseStatusId;
  amount: number;
  currency: string;
  paidAt: Date | null;
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
  createdAt: Date;
};

const toRecord = ({ providerCheckoutSessionId, providerPaymentIntentId, ...rest }: PurchaseRow): PurchaseRecord => ({ ...rest, checkoutSessionId: providerCheckoutSessionId, paymentIntentId: providerPaymentIntentId });

function requireDatabase(): void {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
}

const stateSelect = { id: true, ownerId: true, title: true, startsAt: true, paidAccessEndsAt: true, purchases: { select: purchaseSelect, orderBy: { createdAt: "asc" } } } as const;

function toState(row: { id: string; ownerId: string; title: string; startsAt: Date; paidAccessEndsAt: Date | null; purchases: PurchaseRow[] }): EventBillingState {
  return { eventId: row.id, ownerId: row.ownerId, title: row.title, startsAt: row.startsAt, paidAccessEndsAt: row.paidAccessEndsAt, purchases: row.purchases.map(toRecord) };
}

/**
 * Estado de facturación de un evento DEL usuario (propiedad en la propia consulta). Evento ajeno o inexistente → `null`.
 * Sin base de datos → un evento sin compras (plan Gratis) no se puede inventar sin evento: devuelve `null`.
 */
export async function findOwnedEventBilling(userId: string, eventId: string): Promise<EventBillingState | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.event.findFirst({ where: { id: eventId, ownerId: userId }, select: stateSelect });
  return row ? toState(row) : null;
}

/**
 * Estado de facturación de un evento por id, SIN comprobar propietario. Solo para servicios que ya resolvieron la propiedad del
 * evento (`resolveOwnedEvent`) o para el webhook (autoridad = firma). Sin base de datos → `null` (se resuelve como Gratis).
 */
export async function findEventBillingById(eventId: string): Promise<EventBillingState | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.event.findUnique({ where: { id: eventId }, select: stateSelect });
  return row ? toState(row) : null;
}

/** Eventos del usuario con sus compras y su uso, para «Compras y planes». */
export interface OwnedEventBillingRow extends EventBillingState {
  slug: string;
  guestCount: number;
  galleryCount: number;
}

export async function listOwnedEventsBilling(userId: string): Promise<OwnedEventBillingRow[]> {
  if (getDataSource() === "demo") return [];
  const rows = await prisma.event.findMany({
    where: { ownerId: userId, status: { not: "ARCHIVED" } },
    orderBy: { startsAt: "asc" },
    select: { ...stateSelect, slug: true, _count: { select: { guests: true, galleryImages: true } } },
  });
  return rows.map((row) => ({ ...toState(row), slug: row.slug, guestCount: row._count.guests, galleryCount: row._count.galleryImages }));
}

/** Cliente del proveedor de un usuario (si ya lo tiene). */
export async function findProviderCustomerId(userId: string, provider: BillingProviderId): Promise<string | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.billingCustomer.findUnique({ where: { userId_provider: { userId, provider } }, select: { providerCustomerId: true } });
  return row?.providerCustomerId ?? null;
}

/**
 * Guarda el cliente del proveedor del usuario. Si otra petición lo guardó antes (dos checkouts simultáneos), gana el
 * existente y se devuelve ESE: un usuario nunca acaba con dos clientes.
 */
export async function saveProviderCustomer(userId: string, provider: BillingProviderId, providerCustomerId: string): Promise<string> {
  requireDatabase();
  await prisma.billingCustomer.createMany({ data: [{ userId, provider, providerCustomerId }], skipDuplicates: true });
  const row = await prisma.billingCustomer.findUnique({ where: { userId_provider: { userId, provider } }, select: { providerCustomerId: true } });
  if (!row) throw new Error("No se pudo guardar el cliente de facturación.");
  return row.providerCustomerId;
}

/** Alta de la compra `PENDING` al iniciar el checkout. Idempotente por sesión de cobro. */
export async function createPendingPurchase(input: { eventId: string; userId: string; provider: BillingProviderId; checkoutSessionId: string; plan: PlanId; kind: PurchaseKindId; amount: number; currency: string }): Promise<void> {
  requireDatabase();
  await prisma.eventPurchase.createMany({
    data: [{ eventId: input.eventId, userId: input.userId, provider: input.provider, providerCheckoutSessionId: input.checkoutSessionId, plan: input.plan, kind: input.kind, status: "PENDING", amount: input.amount, currency: input.currency }],
    skipDuplicates: true,
  });
}

/** Operaciones que el webhook puede hacer DENTRO de la transacción que registra el evento. */
export interface BillingWriteOps {
  findEvent(eventId: string): Promise<{ ownerId: string; startsAt: Date; paidAccessEndsAt: Date | null } | null>;
  /** Usuario al que pertenece un cliente del proveedor (para verificar que el pago es de quien dice la metadata). */
  findCustomerUserId(provider: BillingProviderId, providerCustomerId: string): Promise<string | null>;
  listPurchases(eventId: string): Promise<PurchaseRecord[]>;
  findPurchaseBySession(provider: BillingProviderId, checkoutSessionId: string): Promise<PurchaseRecord | null>;
  findPurchasesByIntent(provider: BillingProviderId, paymentIntentId: string): Promise<PurchaseRecord[]>;
  /** Crea o actualiza la compra de esa sesión de cobro (una fila por sesión). */
  savePurchase(record: PurchaseWrite): Promise<void>;
  setPurchaseStatus(purchaseId: string, status: PurchaseStatusId): Promise<void>;
  /** Fija el fin del acceso de pago del evento (el llamador ya calculó `max(...)`: solo crece). */
  setPaidAccessEnd(eventId: string, end: Date): Promise<void>;
}

/** Almacén del webhook: registra el evento y aplica su efecto de forma ATÓMICA e idempotente. */
export interface BillingStore {
  /**
   * Registra `externalEventId` y ejecuta `apply` en UNA transacción. Si el evento ya estaba registrado devuelve
   * `"duplicate"` sin ejecutar nada. Si `apply` falla, la transacción se revierte (el evento NO queda registrado y el
   * proveedor lo reintentará).
   */
  recordEventAndApply(event: { provider: BillingProviderId; externalEventId: string; type: string }, apply: (ops: BillingWriteOps) => Promise<void>): Promise<"processed" | "duplicate">;
  /** Aplica cambios en una transacción SIN registrar ningún evento (reconciliación explícita con el proveedor). */
  apply(apply: (ops: BillingWriteOps) => Promise<void>): Promise<void>;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function opsFor(tx: Tx): BillingWriteOps {
  return {
    findEvent: (eventId) => tx.event.findUnique({ where: { id: eventId }, select: { ownerId: true, startsAt: true, paidAccessEndsAt: true } }),
    async findCustomerUserId(provider, providerCustomerId) {
      const row = await tx.billingCustomer.findUnique({ where: { provider_providerCustomerId: { provider, providerCustomerId } }, select: { userId: true } });
      return row?.userId ?? null;
    },
    async listPurchases(eventId) {
      return (await tx.eventPurchase.findMany({ where: { eventId }, select: purchaseSelect, orderBy: { createdAt: "asc" } })).map(toRecord);
    },
    async findPurchaseBySession(provider, checkoutSessionId) {
      const row = await tx.eventPurchase.findUnique({ where: { provider_providerCheckoutSessionId: { provider, providerCheckoutSessionId: checkoutSessionId } }, select: purchaseSelect });
      return row ? toRecord(row) : null;
    },
    async findPurchasesByIntent(provider, paymentIntentId) {
      return (await tx.eventPurchase.findMany({ where: { provider, providerPaymentIntentId: paymentIntentId }, select: purchaseSelect })).map(toRecord);
    },
    async savePurchase(record) {
      const { checkoutSessionId, paymentIntentId, ...rest } = record;
      const data = { ...rest, providerPaymentIntentId: paymentIntentId };
      await tx.eventPurchase.upsert({
        where: { provider_providerCheckoutSessionId: { provider: record.provider, providerCheckoutSessionId: checkoutSessionId } },
        create: { ...data, providerCheckoutSessionId: checkoutSessionId },
        update: data,
      });
    },
    async setPurchaseStatus(purchaseId, status) {
      await tx.eventPurchase.update({ where: { id: purchaseId }, data: { status } });
    },
    async setPaidAccessEnd(eventId, end) {
      await tx.event.update({ where: { id: eventId }, data: { paidAccessEndsAt: end } });
    },
  };
}

export const prismaBillingStore: BillingStore = {
  async recordEventAndApply(event, apply) {
    requireDatabase();
    return prisma.$transaction(async (tx) => {
      // `skipDuplicates` = INSERT … ON CONFLICT DO NOTHING: un duplicado no aborta la transacción.
      const created = await tx.webhookEvent.createMany({ data: [{ provider: event.provider, externalEventId: event.externalEventId, type: event.type }], skipDuplicates: true });
      if (created.count === 0) return "duplicate" as const;
      await apply(opsFor(tx));
      return "processed" as const;
    });
  },
  async apply(apply) {
    requireDatabase();
    await prisma.$transaction(async (tx) => apply(opsFor(tx)));
  },
};
