import type { Metadata } from "next";
import { PlanBadge, TemplateVisibilityBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/parts";
import { TemplateEditDialog } from "@/components/admin/template-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { adminCopy } from "@/lib/admin/copy";
import { adminEventTypeLabel } from "@/lib/admin/options";
import type { AdminTemplateDto } from "@/server/admin/dto";
import { listAdminTemplates } from "@/server/admin/templates";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.templates;

export const metadata: Metadata = { title: copy.title };

const columns: readonly AdminColumn<AdminTemplateDto>[] = [
  { id: "name", header: copy.name, primary: true, cell: (template) => template.name },
  { id: "slug", header: copy.slug, cell: (template) => <code className="font-mono text-lu-sm">{template.slug}</code> },
  { id: "type", header: copy.eventType, cell: (template) => adminEventTypeLabel(template.eventType) },
  {
    id: "design",
    header: copy.design,
    cell: (template) => (
      <Badge tone={template.designStatus === "IMPLEMENTED" ? "success" : "neutral"} data-design={template.designStatus}>
        {copy.designStatus[template.designStatus]}
      </Badge>
    ),
  },
  { id: "visibility", header: copy.visibility, cell: (template) => <TemplateVisibilityBadge status={template.publicationStatus} /> },
  { id: "plan", header: copy.minimumPlan, cell: (template) => <PlanBadge plan={template.minimumPlan} /> },
  { id: "invitations", header: copy.invitations, align: "end", cell: (template) => template.invitationCount },
  { id: "actions", header: copy.actions, cell: (template) => <TemplateEditDialog template={template} /> },
];

/**
 * Plantillas (`/admin/templates`). Lo único editable es la visibilidad en el catálogo y el plan mínimo del evento; el nombre, el enlace y el
 * estado del diseño se muestran pero no se pueden cambiar desde aquí.
 */
export default async function AdminTemplatesPage() {
  const admin = await requireAdmin();
  const templates = await listAdminTemplates(admin);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <AdminTable caption={copy.caption} columns={columns} rows={templates} rowKey={(template) => template.id} cards="xl" empty={adminCopy.common.noResults} />
    </div>
  );
}
