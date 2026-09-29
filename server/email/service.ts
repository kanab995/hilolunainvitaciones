import { planLabel, type PaidPlanId } from "@/lib/billing/plans";
import type { BillingProviderId } from "@/lib/billing/purchase";
import type { EmailDeliveryKindId } from "@/lib/email/delivery";
import { routes } from "@/lib/routes";
import { getSiteUrl } from "@/lib/site-url";
import { getEmailProviderState } from "@/server/email/index";
import { logger } from "@/server/observability/logger";
import { isRecipientAllowedInStaging, withStagingSubjectPrefix } from "@/server/email/staging-safety";
import type { EmailProviderState } from "@/server/email/provider";
import {
  purchaseConfirmationEmail,
  rsvpNotificationEmail,
  upgradeConfirmationEmail,
  type EmailContent,
  type RsvpNotificationStatus,
} from "@/server/email/templates";
import {
  createEmailDeliveryAttempt,
  findFailedEmailDelivery,
  findPurchaseForRetry,
  findPurchaseIdBySession,
  markEmailDeliveryFailed,
  markEmailDeliverySent,
  markEmailDeliverySkipped,
  reopenEmailDeliveryForRetry,
  resolveEventOwnerContext,
  resolveGuestRsvpContext,
  type CreateDeliveryResult,
  type EventOwnerContext,
  type GuestRsvpContext,
  type PurchaseForRetry,
} from "@/server/repositories/email-delivery";

/**
 * SERVICIO DE DOMINIO DEL CORREO TRANSACCIONAL (D-36). Orquesta: resolver destinatario (siempre en el servidor), idempotencia
 * (`EmailDelivery`), seguridad de staging, plantilla y proveedor. Ningún llamador (RSVP público, webhook de Stripe) importa
 * `server/email/provider.ts` ni el SDK de Resend directamente: solo estas funciones. Dependencias inyectables con valores por
 * defecto reales (mismo patrón que `server/services/billing-service.ts` y `server/services/media-cleanup.ts`): las pruebas
 * pasan dobles, sin tocar Prisma ni el proveedor de correo.
 *
 * GARANTÍA PRINCIPAL: nada de aquí lanza hacia quien la llama. Un fallo de plantilla, de proveedor o de temporización se
 * registra y la función vuelve sin excepción — quien la invoca (guardado del RSVP, webhook ya confirmado) nunca debe
 * deshacerse por un correo.
 */
export interface EmailServiceDeps {
  getProviderState: () => EmailProviderState;
  resolveGuestRsvpContext: (eventId: string, guestId: string) => Promise<GuestRsvpContext | null>;
  resolveEventOwnerContext: (eventId: string) => Promise<EventOwnerContext | null>;
  findPurchaseIdBySession: (provider: BillingProviderId, checkoutSessionId: string) => Promise<string | null>;
  createEmailDeliveryAttempt: typeof createEmailDeliveryAttempt;
  markEmailDeliverySent: (id: string, providerMessageId: string) => Promise<void>;
  markEmailDeliveryFailed: (id: string, errorCode: string) => Promise<void>;
  markEmailDeliverySkipped: (id: string, reasonCode: string) => Promise<void>;
  findFailedEmailDelivery: (id: string) => ReturnType<typeof findFailedEmailDelivery>;
  findPurchaseForRetry: (purchaseId: string) => Promise<PurchaseForRetry | null>;
  reopenEmailDeliveryForRetry: (id: string) => Promise<void>;
  isRecipientAllowedInStaging: (email: string) => boolean;
  withStagingSubjectPrefix: (subject: string) => string;
  siteUrl: () => string;
}

const defaultDeps: EmailServiceDeps = {
  getProviderState: () => getEmailProviderState(),
  resolveGuestRsvpContext,
  resolveEventOwnerContext,
  findPurchaseIdBySession,
  createEmailDeliveryAttempt,
  markEmailDeliverySent,
  markEmailDeliveryFailed,
  markEmailDeliverySkipped,
  findFailedEmailDelivery,
  findPurchaseForRetry,
  reopenEmailDeliveryForRetry,
  isRecipientAllowedInStaging: (email) => isRecipientAllowedInStaging(process.env, email),
  withStagingSubjectPrefix: (subject) => withStagingSubjectPrefix(process.env, subject),
  siteUrl: getSiteUrl,
};

const EMAIL_SEND_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("Tiempo de espera del envío agotado."), { name: "EmailTimeoutError" })), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const errorCodeOf = (error: unknown): string => (typeof error === "object" && error !== null && "name" in error && typeof (error as { name?: unknown }).name === "string" ? (error as { name: string }).name : "unknown_error");

/** Resuelve proveedor + seguridad de staging y envía. NO crea la fila (`deliver`/`retryFailedEmailDelivery` ya la tienen abierta). */
async function attemptSend(deps: EmailServiceDeps, params: { id: string; kind: EmailDeliveryKindId; recipientEmail: string; content: EmailContent; eventId?: string }): Promise<void> {
  const state = deps.getProviderState();
  if (state.status !== "ready") {
    const reason = state.status === "invalid" ? "invalid_config" : "not_configured";
    await deps.markEmailDeliverySkipped(params.id, reason);
    logger.warn("email.skipped", { kind: params.kind, deliveryId: params.id, eventId: params.eventId, reason });
    return;
  }
  if (!deps.isRecipientAllowedInStaging(params.recipientEmail)) {
    await deps.markEmailDeliverySkipped(params.id, "staging_not_allowlisted");
    logger.warn("email.skipped", { kind: params.kind, deliveryId: params.id, eventId: params.eventId, reason: "staging_not_allowlisted" });
    return;
  }
  try {
    const result = await withTimeout(
      state.provider.send({ to: params.recipientEmail, subject: deps.withStagingSubjectPrefix(params.content.subject), html: params.content.html, text: params.content.text }),
      EMAIL_SEND_TIMEOUT_MS,
    );
    if (result.ok) {
      await deps.markEmailDeliverySent(params.id, result.providerMessageId);
      logger.info("email.sent", { kind: params.kind, deliveryId: params.id, eventId: params.eventId });
    } else {
      await deps.markEmailDeliveryFailed(params.id, result.errorCode);
      logger.warn("email.failed", { kind: params.kind, deliveryId: params.id, eventId: params.eventId, errorCode: result.errorCode });
    }
  } catch (error) {
    await deps.markEmailDeliveryFailed(params.id, errorCodeOf(error)).catch(() => undefined);
    logger.error("email.failed", error, { kind: params.kind, deliveryId: params.id, eventId: params.eventId });
  }
}

/** Abre la fila de idempotencia y, si no era un duplicado, envía. */
async function deliver(deps: EmailServiceDeps, params: { kind: EmailDeliveryKindId; recipientUserId: string; recipientEmail: string; eventId?: string; purchaseId?: string; rsvpId?: string; content: EmailContent }): Promise<CreateDeliveryResult["status"]> {
  const attempt = await deps.createEmailDeliveryAttempt({ kind: params.kind, recipientUserId: params.recipientUserId, eventId: params.eventId, purchaseId: params.purchaseId, rsvpId: params.rsvpId });
  if (attempt.status === "duplicate") {
    logger.info("email.skipped", { kind: params.kind, eventId: params.eventId, reason: "duplicate" });
    return "duplicate";
  }
  await attemptSend(deps, { id: attempt.id, kind: params.kind, recipientEmail: params.recipientEmail, content: params.content, eventId: params.eventId });
  return "created";
}

// ───────── 1. Notificación de RSVP al anfitrión ─────────

export interface RsvpNotificationTrigger {
  eventId: string;
  guestId: string;
  status: RsvpNotificationStatus;
  attendeeCount: number | null;
}

/**
 * Se llama SOLO si la respuesta CAMBIÓ (estado o número de asistentes: la comprobación vive en `server/services/public-rsvp.ts`,
 * punto 12 del encargo). Nunca hace fallar el RSVP: cualquier error se registra y la función vuelve sin lanzar.
 */
export async function sendRsvpNotification(input: RsvpNotificationTrigger, deps: EmailServiceDeps = defaultDeps): Promise<void> {
  try {
    const context = await deps.resolveGuestRsvpContext(input.eventId, input.guestId);
    if (!context) return; // el invitado ya no existe en ese evento (carrera con un borrado): nadie a quien avisar.
    const content = rsvpNotificationEmail({
      eventTitle: context.eventTitle,
      eventUrl: `${deps.siteUrl()}${routes.eventGuests(context.eventId)}`,
      guestName: context.guestName,
      status: input.status,
      attendeeCount: input.attendeeCount,
    });
    await deliver(deps, { kind: "RSVP_NOTIFICATION", recipientUserId: context.ownerId, recipientEmail: context.ownerEmail, eventId: context.eventId, content });
  } catch (error) {
    logger.error("email.rsvp_notification_failed", error, { eventId: input.eventId });
  }
}

// ───────── 2 y 3. Confirmación de compra / mejora ─────────

export interface PurchaseEmailTrigger {
  eventId: string;
  provider: BillingProviderId;
  checkoutSessionId: string;
  plan: PaidPlanId;
  amountMinor: number;
  currency: string;
  paidAt: Date;
  accessEndsAt: Date | null;
}

/** Se llama SOLO tras `confirmPayment` → `"granted"` (compra recién confirmada de verdad, nunca desde la URL de éxito del checkout). */
async function sendPurchaseEmail(kind: Extract<EmailDeliveryKindId, "PURCHASE_CONFIRMATION" | "UPGRADE_CONFIRMATION">, input: PurchaseEmailTrigger, deps: EmailServiceDeps): Promise<void> {
  try {
    const context = await deps.resolveEventOwnerContext(input.eventId);
    if (!context) return;
    const purchaseId = await deps.findPurchaseIdBySession(input.provider, input.checkoutSessionId);
    if (!purchaseId) return; // no debería ocurrir: se llama justo después de confirmar esa misma compra.
    const eventUrl = `${deps.siteUrl()}${routes.event(context.eventId)}`;
    const amount = input.amountMinor / 100;
    const content =
      kind === "PURCHASE_CONFIRMATION"
        ? purchaseConfirmationEmail({ eventTitle: context.eventTitle, eventUrl, planName: planLabel(input.plan), amount, currency: input.currency, paidAt: input.paidAt, accessEndsAt: input.accessEndsAt })
        : upgradeConfirmationEmail({ eventTitle: context.eventTitle, eventUrl, amount, currency: input.currency, paidAt: input.paidAt, accessEndsAt: input.accessEndsAt });
    await deliver(deps, { kind, recipientUserId: context.ownerId, recipientEmail: context.ownerEmail, eventId: context.eventId, purchaseId, content });
  } catch (error) {
    logger.error("email.purchase_email_failed", error, { eventId: input.eventId, kind });
  }
}

export const sendPurchaseConfirmation = (input: PurchaseEmailTrigger, deps: EmailServiceDeps = defaultDeps): Promise<void> => sendPurchaseEmail("PURCHASE_CONFIRMATION", input, deps);
export const sendUpgradeConfirmation = (input: PurchaseEmailTrigger, deps: EmailServiceDeps = defaultDeps): Promise<void> => sendPurchaseEmail("UPGRADE_CONFIRMATION", input, deps);

// ───────── Reintento manual (preparado, SIN interfaz — docs/EMAIL.md) ─────────

export type RetryEmailResult = "retried" | "not_found" | "unsupported" | "not_paid";

/**
 * Reintenta una fila `FAILED`, reconstruyendo el contenido a partir de los datos ACTUALES (nunca se guardó el original).
 * Solo cubre `PURCHASE_CONFIRMATION`/`UPGRADE_CONFIRMATION` (el caso con más impacto y con toda la información necesaria en
 * `EventPurchase`); `RSVP_NOTIFICATION` responde `"unsupported"` — ver la decisión en `docs/EMAIL.md` §7. Sin interfaz de
 * administración por decisión (CLAUDE.md: la consola es de solo lectura salvo los dos campos de plantilla): `requireAdmin()`
 * la llamaría si en el futuro se decide exponerla.
 */
export async function retryFailedEmailDelivery(deliveryId: string, deps: EmailServiceDeps = defaultDeps): Promise<RetryEmailResult> {
  const failed = await deps.findFailedEmailDelivery(deliveryId);
  if (!failed) return "not_found";
  if (!failed.purchaseId || (failed.kind !== "PURCHASE_CONFIRMATION" && failed.kind !== "UPGRADE_CONFIRMATION")) return "unsupported";

  const purchase = await deps.findPurchaseForRetry(failed.purchaseId);
  if (!purchase || purchase.status !== "PAID" || !purchase.paidAt) return "not_paid";
  const context = await deps.resolveEventOwnerContext(purchase.eventId);
  if (!context) return "not_found";

  await deps.reopenEmailDeliveryForRetry(deliveryId);
  const eventUrl = `${deps.siteUrl()}${routes.event(context.eventId)}`;
  const amount = purchase.amount / 100;
  const content =
    failed.kind === "PURCHASE_CONFIRMATION"
      ? purchaseConfirmationEmail({ eventTitle: context.eventTitle, eventUrl, planName: planLabel(purchase.plan), amount, currency: purchase.currency, paidAt: purchase.paidAt, accessEndsAt: purchase.accessEndsAt })
      : upgradeConfirmationEmail({ eventTitle: context.eventTitle, eventUrl, amount, currency: purchase.currency, paidAt: purchase.paidAt, accessEndsAt: purchase.accessEndsAt });
  await attemptSend(deps, { id: deliveryId, kind: failed.kind, recipientEmail: context.ownerEmail, content, eventId: context.eventId });
  return "retried";
}
