import { maskExternalId } from "@/lib/admin/mask";
import { addonForPriceKey, expectedAddonAmountMinor, isAddonId, type AddonId } from "@/lib/billing/addons";
import { PRICING_CURRENCY } from "@/lib/billing/plans";
import type { BillingProvider, ProviderPayment } from "@/server/billing/provider";
import { addonUnlockKey, type AddonWriteOps } from "@/server/repositories/addon-purchases";
import type { BillingWriteOps } from "@/server/repositories/billing";
import { logger } from "@/server/observability/logger";

/**
 * SINCRONIZACIÓN DE LA COMPRA DE UN COMPLEMENTO (D-48) — misma disciplina que la de los planes (`purchase-sync.ts`), en su propia tabla.
 * El complemento SOLO se desbloquea si TODO se cumple (la metadata es una pista, nunca una autoridad):
 *   1. el pago está COBRADO;
 *   2. la sesión trae exactamente UN precio y es el precio CONOCIDO de un complemento (un precio de plan nunca desbloquea un complemento,
 *      y una sesión de complemento nunca concede un plan: el webhook decide la ruta por el PRECIO, ver `isAddonPayment`);
 *   3. la metadata no contradice al precio (otro complemento, o un `targetPlan`, se rechazan);
 *   4. MXN y EXACTAMENTE 19 900 centavos;
 *   5. el evento existe y su propietario es el usuario de la metadata (y del cliente del proveedor, si está registrado).
 * No se vuelve a exigir el plan del evento al confirmar: la elegibilidad se comprobó al abrir el pago, y un pago ya cobrado no se ignora.
 * Un SEGUNDO pago cobrado del mismo complemento (p. ej. dos pestañas a la vez) se guarda como PAGADO pero SIN desbloqueo (`unlockKey` NULL),
 * se registra como error para reembolsarlo y no cambia nada para el cliente: la base de datos impide dos desbloqueos.
 */
export type AddonConfirmOutcome =
  | "granted"
  | "already_paid"
  | "duplicate_payment"
  | "not_paid"
  | "rejected_metadata"
  | "rejected_price"
  | "rejected_mismatch"
  | "rejected_currency"
  | "rejected_amount"
  | "rejected_event"
  | "rejected_owner";

const reject = (outcome: Exclude<AddonConfirmOutcome, "granted" | "already_paid" | "duplicate_payment" | "not_paid">, payment: ProviderPayment): AddonConfirmOutcome => {
  logger.warn("billing.addon_payment_rejected", { session: maskExternalId(payment.checkoutSessionId), reason: outcome, effect: "no desbloquea ningún complemento" });
  return outcome;
};

/** Complemento al que corresponde el (único) precio cobrado, o `undefined` si no es el precio de un complemento. */
function addonOfPrice(provider: Pick<BillingProvider, "priceKeyFor">, payment: ProviderPayment): AddonId | undefined {
  if (payment.priceRefs.length !== 1) return undefined;
  const key = provider.priceKeyFor(payment.priceRefs[0] as string);
  return key ? addonForPriceKey(key) : undefined;
}

/**
 * ¿Este pago es de un COMPLEMENTO? Sí si su precio es el de un complemento, o si su metadata dice serlo (entonces se verifica como tal y,
 * si el precio no cuadra, se rechaza sin conceder nada). Todo lo demás sigue por el camino de los planes, sin cambios.
 */
export const isAddonPayment = (provider: Pick<BillingProvider, "priceKeyFor">, payment: ProviderPayment): boolean => Boolean(payment.metadata.addon) || addonOfPrice(provider, payment) !== undefined;

export async function confirmAddonPayment(ops: BillingWriteOps, provider: Pick<BillingProvider, "id" | "priceKeyFor">, payment: ProviderPayment, paidAt: Date): Promise<AddonConfirmOutcome> {
  if (payment.status !== "PAID") return "not_paid";
  const { userId, eventId, addon: claimed, targetPlan } = payment.metadata;
  if (!userId || !eventId) return reject("rejected_metadata", payment);

  const addon = addonOfPrice(provider, payment);
  if (!addon) return reject("rejected_price", payment);
  if ((claimed && claimed !== addon) || (claimed && !isAddonId(claimed)) || targetPlan) return reject("rejected_mismatch", payment);

  if (payment.currency !== PRICING_CURRENCY) return reject("rejected_currency", payment);
  if (payment.amountMinor !== expectedAddonAmountMinor(addon)) return reject("rejected_amount", payment);

  const event = await ops.findEvent(eventId);
  if (!event) return reject("rejected_event", payment);
  if (event.ownerId !== userId) return reject("rejected_owner", payment);
  if (payment.providerCustomerId) {
    const customerOwner = await ops.findCustomerUserId(provider.id, payment.providerCustomerId);
    if (customerOwner && customerOwner !== userId) return reject("rejected_owner", payment);
  }

  const existing = await ops.addons.findAddonBySession(provider.id, payment.checkoutSessionId);
  if (existing) {
    if (existing.eventId !== eventId || existing.userId !== userId || existing.addon !== addon) return reject("rejected_mismatch", payment);
    if (existing.status === "PAID") return "already_paid";
  }

  const alreadyUnlocked = (await ops.addons.listAddonPurchases(eventId)).some((purchase) => purchase.addon === addon && purchase.status === "PAID" && purchase.checkoutSessionId !== payment.checkoutSessionId);
  await ops.addons.saveAddonPurchase({
    eventId,
    userId,
    addon,
    provider: provider.id,
    checkoutSessionId: payment.checkoutSessionId,
    paymentIntentId: payment.paymentIntentId,
    status: "PAID",
    amount: payment.amountMinor,
    currency: payment.currency,
    paidAt,
    refundedAt: null,
    unlockKey: alreadyUnlocked ? null : addonUnlockKey(eventId, addon),
  });
  if (alreadyUnlocked) {
    // Dinero cobrado de más: lo ve el monitoreo para reembolsarlo desde el panel del proveedor (el reembolso llega por webhook y la marca REFUNDED).
    logger.error("billing.addon_duplicate_payment", undefined, { session: maskExternalId(payment.checkoutSessionId), addon, action: "reembolsar este cobro duplicado" });
    return "duplicate_payment";
  }
  return "granted";
}

/** Un pago de complemento que NO se completó: la compra pendiente pasa a `FAILED` / `CANCELED`. Nunca toca una compra `PAID`. */
export async function closeAddonPayment(
  ops: AddonWriteOps,
  providerId: BillingProvider["id"],
  input: { outcome: "FAILED" | "CANCELED"; checkoutSessionId?: string; metadata?: { eventId?: string; addon?: string } },
): Promise<"closed" | "noop"> {
  if (input.checkoutSessionId) {
    const purchase = await ops.findAddonBySession(providerId, input.checkoutSessionId);
    if (!purchase || purchase.status !== "PENDING") return "noop";
    await ops.setAddonStatus(purchase.id, input.outcome);
    return "closed";
  }
  const { eventId, addon } = input.metadata ?? {};
  if (!eventId || !isAddonId(addon)) return "noop";
  const pending = (await ops.listAddonPurchases(eventId)).filter((purchase) => purchase.status === "PENDING" && purchase.addon === addon).at(-1);
  if (!pending) return "noop";
  await ops.setAddonStatus(pending.id, input.outcome);
  return "closed";
}

/** Un reembolso TOTAL retira el complemento: la compra pasa a `REFUNDED` y libera el desbloqueo (la descarga deja de estar disponible). */
export async function refundAddonPayment(ops: AddonWriteOps, providerId: BillingProvider["id"], paymentIntentId: string, at: Date): Promise<"refunded" | "noop"> {
  const paid = (await ops.findAddonsByIntent(providerId, paymentIntentId)).filter((purchase) => purchase.status === "PAID");
  if (paid.length === 0) return "noop";
  for (const purchase of paid) await ops.setAddonStatus(purchase.id, "REFUNDED", at);
  return "refunded";
}
