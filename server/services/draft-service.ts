import { applyDraftPayload, parseDraftPayload } from "@/lib/editor/draft-payload";
import { canSelectTemplate } from "@/lib/editor/template-choice";
import { validateInvitation } from "@/lib/editor/validation";
import { resolveOwnedEvent, type OwnedEventResolution } from "@/server/auth/ownership";
import { StoreUnavailableError } from "@/server/db/errors";
import { billingCopy } from "@/lib/billing/copy";
import type { PlanId } from "@/lib/billing/plans";
import { saveOwnedDraft, type DraftBuild, type SaveDraftOutcome, type TemplateAccess } from "@/server/repositories/draft";
import { releaseUnusedMedia } from "@/server/services/media-service";
import { checkTemplatePlanForEvent } from "@/server/services/plan-limits";
import type { SaveDraftResult } from "@/types/draft-sync";
import { logger } from "@/server/observability/logger";

/**
 * CASO DE USO «guardar el borrador» (D-29; lo llama la Server Action `saveDraftAction`, sin lógica de dominio en ella).
 * Orden fijo: 1. sesión  2. usuario  3. el evento es DEL usuario  4. lista blanca del payload (DTO explícito)  5. aplicar
 * al borrador actual y validar con las mismas reglas del editor  6. escribir en UNA transacción con control de
 * concurrencia optimista  7. liberar archivos de sedes eliminadas  8. resultado seguro.
 * NUNCA se acepta del cliente `ownerId`, `eventId` ajeno, ids de invitación ni estados de publicación: el evento sale
 * de la sesión y el `eventRef` es solo una referencia que el paso 3 comprueba.
 */
export interface DraftServiceDeps {
  resolveOwnedEvent: (ref: string) => Promise<OwnedEventResolution>;
  save: (userId: string, eventId: string, baseRevision: number, build: DraftBuild, templateAccess?: TemplateAccess) => Promise<SaveDraftOutcome>;
  release: (userId: string, eventId: string, assetIds: readonly string[]) => Promise<void>;
  canSelectTemplate: (slug: string) => boolean;
  /** ¿El plan DE ESTE EVENTO permite una plantilla con este plan mínimo? (D-32; solo al cambiar de plantilla). */
  templatePlanAllowed: (eventId: string, minimumPlan: PlanId) => Promise<boolean>;
}

const defaultDeps: DraftServiceDeps = { resolveOwnedEvent, save: saveOwnedDraft, release: (userId, eventId, ids) => releaseUnusedMedia(userId, eventId, ids), canSelectTemplate, templatePlanAllowed: async (eventId, minimumPlan) => (await checkTemplatePlanForEvent(eventId, minimumPlan)).ok };

const messages = {
  denied: "No encontramos este evento.",
  unauthenticated: "Tu sesión terminó. Inicia sesión de nuevo para seguir editando.",
  conflict: "Este evento se modificó en otra ventana. Recarga el editor para ver la última versión.",
  invalid: "Revisa los campos marcados para poder guardar.",
  template: "Esa plantilla no está disponible para este evento.",
  plan: billingCopy.planRequiredGeneric,
  unavailable: "Guardar no está disponible en este entorno (falta la base de datos).",
  error: "No pudimos guardar los cambios. Inténtalo de nuevo.",
} as const;

export async function saveInvitationDraft(eventRef: string, raw: unknown, deps: DraftServiceDeps = defaultDeps): Promise<SaveDraftResult> {
  try {
    const resolution = await deps.resolveOwnedEvent(eventRef);
    if (resolution.status === "unauthenticated") return { ok: false, code: "unauthenticated", message: messages.unauthenticated };
    if (resolution.status === "not_found") return { ok: false, code: "not_found", message: messages.denied };
    const { user, event } = resolution;

    const parsed = parseDraftPayload(raw);
    if (!parsed.ok) return { ok: false, code: "invalid", message: parsed.message };
    const dto = parsed.value;

    const outcome = await deps.save(user.id, event.id, dto.baseRevision, (current) => {
      if (dto.templateSlug !== current.templateSlug && !deps.canSelectTemplate(dto.templateSlug)) return { ok: false, message: messages.template };
      const next = applyDraftPayload(current, dto);
      // Las mismas reglas del editor (`validateInvitation`): una sola fuente de validación.
      return Object.keys(validateInvitation(next)).length > 0 ? { ok: false, message: messages.invalid } : { ok: true, invitation: next };
    }, (minimumPlan) => deps.templatePlanAllowed(event.id, minimumPlan));

    if (outcome.ok) {
      if (outcome.releasedMediaIds.length > 0) await deps.release(user.id, event.id, outcome.releasedMediaIds);
      return { ok: true, revision: outcome.revision };
    }
    if (outcome.code === "conflict") return { ok: false, code: "conflict", message: messages.conflict, ...(outcome.revision !== undefined ? { revision: outcome.revision } : {}) };
    if (outcome.code === "not_found") return { ok: false, code: "not_found", message: messages.denied };
    if (outcome.code === "template_unavailable") return { ok: false, code: "invalid", message: messages.template };
    if (outcome.code === "plan_required") return { ok: false, code: "plan_required", message: messages.plan };
    return { ok: false, code: "invalid", message: outcome.message ?? messages.invalid };
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { ok: false, code: "unavailable", message: messages.unavailable };
    // Solo el tipo del error: nunca contenido del usuario ni mensajes de la base de datos.
    logger.error("editor.save_failed", error);
    return { ok: false, code: "error", message: messages.error };
  }
}
