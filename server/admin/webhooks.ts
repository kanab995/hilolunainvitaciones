import { maskExternalId } from "@/lib/admin/mask";
import { pageWindow } from "@/lib/admin/query";
import type { AdminPageDto, AdminWebhookDto } from "@/server/admin/dto";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * WEBHOOKS EN LA CONSOLA (D-33): eventos del proveedor de pagos ya PROCESADOS. La tabla solo guarda proveedor, id del evento, tipo y fecha:
 * nunca el cuerpo ni la firma (no existen en la base de datos), y el id externo se muestra enmascarado. Los eventos ignorados o con
 * error no se registran (el modelo de datos no lo permite), así que todo lo listado es «Procesado».
 */
export async function listAdminWebhookEvents(_admin: AdminUser, filters: { page: number; q?: string | undefined; pageSize?: number }): Promise<AdminPageDto<AdminWebhookDto>> {
  const { page, pageSize, ...where } = filters;
  const total = await repo.countWebhookEvents(where);
  const window = pageWindow(page, total, pageSize);
  const rows = await repo.listWebhookEvents({ ...where, skip: window.skip, take: window.take });
  return { rows: rows.map((row) => ({ id: row.id, provider: row.provider, maskedExternalEventId: maskExternalId(row.externalEventId), type: row.type, processedAt: row.processedAt })), window };
}
