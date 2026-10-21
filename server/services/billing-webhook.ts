import { getBillingProviderState } from "@/server/billing";
import { WebhookSignatureError, type BillingProviderState, type NormalizedWebhookEvent, type ProviderPayment } from "@/server/billing/provider";
import { isTransientDatabaseError, StoreUnavailableError } from "@/server/db/errors";
import { sendPrintAddonConfirmation } from "@/server/email/service";
import { runAfterResponse } from "@/server/email/run-after";
import { prismaBillingStore, type BillingStore } from "@/server/repositories/billing";
import { closeAddonPayment, confirmAddonPayment, isAddonPayment, refundAddonPayment } from "@/server/services/addon-sync";
import { notifyGrantedPurchase } from "@/server/services/purchase-emails";
import { closePayment, confirmPayment, refundPayment, type GrantedPurchase } from "@/server/services/purchase-sync";
import { logger } from "@/server/observability/logger";

/**
 * WEBHOOK DE FACTURACIÓN (D-32: pago único por evento) — la FUENTE DE VERDAD de las compras. No usa Clerk: la autenticación es la
 * firma del proveedor. Orden fijo:
 *  1. ¿hay pagos configurados? (si no, 503: el proveedor reintentará cuando lo estén)
 *  2. verificar la firma sobre el cuerpo CRUDO (firma inválida o ausente → 400 y no se procesa nada)
 *  3. normalizar; los tipos que no se usan (incluidos los `customer.subscription.*` del modelo anterior) responden 200 sin más
 *     y NO conceden nada
 *  4. para confirmar un pago se consulta el estado REAL del pago al proveedor ANTES de abrir la transacción (el evento es solo el
 *     aviso; la metadata nunca basta)
 *  5. UNA transacción: registrar el evento (idempotencia) + aplicar la compra tras verificarla (`purchase-sync` para planes, `addon-sync`
 *     para complementos, D-48: la ruta la decide el PRECIO cobrado; un pago de complemento jamás pasa por la lógica de planes). Un evento repetido
 *     no se aplica dos veces; si aplicar falla, la transacción se revierte, el evento no queda registrado y el proveedor reintenta (500).
 * Nunca se registran cuerpos ni datos de pago: solo el tipo y el id del evento.
 */
export interface BillingWebhookDeps {
  getProviderState: () => BillingProviderState;
  store: BillingStore;
}

const defaultDeps: BillingWebhookDeps = { getProviderState: getBillingProviderState, store: prismaBillingStore };

export interface WebhookResponse {
  status: 200 | 400 | 500 | 503;
  body: { received?: boolean; duplicate?: boolean; ignored?: boolean; error?: string };
}

export async function handleBillingWebhook(input: { rawBody: string; signature: string | null }, deps: BillingWebhookDeps = defaultDeps): Promise<WebhookResponse> {
  const state = deps.getProviderState();
  if (state.status !== "ready") return { status: 503, body: { error: "billing_not_configured" } };
  const { provider } = state;

  let event: NormalizedWebhookEvent;
  try {
    event = provider.parseWebhook(input.rawBody, input.signature);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return { status: 400, body: { error: "invalid_signature" } };
    logger.error("billing.webhook_unreadable", error);
    return { status: 400, body: { error: "invalid_payload" } };
  }

  if (event.action === "ignore") return { status: 200, body: { received: true, ignored: true } };

  try {
    // Confirmar un pago: se lee su estado REAL (importe, moneda, precio, estado de cobro) antes de tocar la base de datos.
    let payment: ProviderPayment | undefined;
    if (event.action === "confirm_payment") {
      payment = event.checkoutSessionId ? await provider.getPayment(event.checkoutSessionId) : event.paymentIntentId ? await provider.findPaymentByIntent(event.paymentIntentId) : undefined;
    }

    // Se rellena SOLO si `confirmPayment` concede el plan de verdad (nunca en `already_paid` ni en un webhook repetido): dispara el
    // correo de confirmación DESPUÉS de que la transacción de abajo haya confirmado (D-36). `provider.id` se captura aparte: `provider`
    // (con el SDK) no debe cruzar a `after()`.
    let granted: GrantedPurchase | undefined;
    // Complemento confirmado (recién concedido, o ya pagado por la reconciliación del regreso del pago): su correo es idempotente por compra.
    let addonConfirmed: { eventId: string; checkoutSessionId: string } | undefined;
    const providerId = provider.id;

    const result = await deps.store.recordEventAndApply({ provider: provider.id, externalEventId: event.id, type: event.type }, async (ops) => {
      if (event.action === "confirm_payment") {
        if (payment && isAddonPayment(provider, payment)) {
          const outcome = await confirmAddonPayment(ops, provider, payment, event.createdAt);
          if ((outcome === "granted" || outcome === "already_paid") && payment.metadata.eventId) addonConfirmed = { eventId: payment.metadata.eventId, checkoutSessionId: payment.checkoutSessionId };
        }
        else if (payment) await confirmPayment(ops, provider, payment, event.createdAt, (info) => (granted = info));
      } else if (event.action === "close_payment") {
        // La sesión es de un plan O de un complemento: cada cierre es «noop» si no es suyo.
        await closePayment(ops, provider.id, { outcome: event.outcome, checkoutSessionId: event.checkoutSessionId, paymentIntentId: event.paymentIntentId, metadata: event.metadata });
        await closeAddonPayment(ops.addons, provider.id, { outcome: event.outcome, checkoutSessionId: event.checkoutSessionId, metadata: event.metadata });
      } else if (event.action === "refund_payment") {
        await refundPayment(ops, provider.id, event.paymentIntentId);
        await refundAddonPayment(ops.addons, provider.id, event.paymentIntentId, event.createdAt);
      }
    });

    if (granted) notifyGrantedPurchase(providerId, granted);
    if (addonConfirmed && result !== "duplicate") {
      const confirmed = addonConfirmed;
      runAfterResponse(() => sendPrintAddonConfirmation({ eventId: confirmed.eventId, provider: providerId, checkoutSessionId: confirmed.checkoutSessionId }));
    }
    return { status: 200, body: { received: true, ...(result === "duplicate" ? { duplicate: true } : {}) } };
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { status: 503, body: { error: "store_unavailable" } };
    // Fallo TEMPORAL de la base de datos: 503 (Stripe reintenta con retroceso). Nada quedó registrado: la transacción se revirtió.
    if (isTransientDatabaseError(error)) {
      logger.warn("billing.webhook_transient_failure", { type: event.type, error: (error as { code?: string }).code ?? "db" });
      return { status: 503, body: { error: "temporarily_unavailable" } };
    }
    // Solo el tipo del error y del evento: nunca el cuerpo ni datos del cliente.
    logger.error("billing.webhook_failed", error, { type: event.type });
    return { status: 500, body: { error: "processing_failed" } };
  }
}
