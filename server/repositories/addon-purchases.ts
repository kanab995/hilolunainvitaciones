import type { AddonId } from "@/lib/billing/addons";
import type { BillingProviderId, PurchaseStatusId } from "@/lib/billing/purchase";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";

/**
 * COMPRAS DE COMPLEMENTOS (D-48): persistencia de `EventAddonPurchase`, la tabla PROPIA de los complementos. Nunca se lee para calcular el
 * plan de un evento (eso solo lo hace `EventPurchase`): un complemento no puede tocar planes ni mejoras. Reglas, las mismas que las compras
 * de planes:
 *  - Toda lectura desde la interfaz lleva el `userId` de la sesión en la propia consulta (`event.ownerId`): un evento ajeno es igual que uno
 *    inexistente.
 *  - Solo escriben el checkout (`PENDING`) y el webhook verificado (dentro de su transacción, `addonOpsFor`). El historial no se sobrescribe:
 *    una fila por sesión de cobro.
 *  - `unlockKey` (`<eventId>:<addon>`, única) solo la lleva la compra que desbloquea: la base de datos impide un segundo desbloqueo pagado.
 *  - Sin `DATABASE_URL` (demostración): lecturas vacías y escrituras con `StoreUnavailableError`.
 */
export interface AddonPurchaseRecord {
  id: string;
  eventId: string;
  userId: string;
  addon: AddonId;
  provider: BillingProviderId;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  status: PurchaseStatusId;
  /** Unidades menores (centavos). */
  amount: number;
  currency: string;
  paidAt: Date | null;
  refundedAt: Date | null;
  unlockKey: string | null;
  createdAt: Date;
}

export type AddonPurchaseWrite = Omit<AddonPurchaseRecord, "id" | "createdAt">;

const select = {
  id: true,
  eventId: true,
  userId: true,
  addon: true,
  provider: true,
  providerCheckoutSessionId: true,
  providerPaymentIntentId: true,
  status: true,
  amount: true,
  currency: true,
  paidAt: true,
  refundedAt: true,
  unlockKey: true,
  createdAt: true,
} as const;

type Row = Omit<AddonPurchaseRecord, "checkoutSessionId" | "paymentIntentId"> & { providerCheckoutSessionId: string; providerPaymentIntentId: string | null };
const toRecord = ({ providerCheckoutSessionId, providerPaymentIntentId, ...rest }: Row): AddonPurchaseRecord => ({ ...rest, checkoutSessionId: providerCheckoutSessionId, paymentIntentId: providerPaymentIntentId });

/** Clave de desbloqueo de un complemento de un evento (la única compra PAGADA que lo desbloquea la lleva). */
export const addonUnlockKey = (eventId: string, addon: AddonId): string => `${eventId}:${addon}`;

/** Compras de complementos de un evento DEL usuario (propiedad en la consulta). Evento ajeno o inexistente → `null`. */
export async function findOwnedEventAddonPurchases(userId: string, eventId: string): Promise<AddonPurchaseRecord[] | null> {
  if (getDataSource() === "demo") return null;
  const event = await prisma.event.findFirst({ where: { id: eventId, ownerId: userId }, select: { addonPurchases: { select, orderBy: { createdAt: "asc" } } } });
  return event ? event.addonPurchases.map(toRecord) : null;
}

/**
 * Alta de la compra `PENDING` al iniciar el checkout del complemento. Idempotente por sesión de cobro. Devuelve `false` si NO se insertó:
 * la misma sesión ya estaba registrada o, por el índice parcial `EventAddonPurchase_one_pending_per_event_addon`, el evento ya tiene OTRA
 * compra pendiente de ese complemento (dos pestañas a la vez). Quien llama decide qué hacer con su sesión.
 */
export async function createPendingAddonPurchase(input: { eventId: string; userId: string; addon: AddonId; provider: BillingProviderId; checkoutSessionId: string; amount: number; currency: string }): Promise<boolean> {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
  const { count } = await prisma.eventAddonPurchase.createMany({
    data: [{ eventId: input.eventId, userId: input.userId, addon: input.addon, provider: input.provider, providerCheckoutSessionId: input.checkoutSessionId, status: "PENDING", amount: input.amount, currency: input.currency }],
    skipDuplicates: true,
  });
  return count > 0;
}

/**
 * Historial de complementos de TODOS los eventos del usuario (propiedad en la consulta) para «Compras y planes»: solo lo cobrado y lo
 * reembolsado (los intentos pendientes, fallidos o cancelados no son compras). Nunca se usa para calcular un plan.
 */
export async function listOwnedAddonHistory(userId: string): Promise<AddonPurchaseRecord[]> {
  if (getDataSource() === "demo") return [];
  const rows = await prisma.eventAddonPurchase.findMany({ where: { event: { ownerId: userId }, status: { in: ["PAID", "REFUNDED"] } }, select, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return rows.map(toRecord);
}

/** Operaciones de complementos DENTRO de la transacción del webhook o de la reconciliación (ver `BillingWriteOps.addons`). */
export interface AddonWriteOps {
  listAddonPurchases(eventId: string): Promise<AddonPurchaseRecord[]>;
  findAddonBySession(provider: BillingProviderId, checkoutSessionId: string): Promise<AddonPurchaseRecord | null>;
  findAddonsByIntent(provider: BillingProviderId, paymentIntentId: string): Promise<AddonPurchaseRecord[]>;
  /** Crea o actualiza la compra de esa sesión de cobro (una fila por sesión). */
  saveAddonPurchase(record: AddonPurchaseWrite): Promise<void>;
  /** Cambia el estado (y, al reembolsar, libera el desbloqueo: `unlockKey` → NULL). */
  setAddonStatus(purchaseId: string, status: PurchaseStatusId, at?: Date): Promise<void>;
  /** Pasa el desbloqueo a otra compra PAGADA del mismo complemento (tras reembolsar la que lo tenía; ver `refundAddonPayment`). */
  setAddonUnlock(purchaseId: string, unlockKey: string): Promise<void>;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export function addonOpsFor(tx: Tx): AddonWriteOps {
  return {
    async listAddonPurchases(eventId) {
      return (await tx.eventAddonPurchase.findMany({ where: { eventId }, select, orderBy: { createdAt: "asc" } })).map(toRecord);
    },
    async findAddonBySession(provider, checkoutSessionId) {
      const row = await tx.eventAddonPurchase.findUnique({ where: { provider_providerCheckoutSessionId: { provider, providerCheckoutSessionId: checkoutSessionId } }, select });
      return row ? toRecord(row) : null;
    },
    async findAddonsByIntent(provider, paymentIntentId) {
      return (await tx.eventAddonPurchase.findMany({ where: { provider, providerPaymentIntentId: paymentIntentId }, select })).map(toRecord);
    },
    async saveAddonPurchase(record) {
      const { checkoutSessionId, paymentIntentId, ...rest } = record;
      const data = { ...rest, providerPaymentIntentId: paymentIntentId };
      await tx.eventAddonPurchase.upsert({
        where: { provider_providerCheckoutSessionId: { provider: record.provider, providerCheckoutSessionId: checkoutSessionId } },
        create: { ...data, providerCheckoutSessionId: checkoutSessionId },
        update: data,
      });
    },
    async setAddonStatus(purchaseId, status, at) {
      await tx.eventAddonPurchase.update({ where: { id: purchaseId }, data: { status, ...(status === "PAID" ? {} : { unlockKey: null }), ...(status === "REFUNDED" ? { refundedAt: at ?? new Date() } : {}) } });
    },
    async setAddonUnlock(purchaseId, unlockKey) {
      // La restricción CHECK exige que sea una compra PAGADA; la `unlockKey` única impide dos desbloqueos.
      await tx.eventAddonPurchase.update({ where: { id: purchaseId }, data: { unlockKey } });
    },
  };
}
