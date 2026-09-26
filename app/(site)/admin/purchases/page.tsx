import type { Metadata } from "next";
import Link from "next/link";
import { PlanBadge, PurchaseKindBadge, PurchaseStatusBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminFilters } from "@/components/admin/filters";
import { AdminPagination } from "@/components/admin/pagination";
import { AdminPageHeader, PersonCell } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatMinorNumber } from "@/lib/admin/format";
import { SORT_VALUES } from "@/lib/admin/options";
import { parseChoice, parsePage, parseSearch, type RawSearchParams } from "@/lib/admin/query";
import { PAID_PLAN_IDS, planLabel } from "@/lib/billing/plans";
import { PURCHASE_KINDS, PURCHASE_STATUSES } from "@/lib/billing/purchase";
import { routes } from "@/lib/routes";
import type { AdminPurchaseListItemDto } from "@/server/admin/dto";
import { listAdminPurchases } from "@/server/admin/purchases";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.purchases;

export const metadata: Metadata = { title: copy.title };

const columns: readonly AdminColumn<AdminPurchaseListItemDto>[] = [
  {
    id: "event",
    header: copy.event,
    primary: true,
    cell: (purchase) => (
      <Link href={routes.adminPurchase(purchase.id)} className="hover:underline">
        {purchase.event.title}
      </Link>
    ),
  },
  {
    id: "user",
    header: copy.user,
    cell: (purchase) => (
      <Link href={routes.adminUser(purchase.user.id)} className="block min-w-0 hover:underline">
        <PersonCell name={purchase.user.name} email={purchase.user.email} />
      </Link>
    ),
  },
  { id: "plan", header: copy.plan, cell: (purchase) => <PlanBadge plan={purchase.plan} /> },
  { id: "kind", header: copy.kind, cell: (purchase) => <PurchaseKindBadge kind={purchase.kind} /> },
  { id: "amount", header: copy.amount, align: "end", cell: (purchase) => formatMinorNumber(purchase.amountMinor) },
  { id: "currency", header: copy.currency, cell: (purchase) => purchase.currency },
  { id: "status", header: copy.status, cell: (purchase) => <PurchaseStatusBadge status={purchase.status} /> },
  { id: "provider", header: copy.provider, cell: (purchase) => copy.providers[purchase.provider] },
  { id: "date", header: copy.date, className: "whitespace-nowrap", cell: (purchase) => formatAdminDate(purchase.paidAt ?? purchase.createdAt) },
];

/** Compras (`/admin/purchases`): filtros por estado, tipo y plan (`?status=&kind=&plan=&q=&sort=&page=`). Solo lectura. */
export default async function AdminPurchasesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = parseSearch(params.q);
  const status = parseChoice(params.status, PURCHASE_STATUSES);
  const kind = parseChoice(params.kind, PURCHASE_KINDS);
  const plan = parseChoice(params.plan, PAID_PLAN_IDS);
  const sort = parseChoice(params.sort, SORT_VALUES) ?? "newest";
  const result = await listAdminPurchases(admin, { page: parsePage(params.page), q, status, kind, plan, sort });

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <AdminFilters
        path={routes.adminPurchases}
        label={adminCopy.common.filters}
        fields={[
          { kind: "search", name: "q", label: copy.searchLabel, value: q ?? "" },
          { kind: "select", name: "status", label: copy.status, value: status ?? "", options: PURCHASE_STATUSES.map((value) => ({ value, label: copy.statusLabel[value] })) },
          { kind: "select", name: "kind", label: copy.kind, value: kind ?? "", options: PURCHASE_KINDS.map((value) => ({ value, label: copy.kindLabel[value] })) },
          { kind: "select", name: "plan", label: copy.plan, value: plan ?? "", options: PAID_PLAN_IDS.map((value) => ({ value, label: planLabel(value) })) },
          { kind: "select", name: "sort", label: adminCopy.common.sort, value: sort === "newest" ? "" : sort, allLabel: adminCopy.common.newest, options: [{ value: "oldest", label: adminCopy.common.oldest }] },
        ]}
      />
      <AdminTable caption={copy.caption} columns={columns} rows={result.rows} rowKey={(purchase) => purchase.id} cards="xl" empty={adminCopy.common.noResults} />
      <AdminPagination path={routes.adminPurchases} params={{ q, status, kind, plan, sort: sort === "newest" ? undefined : sort }} window={result.window} />
    </div>
  );
}
