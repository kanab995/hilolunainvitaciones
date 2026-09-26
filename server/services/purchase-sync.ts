import { maskExternalId } from "@/lib/admin/mask";
import { isPaidPlanId, planIncludes, PRICING_CURRENCY } from "@/lib/billing/plans";
import { computePaidAccessEnd, expectedPurchaseAmountMinor, getEffectiveEventPlan, purchaseForPriceKey } from "@/lib/billing/purchase";
import type { BillingProvider, ProviderPayment } from "@/server/billing/provider";
import type { BillingWriteOps } from "@/server/repositories/billing";
import { logger } from "@/server/observability/logger";

/**
 * SINCRONIZACIÓN DE UN PAGO ÚNICO con la base de datos (D-32). Lo usan el webhook (fuente de verdad) y la reconciliación explícita.
 * Lógica pura sobre `BillingWriteOps` (se prueba sin base de datos ni proveedor). Un plan SOLO se concede si TODO esto se cumple; la
 * metadata de la sesión es una pista, nunca una autoridad:
 *   1. el pago está COBRADO (`PAID`);
 *   2. la sesión trae exactamente UN precio y es un precio CONOCIDO de la configuración del servidor (compra inicial o mejora);
 *   3. el plan de ese precio coincide con `targetPlan` de la metadata (una metadata falsa de «Premium» sobre un precio de Esencial no concede nada);
 *   4. la moneda es MXN y el importe cobrado es EXACTAMENTE el esperado (precio del plan, o la diferencia en una mejora);
 *   5. el evento existe y su propietario es el usuario de la metadata (y del cliente del proveedor, si está registrado);
 *   6. una mejora exige que el evento ya tenga el plan de origen pagado.
 * La compra se guarda como una fila POR SESIÓN de cobro (idempotente); el historial nunca se sobrescribe. Al conceder, se fija el fin del
 * acceso del evento (`max(compra + 30 días, evento + 30 días, fin actual)`: solo crece).
 */
export type ConfirmOutcome =
  | "granted"
  | "already_paid"
  | "not_paid"
  | "rejected_metadata"
  | "rejected_price"
  | "rejected_mismatch"
  | "rejected_currency"
  | "rejected_amount"
  | "rejected_event"
  | "rejected_owner"
  | "rejected_upgrade";

const reject = (outcome: Exclude<ConfirmOutcome, "granted" | "already_paid" | "not_paid">, payment: ProviderPayment): ConfirmOutcome => {
  // Solo la sesión y el motivo: nunca importes, correos ni metadata.
  logger.warn("billing.payment_rejected", { session: maskExternalId(payment.checkoutSessionId), reason: outcome, effect: "no concede ningún plan" });
  return outcome;
};

export async function confirmPayment(ops: BillingWriteOps, provider: Pick<BillingProvider, "id" | "priceKeyFor">, payment: ProviderPayment, paidAt: Date): Promise<ConfirmOutcome> {
  if (payment.status !== "PAID") return "not_paid";

  const { userId, eventId, targetPlan } = payment.metadata;
  if (!userId || !eventId || !isPaidPlanId(targetPlan)) return reject("rejected_metadata", payment);

  if (payment.priceRefs.length !== 1) return reject("rejected_price", payment);
  const priceKey = provider.priceKeyFor(payment.priceRefs[0] as string);
  const purchase = priceKey ? purchaseForPriceKey(priceKey) : undefined;
  if (!purchase) return reject("rejected_price", payment);
  if (purchase.plan !== targetPlan) return reject("rejected_mismatch", payment);

  if (payment.currency !== PRICING_CURRENCY) return reject("rejected_currency", payment);
  if (payment.amountMinor !== expectedPurchaseAmountMinor(purchase)) return reject("rejected_amount", payment);

  const event = await ops.findEvent(eventId);
  if (!event) return reject("rejected_event", payment);
  if (event.ownerId !== userId) return reject("rejected_owner", payment);
  if (payment.providerCustomerId) {
    const customerOwner = await ops.findCustomerUserId(provider.id, payment.providerCustomerId);
    if (customerOwner && customerOwner !== userId) return reject("rejected_owner", payment);
  }

  const existing = await ops.findPurchaseBySession(provider.id, payment.checkoutSessionId);
  if (existing) {
    if (existing.eventId !== eventId || existing.userId !== userId || existing.plan !== purchase.plan || existing.kind !== purchase.kind) return reject("rejected_mismatch", payment);
    if (existing.status === "PAID") return "already_paid";
  }

  const purchases = await ops.listPurchases(eventId);
  if (purchase.kind === "UPGRADE" && !planIncludes(getEffectiveEventPlan(purchases), purchase.from)) return reject("rejected_upgrade", payment);

  const accessEndsAt = computePaidAccessEnd({ startsAt: event.startsAt, paidAt, currentEnd: event.paidAccessEndsAt });
  await ops.savePurchase({
    eventId,
    userId,
    provider: provider.id,
    checkoutSessionId: payment.checkoutSessionId,
    paymentIntentId: payment.paymentIntentId,
    plan: purchase.plan,
    kind: purchase.kind,
    status: "PAID",
    amount: payment.amountMinor,
    currency: payment.currency,
    paidAt,
    accessStartsAt: paidAt,
    accessEndsAt,
  });
  await ops.setPaidAccessEnd(eventId, accessEndsAt);
  return "granted";
}

/**
 * Un pago que NO se completó (falló o caducó): la compra pendiente pasa a `FAILED` / `CANCELED`. Nunca toca una compra `PAID` y
 * nunca concede nada: el evento conserva su plan actual.
 */
export async function closePayment(
  ops: BillingWriteOps,
  providerId: BillingProvider["id"],
  input: { outcome: "FAILED" | "CANCELED"; checkoutSessionId?: string; paymentIntentId?: string; metadata?: { eventId?: string; targetPlan?: string } },
): Promise<"closed" | "noop"> {
  if (input.checkoutSessionId) {
    const purchase = await ops.findPurchaseBySession(providerId, input.checkoutSessionId);
    if (!purchase || purchase.status !== "PENDING") return "noop";
    await ops.setPurchaseStatus(purchase.id, input.outcome);
    return "closed";
  }
  // Un intento fallido dentro de una sesión aún abierta: se marca la compra pendiente más reciente de ese evento y plan. Si la sesión
  // termina pagándose después, la confirmación la pasa a `PAID` (el historial refleja el intento).
  const { eventId, targetPlan } = input.metadata ?? {};
  if (!eventId || !isPaidPlanId(targetPlan)) return "noop";
  const pending = (await ops.listPurchases(eventId)).filter((purchase) => purchase.status === "PENDING" && purchase.plan === targetPlan).at(-1);
  if (!pending) return "noop";
  await ops.setPurchaseStatus(pending.id, input.outcome);
  return "closed";
}

/** Un reembolso TOTAL retira el plan que concedía esa compra: pasa a `REFUNDED` (el plan del evento se recalcula de las demás). */
export async function refundPayment(ops: BillingWriteOps, providerId: BillingProvider["id"], paymentIntentId: string): Promise<"refunded" | "noop"> {
  const paid = (await ops.findPurchasesByIntent(providerId, paymentIntentId)).filter((purchase) => purchase.status === "PAID");
  if (paid.length === 0) return "noop";
  for (const purchase of paid) await ops.setPurchaseStatus(purchase.id, "REFUNDED");
  return "refunded";
}
