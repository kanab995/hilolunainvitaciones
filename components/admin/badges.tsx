import { Badge } from "@/components/ui/badge";
import { adminCopy } from "@/lib/admin/copy";
import type { TemplatePublicationValue } from "@/lib/admin/options";
import type { UserRoleId } from "@/lib/admin/roles";
import { planLabel, type PlanId } from "@/lib/billing/plans";
import type { EventAccessState, PurchaseKindId, PurchaseStatusId } from "@/lib/billing/purchase";
import type { PublicationState } from "@/types/published";

/**
 * Etiquetas de estado de la consola. El estado SIEMPRE lleva texto (el punto de color es un refuerzo, nunca el único indicio), y los tonos
 * son los del sistema de diseño (`Badge`).
 */
export function PlanBadge({ plan }: { plan: PlanId }) {
  return (
    <Badge tone={plan === "PREMIUM" ? "ink" : plan === "ESSENTIAL" ? "accent" : "neutral"} data-plan={plan}>
      {planLabel(plan)}
    </Badge>
  );
}

const purchaseTone: Record<PurchaseStatusId, "success" | "pending" | "declined" | "neutral"> = { PAID: "success", PENDING: "pending", FAILED: "declined", REFUNDED: "declined", CANCELED: "neutral" };

export function PurchaseStatusBadge({ status }: { status: PurchaseStatusId }) {
  return (
    <Badge tone={purchaseTone[status]} dot data-purchase-status={status}>
      {adminCopy.purchases.statusLabel[status]}
    </Badge>
  );
}

export function PurchaseKindBadge({ kind }: { kind: PurchaseKindId }) {
  return (
    <Badge tone="outline" data-purchase-kind={kind}>
      {adminCopy.purchases.kindLabel[kind]}
    </Badge>
  );
}

const publicationTone: Record<PublicationState, "success" | "pending" | "neutral"> = { published: "success", changes: "pending", draft: "neutral" };

export function PublicationBadge({ state }: { state: PublicationState }) {
  return (
    <Badge tone={publicationTone[state]} dot data-publication={state}>
      {adminCopy.publication[state]}
    </Badge>
  );
}

const accessLabel: Record<EventAccessState, string> = { active: adminCopy.events.accessActive, expired: adminCopy.events.accessExpired, free: adminCopy.events.accessFree };
const accessTone: Record<EventAccessState, "success" | "declined" | "neutral"> = { active: "success", expired: "declined", free: "neutral" };

export function AccessBadge({ state }: { state: EventAccessState }) {
  return (
    <Badge tone={accessTone[state]} dot data-access={state}>
      {accessLabel[state]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: UserRoleId }) {
  return (
    <Badge tone={role === "ADMIN" ? "ink" : "neutral"} data-role={role}>
      {adminCopy.roles[role]}
    </Badge>
  );
}

const visibilityTone: Record<TemplatePublicationValue, "success" | "neutral" | "declined"> = { PUBLISHED: "success", DRAFT: "neutral", ARCHIVED: "declined" };

export function TemplateVisibilityBadge({ status }: { status: TemplatePublicationValue }) {
  return (
    <Badge tone={visibilityTone[status]} dot data-visibility={status}>
      {adminCopy.templates.publicationShort[status]}
    </Badge>
  );
}
