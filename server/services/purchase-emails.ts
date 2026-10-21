import type { BillingProviderId } from "@/lib/billing/purchase";
import { runAfterResponse } from "@/server/email/run-after";
import { sendPurchaseConfirmation, sendUpgradeConfirmation } from "@/server/email/service";
import type { GrantedPurchase } from "@/server/services/purchase-sync";

/**
 * Correo de confirmación de una compra de PLAN recién concedida (D-36), DESPUÉS de la respuesta. Lo llaman los dos caminos que conceden un
 * plan: el webhook y la reconciliación del regreso del pago (`?payment=success`). Quien concede primero envía; el otro ve `already_paid` y no
 * dispara nada, y aunque disparara, `EmailDelivery` `(kind, purchaseId)` impide un segundo correo. Solo ids y datos de la compra cruzan a
 * `after()`: nunca el proveedor con su SDK.
 */
export function notifyGrantedPurchase(provider: BillingProviderId, purchase: GrantedPurchase): void {
  runAfterResponse(() =>
    (purchase.kind === "UPGRADE" ? sendUpgradeConfirmation : sendPurchaseConfirmation)({
      eventId: purchase.eventId,
      provider,
      checkoutSessionId: purchase.checkoutSessionId,
      plan: purchase.plan,
      amountMinor: purchase.amountMinor,
      currency: purchase.currency,
      paidAt: purchase.paidAt,
      accessEndsAt: purchase.accessEndsAt,
    }),
  );
}
