import { toPublicationInfo } from "@/lib/publishing/state";
import { resolveOwnedEvent, type OwnedEventResolution } from "@/server/auth/ownership";
import { StoreUnavailableError } from "@/server/db/errors";
import type { FeatureId } from "@/lib/billing/plans";
import { billingCopy } from "@/lib/billing/copy";
import { getOwnedDraftMeta } from "@/server/repositories/publishing";
import { canUseEventFeature } from "@/server/services/entitlement-service";
import { releaseUnusedMedia } from "@/server/services/media-service";
import { defaultPublishCoreDeps, publishOwnedEvent, type PublishCoreDeps } from "@/server/services/publish-core";
import type { PublishResult } from "@/types/draft-sync";
import type { PublicationInfo } from "@/types/published";
import { logger } from "@/server/observability/logger";

/**
 * CASO DE USO «publicar» (D-29): `publishInvitationForOwner`. Solo el PROPIETARIO puede publicar o republicar; el
 * `eventRef` es una referencia que se comprueba contra la sesión (nunca `ownerId`). Responsabilidades: propiedad →
 * validación mínima → snapshot → transacción (snapshot + estado + versión) → liberar archivos que la versión nueva ya
 * no usa → devolver el estado nuevo para que la acción revalide `/i/[slug]`. Publicar no cambia el slug.
 * Si algo falla, el borrador queda intacto y el estado NO cambia (la transacción se revierte).
 */
export interface PublishServiceDeps extends PublishCoreDeps {
  resolveOwnedEvent: (ref: string) => Promise<OwnedEventResolution>;
  release: (userId: string, eventId: string, assetIds: readonly string[]) => Promise<void>;
  getMeta: (userId: string, eventId: string) => ReturnType<typeof getOwnedDraftMeta>;
  /** Derechos del plan DE ESTE EVENTO (D-32): publicar es una feature configurable (hoy incluida en todos los planes). */
  canUseEventFeature: (eventId: string, feature: FeatureId) => Promise<boolean>;
}

const defaultDeps: PublishServiceDeps = { ...defaultPublishCoreDeps, resolveOwnedEvent, release: (userId, eventId, ids) => releaseUnusedMedia(userId, eventId, ids), getMeta: getOwnedDraftMeta, canUseEventFeature: (eventId, feature) => canUseEventFeature(eventId, feature) };

export interface PublishServiceOutcome {
  result: PublishResult;
  /** Solo si se publicó algo: la acción revalida la página pública de este slug. */
  revalidate?: { eventId: string; slug: string };
}

const messages = {
  denied: "No encontramos este evento.",
  unauthenticated: "Tu sesión terminó. Inicia sesión de nuevo para publicar.",
  conflict: "Este evento tiene cambios más recientes en otra ventana. Recarga el editor antes de publicar.",
  unavailable: "Publicar no está disponible en este entorno (falta la base de datos).",
  error: "No pudimos publicar tu invitación. Tu borrador sigue intacto; inténtalo de nuevo.",
} as const;

export async function publishInvitationForOwner(eventRef: string, options: { expectedRevision?: unknown } = {}, deps: PublishServiceDeps = defaultDeps): Promise<PublishServiceOutcome> {
  try {
    const resolution = await deps.resolveOwnedEvent(eventRef);
    if (resolution.status === "unauthenticated") return { result: { ok: false, code: "unauthenticated", message: messages.unauthenticated } };
    if (resolution.status === "not_found") return { result: { ok: false, code: "not_found", message: messages.denied } };
    const { user, event } = resolution;
    if (!(await deps.canUseEventFeature(event.id, "publish"))) return { result: { ok: false, code: "plan_required", message: billingCopy.featureUnavailable.publish } };

    const expected = typeof options.expectedRevision === "number" && Number.isInteger(options.expectedRevision) && options.expectedRevision > 0 ? options.expectedRevision : undefined;
    const outcome = await publishOwnedEvent(user.id, event.id, expected, deps);

    if (!outcome.ok) {
      if (outcome.code === "conflict") return { result: { ok: false, code: "conflict", message: messages.conflict, ...(outcome.revision !== undefined ? { revision: outcome.revision } : {}) } };
      if (outcome.code === "not_found") return { result: { ok: false, code: "not_found", message: messages.denied } };
      return { result: { ok: false, code: "invalid", message: outcome.message ?? messages.error } };
    }

    if (outcome.previousMediaIds.length > 0) await deps.release(user.id, event.id, outcome.previousMediaIds);
    const meta = await deps.getMeta(user.id, event.id);
    const publication: PublicationInfo = meta?.publication ?? toPublicationInfo({ status: "PUBLISHED", draftRevision: outcome.revision, publishedRevision: outcome.revision, publishedVersion: outcome.version });
    return {
      result: { ok: true, version: outcome.version, publication, revision: outcome.revision, alreadyPublished: outcome.alreadyPublished },
      ...(outcome.alreadyPublished ? {} : { revalidate: { eventId: event.id, slug: outcome.slug } }),
    };
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { result: { ok: false, code: "unavailable", message: messages.unavailable } };
    logger.error("publish.failed", error);
    return { result: { ok: false, code: "error", message: messages.error } };
  }
}
