import { getInvitationTemplate } from "@/lib/invitation/templates";
import { buildPublishedInvitationSnapshot } from "@/lib/publishing/snapshot";
import { validatePublishable } from "@/lib/publishing/validate";
import { publishOwnedInvitation, type PublishBuild, type PublishOutcome } from "@/server/repositories/publishing";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * NÚCLEO de la publicación (D-29), SIN sesión: valida el mínimo publicable, construye el snapshot (función pura)
 * y lo escribe en una transacción. Lo usan `publishInvitationForOwner` (con sesión y propiedad) y el seed (que
 * publica la demostración sin sesión, de forma idempotente). Las dependencias son inyectables.
 */
export interface PublishCoreDeps {
  publish: (userId: string, eventId: string, expectedRevision: number | undefined, build: PublishBuild) => Promise<PublishOutcome>;
  templateConfig: (slug: string) => InvitationTemplate | undefined;
}

export const defaultPublishCoreDeps: PublishCoreDeps = { publish: publishOwnedInvitation, templateConfig: getInvitationTemplate };

export function publishOwnedEvent(userId: string, eventId: string, expectedRevision: number | undefined, deps: PublishCoreDeps = defaultPublishCoreDeps): Promise<PublishOutcome> {
  return deps.publish(userId, eventId, expectedRevision, ({ invitation, assets, templateOk, version, publishedAt }) => {
    const template = deps.templateConfig(invitation.templateSlug);
    const issues = validatePublishable(invitation, templateOk && template !== undefined);
    if (issues.length > 0 || !template) return { ok: false, message: issues.map((issue) => issue.message).join(" ") };
    return { ok: true, ...buildPublishedInvitationSnapshot({ invitation, template, assets, version, publishedAt }) };
  });
}
