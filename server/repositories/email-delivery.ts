import type { PlanId } from "@/lib/billing/plans";
import type { BillingProviderId, PurchaseKindId, PurchaseStatusId } from "@/lib/billing/purchase";
import type { EmailDeliveryKindId, EmailDeliveryStatusId } from "@/lib/email/delivery";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError, uniqueViolationFields } from "@/server/db/errors";

/**
 * PERSISTENCIA DEL CORREO TRANSACCIONAL (D-36). Único módulo que importa Prisma para `server/email/*`. Reglas:
 *  - El destinatario se resuelve SIEMPRE aquí, del lado del servidor (`User.email`), nunca del payload del invitado o del
 *    navegador (encargo punto 35/8).
 *  - `createEmailDeliveryAttempt` es la única forma de abrir un envío: inserta una fila `PENDING`. Para
 *    `PURCHASE_CONFIRMATION`/`UPGRADE_CONFIRMATION` la restricción única `(kind, purchaseId)` hace que una segunda llamada para
 *    la MISMA compra devuelva `"duplicate"` sin crear nada (idempotencia ante webhooks repetidos).
 *  - Nunca se guarda el asunto ni el cuerpo del correo, ni la clave del proveedor.
 */
function requireDatabase(): void {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
}

// ───────── Contexto para construir el correo (siempre resuelto en el servidor) ─────────

export interface EventOwnerContext {
  eventId: string;
  eventTitle: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string | null;
}

/** Evento + su propietario (para las confirmaciones de compra/mejora). `null` si el evento no existe. */
export async function resolveEventOwnerContext(eventId: string): Promise<EventOwnerContext | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, owner: { select: { id: true, email: true, name: true } } } });
  if (!row) return null;
  return { eventId: row.id, eventTitle: row.title, ownerId: row.owner.id, ownerEmail: row.owner.email, ownerName: row.owner.name };
}

export interface GuestRsvpContext extends EventOwnerContext {
  guestName: string;
}

/** Evento + propietario + nombre VISIBLE del invitado (para la notificación de RSVP). `null` si el invitado ya no existe en ese evento. */
export async function resolveGuestRsvpContext(eventId: string, guestId: string): Promise<GuestRsvpContext | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.guest.findFirst({ where: { id: guestId, eventId }, select: { name: true, event: { select: { id: true, title: true, owner: { select: { id: true, email: true, name: true } } } } } });
  if (!row) return null;
  return { eventId: row.event.id, eventTitle: row.event.title, ownerId: row.event.owner.id, ownerEmail: row.event.owner.email, ownerName: row.event.owner.name, guestName: row.name };
}

/** Id interno (`EventPurchase.id`) de la compra confirmada, a partir de su sesión de cobro (para enlazarla al correo). */
export async function findPurchaseIdBySession(provider: BillingProviderId, checkoutSessionId: string): Promise<string | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.eventPurchase.findUnique({ where: { provider_providerCheckoutSessionId: { provider, providerCheckoutSessionId: checkoutSessionId } }, select: { id: true } });
  return row?.id ?? null;
}

// ───────── Envíos ─────────

export interface CreateDeliveryInput {
  kind: EmailDeliveryKindId;
  recipientUserId: string;
  eventId?: string;
  purchaseId?: string;
  rsvpId?: string;
}

export type CreateDeliveryResult = { status: "created"; id: string } | { status: "duplicate" };

/** Abre un intento de envío (`PENDING`). Ver la nota de idempotencia arriba. */
export async function createEmailDeliveryAttempt(input: CreateDeliveryInput): Promise<CreateDeliveryResult> {
  requireDatabase();
  try {
    const row = await prisma.emailDelivery.create({
      data: { kind: input.kind, recipientUserId: input.recipientUserId, eventId: input.eventId, purchaseId: input.purchaseId, rsvpId: input.rsvpId, status: "PENDING", attemptedAt: new Date() },
      select: { id: true },
    });
    return { status: "created", id: row.id };
  } catch (error) {
    if (uniqueViolationFields(error)) return { status: "duplicate" };
    throw error;
  }
}

export async function markEmailDeliverySent(id: string, providerMessageId: string): Promise<void> {
  requireDatabase();
  await prisma.emailDelivery.update({ where: { id }, data: { status: "SENT", providerMessageId, sentAt: new Date() } });
}

export async function markEmailDeliveryFailed(id: string, errorCode: string): Promise<void> {
  requireDatabase();
  await prisma.emailDelivery.update({ where: { id }, data: { status: "FAILED", errorCode: errorCode.slice(0, 100) } });
}

export async function markEmailDeliverySkipped(id: string, reasonCode: string): Promise<void> {
  requireDatabase();
  await prisma.emailDelivery.update({ where: { id }, data: { status: "SKIPPED", errorCode: reasonCode.slice(0, 100) } });
}

/** Fila `FAILED` para un posible reintento (`retryFailedEmailDelivery`, servicio preparado, sin interfaz — ver `docs/EMAIL.md`). */
export async function findFailedEmailDelivery(id: string): Promise<{ id: string; kind: EmailDeliveryKindId; recipientUserId: string; eventId: string | null; purchaseId: string | null; rsvpId: string | null; status: EmailDeliveryStatusId } | null> {
  if (getDataSource() === "demo") return null;
  return prisma.emailDelivery.findFirst({ where: { id, status: "FAILED" }, select: { id: true, kind: true, recipientUserId: true, eventId: true, purchaseId: true, rsvpId: true, status: true } });
}

/** Vuelve a abrir una fila `FAILED` para reintentarla (misma fila, no una nueva: conserva la idempotencia por `(kind, purchaseId)`). */
export async function reopenEmailDeliveryForRetry(id: string): Promise<void> {
  requireDatabase();
  await prisma.emailDelivery.update({ where: { id }, data: { status: "PENDING", attemptedAt: new Date(), errorCode: null } });
}

export interface PurchaseForRetry {
  eventId: string;
  provider: BillingProviderId;
  checkoutSessionId: string;
  plan: PlanId;
  kind: PurchaseKindId;
  amount: number;
  currency: string;
  paidAt: Date | null;
  accessEndsAt: Date | null;
  status: PurchaseStatusId;
}

/** Datos ACTUALES de la compra (para reconstruir el correo al reintentar: nunca se guardó el original). */
export async function findPurchaseForRetry(purchaseId: string): Promise<PurchaseForRetry | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.eventPurchase.findUnique({
    where: { id: purchaseId },
    select: { eventId: true, provider: true, providerCheckoutSessionId: true, plan: true, kind: true, amount: true, currency: true, paidAt: true, accessEndsAt: true, status: true },
  });
  if (!row) return null;
  return { eventId: row.eventId, provider: row.provider, checkoutSessionId: row.providerCheckoutSessionId, plan: row.plan, kind: row.kind, amount: row.amount, currency: row.currency, paidAt: row.paidAt, accessEndsAt: row.accessEndsAt, status: row.status };
}

// ───────── Consola (D-33): solo lectura, DTO mínimo ─────────

export interface AdminEmailDeliveryQuery {
  status?: EmailDeliveryStatusId | undefined;
  kind?: EmailDeliveryKindId | undefined;
  skip: number;
  take: number;
}

export interface AdminEmailDeliveryRow {
  id: string;
  kind: EmailDeliveryKindId;
  status: EmailDeliveryStatusId;
  recipient: { id: string; email: string; name: string | null };
  eventId: string | null;
  errorCode: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

const whereFor = (query: Pick<AdminEmailDeliveryQuery, "status" | "kind">) => ({ ...(query.status ? { status: query.status } : {}), ...(query.kind ? { kind: query.kind } : {}) });

export async function countAdminEmailDeliveries(query: Pick<AdminEmailDeliveryQuery, "status" | "kind">): Promise<number> {
  requireDatabase();
  return prisma.emailDelivery.count({ where: whereFor(query) });
}

export async function listAdminEmailDeliveries(query: AdminEmailDeliveryQuery): Promise<AdminEmailDeliveryRow[]> {
  requireDatabase();
  return prisma.emailDelivery.findMany({
    where: whereFor(query),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: query.skip,
    take: query.take,
    select: { id: true, kind: true, status: true, eventId: true, errorCode: true, createdAt: true, sentAt: true, recipient: { select: { id: true, email: true, name: true } } },
  });
}
