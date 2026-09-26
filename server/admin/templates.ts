import { TEMPLATE_PUBLICATION_VALUES, type TemplatePublicationValue } from "@/lib/admin/options";
import { isPlanId, type PlanId } from "@/lib/billing/plans";
import type { AdminTemplateDto } from "@/server/admin/dto";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * PLANTILLAS EN LA CONSOLA (D-33). Lo ÚNICO que se puede cambiar es la visibilidad en el catálogo (`publicationStatus`) y el plan mínimo del EVENTO
 * (`minimumPlan`). El nombre, el `slug` y la madurez del diseño (`designStatus`) no se aceptan: esta capa solo reenvía esas dos claves.
 *  - Ocultar una plantilla (`DRAFT` / `ARCHIVED`) la retira de las NUEVAS selecciones; las invitaciones ya publicadas siguen funcionando porque
 *    la página pública lee su snapshot, y republicar una invitación existente no exige que la plantilla siga visible.
 *  - Cambiar `minimumPlan` no toca los eventos existentes: solo afecta a futuras selecciones y cambios de plantilla.
 */
export async function listAdminTemplates(_admin: AdminUser): Promise<AdminTemplateDto[]> {
  return repo.listTemplates();
}

export type TemplateUpdateResult = { ok: true; template: AdminTemplateDto } | { ok: false; code: "invalid" | "not_found" };

/** Entrada sin confiar: viene de un formulario. Los valores vacíos cuentan como «sin cambio». */
export interface TemplateUpdateInput {
  templateId: unknown;
  publicationStatus?: unknown;
  minimumPlan?: unknown;
}

const isPublication = (value: unknown): value is TemplatePublicationValue => typeof value === "string" && (TEMPLATE_PUBLICATION_VALUES as readonly string[]).includes(value);
const provided = (value: unknown): boolean => value !== undefined && value !== null && value !== "";

export async function updateAdminTemplate(admin: AdminUser, input: TemplateUpdateInput): Promise<TemplateUpdateResult> {
  const { templateId, publicationStatus, minimumPlan } = input;
  if (typeof templateId !== "string" || templateId.length === 0 || templateId.length > 64) return { ok: false, code: "invalid" };
  if (!provided(publicationStatus) && !provided(minimumPlan)) return { ok: false, code: "invalid" };
  if (provided(publicationStatus) && !isPublication(publicationStatus)) return { ok: false, code: "invalid" };
  if (provided(minimumPlan) && !isPlanId(minimumPlan)) return { ok: false, code: "invalid" };

  const update: repo.TemplateSettingsUpdate = {};
  if (isPublication(publicationStatus)) update.publicationStatus = publicationStatus;
  if (isPlanId(minimumPlan)) update.minimumPlan = minimumPlan satisfies PlanId;
  const template = await repo.updateTemplateSettings(templateId, update, admin.id);
  return template ? { ok: true, template } : { ok: false, code: "not_found" };
}
