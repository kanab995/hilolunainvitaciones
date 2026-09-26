import type { Metadata } from "next";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminFilters } from "@/components/admin/filters";
import { AdminPagination } from "@/components/admin/pagination";
import { AdminPageHeader } from "@/components/admin/parts";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/typography";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDateTime } from "@/lib/admin/format";
import { parsePage, parseSearch, type RawSearchParams } from "@/lib/admin/query";
import { routes } from "@/lib/routes";
import type { AdminWebhookDto } from "@/server/admin/dto";
import { listAdminWebhookEvents } from "@/server/admin/webhooks";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.webhooks;

export const metadata: Metadata = { title: copy.title };

const columns: readonly AdminColumn<AdminWebhookDto>[] = [
  { id: "type", header: copy.type, primary: true, cell: (webhook) => webhook.type },
  { id: "provider", header: copy.provider, cell: (webhook) => adminCopy.purchases.providers[webhook.provider] },
  { id: "id", header: copy.externalId, cell: (webhook) => <code className="font-mono text-lu-sm">{webhook.maskedExternalEventId}</code> },
  { id: "date", header: copy.date, cell: (webhook) => formatAdminDateTime(webhook.processedAt) },
  {
    id: "state",
    header: copy.state,
    cell: () => (
      <Badge tone="success" dot>
        {copy.processed}
      </Badge>
    ),
  },
];

/** Webhooks (`/admin/webhooks`): eventos del proveedor de pagos procesados. Sin contenido ni firma (la tabla no los guarda). */
export default async function AdminWebhooksPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = parseSearch(params.q);
  const result = await listAdminWebhookEvents(admin, { page: parsePage(params.page), q });

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <AdminFilters path={routes.adminWebhooks} label={adminCopy.common.filters} fields={[{ kind: "search", name: "q", label: copy.searchLabel, value: q ?? "" }]} />
      <AdminTable caption={copy.caption} columns={columns} rows={result.rows} rowKey={(webhook) => webhook.id} cards="lg" empty={adminCopy.common.noResults} />
      <AdminPagination path={routes.adminWebhooks} params={{ q }} window={result.window} />
      <Text size="sm" tone="muted">
        {copy.note}
      </Text>
    </div>
  );
}
