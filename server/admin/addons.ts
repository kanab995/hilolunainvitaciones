import { maskExternalId } from "@/lib/admin/mask";
import { pageWindow } from "@/lib/admin/query";
import type { PurchaseStatusId } from "@/lib/billing/purchase";
import type { AdminAddonPurchaseDetailDto, AdminAddonPurchaseLineDto, AdminAddonPurchaseListItemDto, AdminPageDto } from "@/server/admin/dto";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * COMPRAS DE COMPLEMENTOS EN LA CONSOLA (D-48): SOLO LECTURA, igual que las compras de planes y en su propia lista (nunca se mezclan con las
 * compras que determinan el plan). Sirve para consultar, detectar cobros duplicados, revisar reembolsos y localizar el evento. La consola no
 * reembolsa, no desbloquea ni marca pagos: el reembolso se hace en el panel de Stripe y llega por el webhook verificado
 * (`docs/BILLING.md` §13.6). Aquí no existe ninguna función de escritura.
 */
export const toAddonPurchaseLine = (row: repo.AdminAddonPurchaseLine): AdminAddonPurchaseLineDto => ({
  id: row.id,
  addon: row.addon,
  status: row.status,
  amountMinor: row.amount,
  currency: row.currency,
  provider: row.provider,
  createdAt: row.createdAt,
  paidAt: row.paidAt,
  refundedAt: row.refundedAt,
  unlocks: row.unlocks,
  duplicate: row.status === "PAID" && !row.unlocks,
});

const toAddonPurchaseListItem = (row: repo.AdminAddonPurchaseRow): AdminAddonPurchaseListItemDto => ({
  ...toAddonPurchaseLine(row),
  event: { id: row.event.id, title: row.event.title },
  user: { id: row.user.id, name: row.user.name, email: row.user.email },
});

export interface AddonPurchaseFilters {
  q?: string | undefined;
  status?: PurchaseStatusId | undefined;
  flag?: repo.AddonPurchaseFlag | undefined;
  eventId?: string | undefined;
  sort: repo.ListSort;
}

export async function listAdminAddonPurchases(_admin: AdminUser, filters: AddonPurchaseFilters & { page: number; pageSize?: number }): Promise<AdminPageDto<AdminAddonPurchaseListItemDto> & { duplicates: number }> {
  const { page, pageSize, ...where } = filters;
  const [total, duplicates] = await Promise.all([repo.countAddonPurchases(where), repo.countDuplicateAddonCharges()]);
  const window = pageWindow(page, total, pageSize);
  const rows = await repo.listAddonPurchases({ ...where, skip: window.skip, take: window.take });
  return { rows: rows.map(toAddonPurchaseListItem), window, duplicates };
}

export async function getAdminAddonPurchase(_admin: AdminUser, id: string): Promise<AdminAddonPurchaseDetailDto | null> {
  const row = await repo.findAddonPurchase(id);
  if (!row) return null;
  return {
    ...toAddonPurchaseListItem(row),
    updatedAt: row.updatedAt,
    maskedCheckoutSessionId: maskExternalId(row.providerCheckoutSessionId),
    maskedPaymentIntentId: maskExternalId(row.providerPaymentIntentId),
    eventStartsAt: row.event.startsAt,
    siblings: row.siblings.map(toAddonPurchaseLine),
  };
}

/** Cobros duplicados de complementos pendientes de reembolso (aviso en las listas de compras). */
export const countAdminDuplicateAddonCharges = (_admin: AdminUser): Promise<number> => repo.countDuplicateAddonCharges();
