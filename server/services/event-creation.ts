import { createDefaultInvitationData, createEntityId, type IdFactory } from "@/lib/events/default-invitation";
import { validateCreateEventInput, type CreateEventField, type CreateEventRaw } from "@/lib/events/create-event-input";
import { eventTypeConfigs } from "@/lib/events/event-types";
import { eventSlugBase, invitationSlugBase, pickUniqueSlug } from "@/lib/events/slug";
import { checkTemplateForEvent } from "@/lib/events/template-compat";
import { StoreUnavailableError } from "@/server/db/errors";
import { findTakenSlugs, createOwnedEvent, SlugTakenError, TemplateUnavailableError } from "@/server/repositories/event-creation";
import { getTemplateBySlug } from "@/server/repositories/templates";
import { checkTemplatePlanForNewEvent, type TemplatePlanDecision } from "@/server/services/plan-limits";
import { buildEventAggregate, type NewEventAggregate } from "@/server/services/event-aggregate";
import type { AppUser } from "@/server/services/user-sync";
import type { Template } from "@/types/templates";
import { logger } from "@/server/observability/logger";

/**
 * CASO DE USO «crear el primer evento» (D-28). Toda la lógica vive aquí (la Server Action solo orquesta):
 *   1. validar la lista blanca de campos  2. resolver la plantilla DESDE LA BASE DE DATOS (publicada, diseño
 *   aprobado, compatible con el tipo)  3. comprobar el PLAN (D-32: un evento nuevo nace GRATIS, así que solo admite plantillas de
 *   plan Gratis; NO existe límite de eventos por cuenta; la autoridad está aquí, no en la interfaz)  4. elegir slugs únicos (evento e invitación por separado)
 *   5. construir el contenido inicial  6. escribir TODO en una transacción  7. devolver el id real.
 * El propietario es SIEMPRE el usuario de la sesión (`user`): ningún campo del cliente puede cambiarlo.
 * El evento y la invitación nacen en BORRADOR (nada es público hasta que exista la publicación real).
 * Las dependencias son inyectables: se prueba el flujo sin base de datos.
 */
export interface EventCreationDeps {
  findTemplate: (slug: string) => Promise<Template | undefined>;
  findTakenSlugs: (bases: { event: string; invitation: string }) => Promise<{ event: Set<string>; invitation: Set<string> }>;
  create: (ownerId: string, aggregate: NewEventAggregate) => Promise<{ eventId: string; invitationId: string }>;
  newId: IdFactory;
  /** ¿Puede un evento NUEVO (plan Gratis) usar esta plantilla? (D-32). */
  checkTemplatePlan: (minimumPlan: Template["minimumPlan"]) => TemplatePlanDecision;
}

const defaultDeps: EventCreationDeps = { findTemplate: getTemplateBySlug, findTakenSlugs, create: createOwnedEvent, newId: createEntityId, checkTemplatePlan: checkTemplatePlanForNewEvent };

export type CreateEventResult =
  | { ok: true; eventId: string }
  | { ok: false; code: "invalid"; message: string; fieldErrors: Partial<Record<CreateEventField, string>> }
  | { ok: false; code: "template_unavailable" | "unavailable" | "error"; message: string }
  /** La plantilla requiere un plan superior a Gratis (D-32): la interfaz ofrece ver los planes. */
  | { ok: false; code: "plan_required"; message: string };

const MAX_SLUG_ATTEMPTS = 5;

export async function createEventForUser(user: Pick<AppUser, "id" | "email" | "name">, raw: CreateEventRaw, deps: EventCreationDeps = defaultDeps): Promise<CreateEventResult> {
  try {
    const validation = validateCreateEventInput(raw);
    if (!validation.ok) return { ok: false, code: "invalid", message: "Revisa los datos marcados.", fieldErrors: validation.errors };
    const input = validation.value;

    const template = await deps.findTemplate(input.templateSlug);
    const eligibility = checkTemplateForEvent(template, input.eventType, eventTypeConfigs[input.eventType].label);
    if (!eligibility.ok || !template) return { ok: false, code: "template_unavailable", message: eligibility.ok ? "Esta plantilla no está disponible." : eligibility.message };

    const planDecision = deps.checkTemplatePlan(template.minimumPlan);
    if (!planDecision.ok) return { ok: false, code: "plan_required", message: planDecision.message };

    const eventBase = eventSlugBase(input.title);
    const invitationBase = invitationSlugBase(input.names);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const taken = await deps.findTakenSlugs({ event: eventBase, invitation: invitationBase });
      const eventSlug = pickUniqueSlug(eventBase, taken.event);
      const invitationSlug = pickUniqueSlug(invitationBase, taken.invitation);

      const invitation = createDefaultInvitationData({
        eventType: input.eventType,
        templateSlug: template.slug,
        names: input.names,
        startsAtIso: input.startsAtIso,
        timezone: input.timezone,
        invitationSlug,
        newId: deps.newId,
      });
      const aggregate = buildEventAggregate({
        owner: { id: user.id, email: user.email, name: user.name },
        event: { id: deps.newId("evt"), slug: eventSlug, title: input.title, status: "DRAFT" },
        invitation,
        invitationStatus: "DRAFT",
      });

      try {
        const { eventId } = await deps.create(user.id, aggregate);
        return { ok: true, eventId };
      } catch (error) {
        // Otra petición ocupó el slug justo antes: se vuelve a elegir con los slugs actualizados.
        if (error instanceof SlugTakenError && attempt < MAX_SLUG_ATTEMPTS - 1) continue;
        throw error;
      }
    }
    return { ok: false, code: "error", message: "No pudimos crear tu evento. Inténtalo de nuevo." };
  } catch (error) {
    if (error instanceof TemplateUnavailableError) return { ok: false, code: "template_unavailable", message: "Esta plantilla no está disponible." };
    if (error instanceof StoreUnavailableError) return { ok: false, code: "unavailable", message: "Crear eventos no está disponible en este entorno (falta la base de datos)." };
    // Solo el tipo del error: nunca datos del usuario ni mensajes de la base de datos.
    logger.error("event.create_failed", error);
    return { ok: false, code: "error", message: "No pudimos crear tu evento. Inténtalo de nuevo en unos instantes." };
  }
}
