import type { Metadata } from "next";
import { EmailKindBadge, EmailStatusBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminFilters } from "@/components/admin/filters";
import { AdminPagination } from "@/components/admin/pagination";
import { AdminPageHeader } from "@/components/admin/parts";
import { Text } from "@/components/ui/typography";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDateTime } from "@/lib/admin/format";
import { EMAIL_DELIVERY_KINDS, EMAIL_DELIVERY_STATUSES } from "@/lib/email/delivery";
import { parseChoice, parsePage, type RawSearchParams } from "@/lib/admin/query";
import { routes } from "@/lib/routes";
import type { AdminEmailDeliveryDto } from "@/server/admin/dto";
import { listAdminEmailDeliveries } from "@/server/admin/emails";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.emails;

export const metadata: Metadata = { title: copy.title };

const columns: readonly AdminColumn<AdminEmailDeliveryDto>[] = [
  { id: "kind", header: copy.kind, primary: true, cell: (row) => <EmailKindBadge kind={row.kind} /> },
  { id: "recipient", header: copy.recipient, cell: (row) => <code className="font-mono text-lu-sm">{row.maskedRecipient}</code> },
  { id: "status", header: copy.status, cell: (row) => <EmailStatusBadge status={row.status} /> },
  { id: "date", header: copy.date, className: "whitespace-nowrap", cell: (row) => formatAdminDateTime(row.sentAt ?? row.createdAt) },
];

/** Correos (`/admin/emails`, D-36): envíos transaccionales a los anfitriones. Solo lectura; destinatario enmascarado, sin asunto ni cuerpo. */
export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const status = parseChoice(params.status, EMAIL_DELIVERY_STATUSES);
  const kind = parseChoice(params.kind, EMAIL_DELIVERY_KINDS);
  const result = await listAdminEmailDeliveries(admin, { page: parsePage(params.page), status, kind });

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <AdminFilters
        path={routes.adminEmails}
        label={adminCopy.common.filters}
        fields={[
          { kind: "select", name: "kind", label: copy.kind, value: kind ?? "", options: EMAIL_DELIVERY_KINDS.map((value) => ({ value, label: copy.kindLabel[value] })) },
          { kind: "select", name: "status", label: copy.status, value: status ?? "", options: EMAIL_DELIVERY_STATUSES.map((value) => ({ value, label: copy.statusLabel[value] })) },
        ]}
      />
      <AdminTable caption={copy.caption} columns={columns} rows={result.rows} rowKey={(row) => row.id} cards="lg" empty={adminCopy.common.noResults} />
      <AdminPagination path={routes.adminEmails} params={{ status, kind }} window={result.window} />
      <Text size="sm" tone="muted">
        {copy.note}
      </Text>
    </div>
  );
}
