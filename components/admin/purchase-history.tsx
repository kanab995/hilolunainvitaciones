import Link from "next/link";
import { PlanBadge, PurchaseKindBadge, PurchaseStatusBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatMinorNumber } from "@/lib/admin/format";
import { routes } from "@/lib/routes";
import type { AdminPurchaseLineDto } from "@/server/admin/dto";

const copy = adminCopy.purchases;

const columns: readonly AdminColumn<AdminPurchaseLineDto>[] = [
  {
    id: "date",
    header: copy.date,
    primary: true,
    cell: (purchase) => (
      <Link href={routes.adminPurchase(purchase.id)} className="hover:underline">
        {formatAdminDate(purchase.paidAt ?? purchase.createdAt)}
      </Link>
    ),
  },
  { id: "kind", header: copy.kind, cell: (purchase) => <PurchaseKindBadge kind={purchase.kind} /> },
  { id: "plan", header: copy.plan, cell: (purchase) => <PlanBadge plan={purchase.plan} /> },
  { id: "amount", header: copy.amount, align: "end", cell: (purchase) => formatMinorNumber(purchase.amountMinor) },
  { id: "currency", header: copy.currency, cell: (purchase) => purchase.currency },
  { id: "status", header: copy.status, cell: (purchase) => <PurchaseStatusBadge status={purchase.status} /> },
  { id: "provider", header: copy.provider, cell: (purchase) => copy.providers[purchase.provider] },
];

/**
 * HISTORIAL de compras de un evento (o de un evento dentro de un usuario): una fila por compra, de la más antigua a la más reciente. Nunca se
 * sobrescribe: una mejora es OTRA fila (`Mejora`, Premium, $300). Solo lectura.
 */
export function PurchaseHistoryTable({ purchases, caption, empty }: { purchases: readonly AdminPurchaseLineDto[]; caption: string; empty: string }) {
  return <AdminTable caption={caption} columns={columns} rows={purchases} rowKey={(purchase) => purchase.id} cards="md" empty={empty} />;
}
