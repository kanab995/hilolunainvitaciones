import { adminCopy } from "@/lib/admin/copy";
import { planLabel, isPlanId } from "@/lib/billing/plans";
import type { AdminAuditEntryDto } from "@/server/admin/dto";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * AUDITORÍA EN LA CONSOLA (D-34): registro de las acciones de administración que MODIFICAN algo. Solo lectura: nadie edita ni borra entradas
 * desde la aplicación. Solo se muestran los campos cambiados (antes → después) con etiquetas legibles; el JSON guardado no contiene datos
 * personales ni secretos, y aun así aquí solo pasan las dos claves conocidas.
 */
const AUDIT_PAGE_SIZE = 50;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function label(field: string, value: unknown): string {
  if (typeof value !== "string") return adminCopy.common.none;
  if (field === "minimumPlan") return isPlanId(value) ? planLabel(value) : value;
  if (field === "publicationStatus") return (adminCopy.templates.publicationShort as Record<string, string>)[value] ?? value;
  return value;
}

export function toAuditEntry(row: repo.AdminAuditRow): AdminAuditEntryDto {
  const before = isRecord(row.before) ? row.before : {};
  const after = isRecord(row.after) ? row.after : {};
  const fields = Object.keys(adminCopy.audit.fields) as Array<keyof typeof adminCopy.audit.fields>;
  return {
    id: row.id,
    createdAt: row.createdAt,
    actor: { id: row.admin.id, name: row.admin.name, email: row.admin.email },
    target: row.entityType === "Template" ? adminCopy.audit.templateTarget(row.entityName) : row.entityType,
    changes: fields.filter((field) => field in after || field in before).map((field) => ({ field: adminCopy.audit.fields[field], from: label(field, before[field]), to: label(field, after[field]) })),
  };
}

export async function listAdminAuditLog(_admin: AdminUser): Promise<AdminAuditEntryDto[]> {
  return (await repo.listAuditLog(AUDIT_PAGE_SIZE)).map(toAuditEntry);
}
