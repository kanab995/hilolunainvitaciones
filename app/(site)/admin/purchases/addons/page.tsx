import type { Metadata } from "next";
import Link from "next/link";
import { AddonDuplicatesAlert, AddonPurchaseListTable } from "@/components/admin/addon-purchases";
import { AdminFilters } from "@/components/admin/filters";
import { AdminPagination } from "@/components/admin/pagination";
import { AdminPageHeader } from "@/components/admin/parts";
import { Button } from "@/components/ui/button";
import { adminCopy } from "@/lib/admin/copy";
import { SORT_VALUES } from "@/lib/admin/options";
import { parseChoice, parsePage, parseSearch, type RawSearchParams } from "@/lib/admin/query";
import { PURCHASE_STATUSES } from "@/lib/billing/purchase";
import { routes } from "@/lib/routes";
import { listAdminAddonPurchases } from "@/server/admin/addons";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.addons;

export const metadata: Metadata = { title: copy.title };

const FLAGS = ["duplicate"] as const;

/**
 * Compras de complementos (`/admin/purchases/addons`, D-48): filtros por estado y por cobro duplicado (`?status=&flag=&q=&sort=&page=`).
 * Lista PROPIA: nunca se mezcla con las compras que determinan el plan. Solo lectura.
 */
export default async function AdminAddonPurchasesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = parseSearch(params.q);
  const status = parseChoice(params.status, PURCHASE_STATUSES);
  const flag = parseChoice(params.flag, FLAGS);
  const sort = parseChoice(params.sort, SORT_VALUES) ?? "newest";
  const result = await listAdminAddonPurchases(admin, { page: parsePage(params.page), q, status, flag, sort });

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={copy.title}
        description={copy.description}
        crumbs={[{ label: adminCopy.purchases.title, href: routes.adminPurchases }]}
        actions={
          <Button asChild variant="secondary" size="md">
            <Link href={routes.adminPurchases}>{copy.toPlans}</Link>
          </Button>
        }
      />
      {flag !== "duplicate" ? <AddonDuplicatesAlert count={result.duplicates} /> : null}
      <AdminFilters
        path={routes.adminAddonPurchases}
        label={adminCopy.common.filters}
        fields={[
          { kind: "search", name: "q", label: copy.searchLabel, value: q ?? "" },
          { kind: "select", name: "status", label: adminCopy.purchases.status, value: status ?? "", options: PURCHASE_STATUSES.map((value) => ({ value, label: adminCopy.purchases.statusLabel[value] })) },
          { kind: "select", name: "flag", label: copy.flag, value: flag ?? "", options: FLAGS.map((value) => ({ value, label: copy.flagLabel[value] })) },
          { kind: "select", name: "sort", label: adminCopy.common.sort, value: sort === "newest" ? "" : sort, allLabel: adminCopy.common.newest, options: [{ value: "oldest", label: adminCopy.common.oldest }] },
        ]}
      />
      <AddonPurchaseListTable rows={result.rows} />
      <AdminPagination path={routes.adminAddonPurchases} params={{ q, status, flag, sort: sort === "newest" ? undefined : sort }} window={result.window} />
    </div>
  );
}
