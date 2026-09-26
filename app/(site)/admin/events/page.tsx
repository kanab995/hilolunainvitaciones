import type { Metadata } from "next";
import Link from "next/link";
import { PlanBadge, PublicationBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminFilters } from "@/components/admin/filters";
import { AdminPagination } from "@/components/admin/pagination";
import { AdminPageHeader, PersonCell } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate } from "@/lib/admin/format";
import { adminEventTypeLabel, EVENT_SORT_VALUES, EVENT_TYPE_VALUES, PUBLICATION_FILTER_VALUES } from "@/lib/admin/options";
import { parseChoice, parsePage, parseSearch, type RawSearchParams } from "@/lib/admin/query";
import { PLAN_IDS, planLabel } from "@/lib/billing/plans";
import { routes } from "@/lib/routes";
import type { AdminEventListItemDto } from "@/server/admin/dto";
import { listAdminEvents } from "@/server/admin/events";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.events;

export const metadata: Metadata = { title: copy.title };

const columns: readonly AdminColumn<AdminEventListItemDto>[] = [
  {
    id: "event",
    header: copy.event,
    primary: true,
    cell: (event) => (
      <Link href={routes.adminEvent(event.id)} className="hover:underline">
        {event.title}
      </Link>
    ),
  },
  {
    id: "owner",
    header: copy.owner,
    cell: (event) => (
      <Link href={routes.adminUser(event.owner.id)} className="block min-w-0 hover:underline">
        <PersonCell name={event.owner.name} email={event.owner.email} />
      </Link>
    ),
  },
  { id: "type", header: copy.type, cell: (event) => adminEventTypeLabel(event.type) },
  { id: "template", header: copy.template, cell: (event) => event.template?.name ?? adminCopy.common.none },
  { id: "plan", header: copy.effectivePlan, cell: (event) => <PlanBadge plan={event.plan} /> },
  { id: "publication", header: copy.publicationState, cell: (event) => <PublicationBadge state={event.publication} /> },
  { id: "date", header: copy.eventDate, className: "whitespace-nowrap", cell: (event) => formatAdminDate(event.startsAt) },
  { id: "created", header: copy.createdAt, className: "whitespace-nowrap", cell: (event) => formatAdminDate(event.createdAt) },
];

/** Eventos (`/admin/events`): filtros por publicación, tipo y plan efectivo (`?publication=&type=&plan=&q=&sort=&page=`), paginados en el servidor. */
export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = parseSearch(params.q);
  const publication = parseChoice(params.publication, PUBLICATION_FILTER_VALUES);
  const type = parseChoice(params.type, EVENT_TYPE_VALUES);
  const plan = parseChoice(params.plan, PLAN_IDS);
  const sort = parseChoice(params.sort, EVENT_SORT_VALUES) ?? "newest";
  const result = await listAdminEvents(admin, { page: parsePage(params.page), q, publication, type, plan, sort });

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <AdminFilters
        path={routes.adminEvents}
        label={adminCopy.common.filters}
        fields={[
          { kind: "search", name: "q", label: copy.searchLabel, value: q ?? "" },
          { kind: "select", name: "publication", label: copy.publication, value: publication ?? "", options: PUBLICATION_FILTER_VALUES.map((value) => ({ value, label: adminCopy.publication[value] })) },
          { kind: "select", name: "type", label: copy.type, value: type ?? "", options: EVENT_TYPE_VALUES.map((value) => ({ value, label: adminEventTypeLabel(value) })) },
          { kind: "select", name: "plan", label: copy.plan, value: plan ?? "", options: PLAN_IDS.map((value) => ({ value, label: planLabel(value) })) },
          {
            kind: "select",
            name: "sort",
            label: adminCopy.common.sort,
            value: sort === "newest" ? "" : sort,
            allLabel: adminCopy.common.newest,
            options: [
              { value: "oldest", label: adminCopy.common.oldest },
              { value: "event_date", label: adminCopy.common.eventDate },
            ],
          },
        ]}
      />
      <AdminTable caption={copy.caption} columns={columns} rows={result.rows} rowKey={(event) => event.id} cards="xl" empty={adminCopy.common.noResults} />
      <AdminPagination path={routes.adminEvents} params={{ q, publication, type, plan, sort: sort === "newest" ? undefined : sort }} window={result.window} />
    </div>
  );
}
