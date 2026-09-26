import type { Metadata } from "next";
import Link from "next/link";
import { RoleBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminFilters } from "@/components/admin/filters";
import { AdminPagination } from "@/components/admin/pagination";
import { AdminPageHeader } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate } from "@/lib/admin/format";
import { SORT_VALUES } from "@/lib/admin/options";
import { parseChoice, parsePage, parseSearch, type RawSearchParams } from "@/lib/admin/query";
import { routes } from "@/lib/routes";
import { listAdminUsers } from "@/server/admin/users";
import type { AdminUserListItemDto } from "@/server/admin/dto";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.users;

export const metadata: Metadata = { title: copy.title };

const columns: readonly AdminColumn<AdminUserListItemDto>[] = [
  {
    id: "user",
    header: copy.user,
    primary: true,
    cell: (user) => (
      <Link href={routes.adminUser(user.id)} className="hover:underline">
        {user.name?.trim() || adminCopy.common.unnamed}
      </Link>
    ),
  },
  { id: "email", header: copy.email, cell: (user) => <span className="block truncate">{user.email}</span> },
  { id: "events", header: copy.events, align: "end", cell: (user) => user.eventCount },
  { id: "paid", header: copy.paidEvents, align: "end", cell: (user) => user.paidEventCount },
  { id: "created", header: copy.createdAt, className: "whitespace-nowrap", cell: (user) => formatAdminDate(user.createdAt) },
  { id: "role", header: copy.role, cell: (user) => <RoleBadge role={user.role} /> },
];

/** Usuarios (`/admin/users`): búsqueda por nombre o correo y paginación de servidor (25 por página). */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = parseSearch(params.q);
  const sort = parseChoice(params.sort, SORT_VALUES) ?? "newest";
  const result = await listAdminUsers(admin, { page: parsePage(params.page), q, sort });

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <AdminFilters
        path={routes.adminUsers}
        label={adminCopy.common.filters}
        fields={[
          { kind: "search", name: "q", label: copy.searchLabel, value: q ?? "" },
          { kind: "select", name: "sort", label: adminCopy.common.sort, value: sort === "newest" ? "" : sort, allLabel: adminCopy.common.newest, options: [{ value: "oldest", label: adminCopy.common.oldest }] },
        ]}
      />
      <AdminTable caption={copy.caption} columns={columns} rows={result.rows} rowKey={(user) => user.id} cards="lg" empty={adminCopy.common.noResults} />
      <AdminPagination path={routes.adminUsers} params={{ q, sort: sort === "newest" ? undefined : sort }} window={result.window} />
    </div>
  );
}
