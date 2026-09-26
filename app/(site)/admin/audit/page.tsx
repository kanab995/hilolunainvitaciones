import type { Metadata } from "next";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/parts";
import { Text } from "@/components/ui/typography";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDateTime } from "@/lib/admin/format";
import { listAdminAuditLog } from "@/server/admin/audit";
import type { AdminAuditEntryDto } from "@/server/admin/dto";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.audit;

export const metadata: Metadata = { title: copy.title };

const columns: readonly AdminColumn<AdminAuditEntryDto>[] = [
  { id: "date", header: copy.date, primary: true, className: "whitespace-nowrap", cell: (entry) => formatAdminDateTime(entry.createdAt) },
  { id: "actor", header: copy.actor, cell: (entry) => entry.actor.name?.trim() || entry.actor.email },
  { id: "target", header: copy.target, cell: (entry) => entry.target },
  {
    id: "changes",
    header: copy.changes,
    className: "min-w-56",
    cell: (entry) => (
      <ul className="flex flex-col gap-1">
        {entry.changes.map((change) => (
          <li key={change.field} className="text-lu-sm">
            <span className="text-lu-text-muted">{change.field}: </span>
            {change.from} → {change.to}
          </li>
        ))}
      </ul>
    ),
  },
];

/** Auditoría (`/admin/audit`): últimas acciones de administración que modificaron algo. Solo lectura, sin buscador. */
export default async function AdminAuditPage() {
  const admin = await requireAdmin();
  const entries = await listAdminAuditLog(admin);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <AdminTable caption={copy.caption} columns={columns} rows={entries} rowKey={(entry) => entry.id} cards="lg" empty={copy.empty} />
      <Text size="sm" tone="muted">
        {copy.note}
      </Text>
    </div>
  );
}
