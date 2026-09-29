import { maskEmail } from "@/lib/admin/mask";
import { pageWindow } from "@/lib/admin/query";
import type { EmailDeliveryKindId, EmailDeliveryStatusId } from "@/lib/email/delivery";
import type { AdminEmailDeliveryDto, AdminPageDto } from "@/server/admin/dto";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/email-delivery";

/**
 * CORREO TRANSACCIONAL EN LA CONSOLA (D-36): solo lectura, como `/admin/webhooks` y `/admin/purchases` (CLAUDE.md: la consola es
 * de solo lectura salvo `Template.publicationStatus`/`Template.minimumPlan`; no se añade aquí un botón de reenvío — ver la
 * decisión en `docs/EMAIL.md` §Reintentos). El destinatario sale SIEMPRE enmascarado; nunca se lee el asunto ni el cuerpo
 * (no se guardan). El id del evento no se resuelve a título aquí a propósito: mantiene esta lectura mínima y sin joins extra.
 */
export async function listAdminEmailDeliveries(_admin: AdminUser, filters: { page: number; status?: EmailDeliveryStatusId | undefined; kind?: EmailDeliveryKindId | undefined; pageSize?: number }): Promise<AdminPageDto<AdminEmailDeliveryDto>> {
  const { page, pageSize, ...where } = filters;
  const total = await repo.countAdminEmailDeliveries(where);
  const window = pageWindow(page, total, pageSize);
  const rows = await repo.listAdminEmailDeliveries({ ...where, skip: window.skip, take: window.take });
  return {
    rows: rows.map((row) => ({ id: row.id, kind: row.kind, status: row.status, maskedRecipient: maskEmail(row.recipient.email), eventId: row.eventId, errorCode: row.errorCode, createdAt: row.createdAt, sentAt: row.sentAt })),
    window,
  };
}
