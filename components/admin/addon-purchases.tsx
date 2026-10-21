import Link from "next/link";
import { AddonDuplicateBadge, PurchaseStatusBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatMinorNumber } from "@/lib/admin/format";
import { routes } from "@/lib/routes";
import type { AdminAddonPurchaseLineDto, AdminAddonPurchaseListItemDto } from "@/server/admin/dto";

const copy = adminCopy.addons;
const purchases = adminCopy.purchases;

/** Estado de una compra de complemento: el del pago y, si es un cobro duplicado, la señal (siempre con texto, nunca solo color). */
export function AddonPurchaseStatus({ purchase }: { purchase: Pick<AdminAddonPurchaseLineDto, "status" | "duplicate"> }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <PurchaseStatusBadge status={purchase.status} />
      {purchase.duplicate ? <AddonDuplicateBadge /> : null}
    </span>
  );
}

const dateColumn: AdminColumn<AdminAddonPurchaseLineDto> = {
  id: "date",
  header: purchases.date,
  primary: true,
  className: "whitespace-nowrap",
  cell: (purchase) => (
    <Link href={routes.adminAddonPurchase(purchase.id)} className="hover:underline">
      {formatAdminDate(purchase.paidAt ?? purchase.createdAt)}
    </Link>
  ),
};

const lineColumns: readonly AdminColumn<AdminAddonPurchaseLineDto>[] = [
  { id: "product", header: copy.product, cell: (purchase) => copy.products[purchase.addon] },
  { id: "amount", header: purchases.amount, align: "end", cell: (purchase) => formatMinorNumber(purchase.amountMinor) },
  { id: "currency", header: purchases.currency, cell: (purchase) => purchase.currency },
  { id: "status", header: purchases.status, cell: (purchase) => <AddonPurchaseStatus purchase={purchase} /> },
  { id: "unlocks", header: copy.unlocks, cell: (purchase) => (purchase.unlocks ? copy.unlocksYes : copy.unlocksNo) },
  { id: "refunded", header: copy.refundedAt, className: "whitespace-nowrap", cell: (purchase) => formatAdminDate(purchase.refundedAt) },
];

/** Historial de un complemento dentro de un evento (detalle de compra y detalle de evento). Solo lectura. */
export function AddonPurchaseHistoryTable({ rows, caption, empty }: { rows: readonly AdminAddonPurchaseLineDto[]; caption: string; empty: string }) {
  return <AdminTable caption={caption} columns={[dateColumn, ...lineColumns]} rows={rows} rowKey={(purchase) => purchase.id} cards="md" empty={empty} />;
}

const listColumns: readonly AdminColumn<AdminAddonPurchaseListItemDto>[] = [
  {
    id: "event",
    header: purchases.event,
    primary: true,
    cell: (purchase) => (
      <Link href={routes.adminAddonPurchase(purchase.id)} className="hover:underline">
        {purchase.event.title}
      </Link>
    ),
  },
  {
    id: "user",
    header: purchases.user,
    cell: (purchase) => (
      <Link href={routes.adminUser(purchase.user.id)} className="block min-w-0 hover:underline">
        <PersonCell name={purchase.user.name} email={purchase.user.email} />
      </Link>
    ),
  },
  ...lineColumns,
  { id: "date", header: purchases.date, className: "whitespace-nowrap", cell: (purchase) => formatAdminDate(purchase.paidAt ?? purchase.createdAt) },
];

/** Lista paginada de `/admin/purchases/addons`. */
export function AddonPurchaseListTable({ rows }: { rows: readonly AdminAddonPurchaseListItemDto[] }) {
  return <AdminTable caption={copy.caption} columns={listColumns} rows={rows} rowKey={(purchase) => purchase.id} cards="xl" empty={adminCopy.common.noResults} />;
}

/** Aviso de cobros duplicados pendientes de reembolso (no se muestra si no hay ninguno). */
export function AddonDuplicatesAlert({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p role="status" data-addon-duplicates={count} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lu-card border border-lu-border-strong bg-lu-surface-muted px-4 py-3 text-lu-sm text-lu-text">
      <span>{copy.duplicatesAlert(count)}</span>
      <Link href={`${routes.adminAddonPurchases}?flag=duplicate`} className="font-medium underline underline-offset-2">
        {copy.duplicatesAlertAction}
      </Link>
    </p>
  );
}
