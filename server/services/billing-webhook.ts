import { getBillingProviderState } from "@/server/billing";
import { WebhookSignatureError, type BillingProviderState, type NormalizedWebhookEvent, type ProviderPayment } from "@/server/billing/provider";
import { isTransientDatabaseError, StoreUnavailableError } from "@/server/db/errors";
import { prismaBillingStore, type BillingStore } from "@/server/repositories/billing";
import { closePayment, confirmPayment, refundPayment } from "@/server/services/purchase-sync";
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
 *  5. UNA transacción: registrar el evento (idempotencia) + aplicar la compra tras verificarla (`purchase-sync`). Un evento repetido
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

    const result = await deps.store.recordEventAndApply({ provider: provider.id, externalEventId: event.id, type: event.type }, async (ops) => {
      if (event.action === "confirm_payment") {
        if (payment) await confirmPayment(ops, provider, payment, event.createdAt);
      } else if (event.action === "close_payment") {
        await closePayment(ops, provider.id, { outcome: event.outcome, checkoutSessionId: event.checkoutSessionId, paymentIntentId: event.paymentIntentId, metadata: event.metadata });
      } else if (event.action === "refund_payment") {
        await refundPayment(ops, provider.id, event.paymentIntentId);
      }
    });
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
