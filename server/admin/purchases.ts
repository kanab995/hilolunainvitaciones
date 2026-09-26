import { maskExternalId } from "@/lib/admin/mask";
import { pageWindow } from "@/lib/admin/query";
import type { PlanId } from "@/lib/billing/plans";
import type { PurchaseKindId, PurchaseStatusId } from "@/lib/billing/purchase";
import type { AdminPageDto, AdminPurchaseDetailDto, AdminPurchaseLineDto, AdminPurchaseListItemDto } from "@/server/admin/dto";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * COMPRAS EN LA CONSOLA (D-33): SOLO LECTURA. La consola no marca compras como pagadas, no concede planes, no reembolsa ni cambia
 * importes ni monedas: el proveedor de pagos y su webhook verificado son la autoridad. Aquí no existe ninguna función de escritura.
 */
export const toPurchaseLine = (row: repo.AdminPurchaseLine): AdminPurchaseLineDto => ({
  id: row.id,
  kind: row.kind,
  plan: row.plan,
  status: row.status,
  amountMinor: row.amount,
  currency: row.currency,
  provider: row.provider,
  createdAt: row.createdAt,
  paidAt: row.paidAt,
});

export const toPurchaseListItem = (row: repo.AdminPurchaseRow): AdminPurchaseListItemDto => ({
  ...toPurchaseLine(row),
  event: { id: row.event.id, title: row.event.title },
  user: { id: row.user.id, name: row.user.name, email: row.user.email },
});

export interface PurchaseFilters {
  q?: string | undefined;
  status?: PurchaseStatusId | undefined;
  kind?: PurchaseKindId | undefined;
  plan?: PlanId | undefined;
  sort: repo.ListSort;
}

export async function listAdminPurchases(_admin: AdminUser, filters: PurchaseFilters & { page: number; pageSize?: number }): Promise<AdminPageDto<AdminPurchaseListItemDto>> {
  const { page, pageSize, ...where } = filters;
  const total = await repo.countPurchases(where);
  const window = pageWindow(page, total, pageSize);
  const rows = await repo.listPurchases({ ...where, skip: window.skip, take: window.take });
  return { rows: rows.map(toPurchaseListItem), window };
}

export async function getAdminPurchase(_admin: AdminUser, id: string): Promise<AdminPurchaseDetailDto | null> {
  const row = await repo.findPurchase(id);
  if (!row) return null;
  return {
    ...toPurchaseListItem(row),
    updatedAt: row.updatedAt,
    accessStartsAt: row.accessStartsAt,
    accessEndsAt: row.accessEndsAt,
    maskedCheckoutSessionId: maskExternalId(row.providerCheckoutSessionId),
    maskedPaymentIntentId: maskExternalId(row.providerPaymentIntentId),
    hasProviderCustomer: row.providerCustomerId !== null,
    maskedProviderCustomerId: maskExternalId(row.providerCustomerId),
    eventStartsAt: row.event.startsAt,
  };
}
