import { pageWindow } from "@/lib/admin/query";
import { getEffectiveEventPlan, getEventAccessState, isEventAccessActive } from "@/lib/billing/purchase";
import type { PlanId } from "@/lib/billing/plans";
import { getServerNow } from "@/lib/invitation/server-time";
import { derivePublicationState } from "@/lib/publishing/state";
import type { PublicationState } from "@/types/published";
import type { AdminEventDetailDto, AdminEventListItemDto, AdminPageDto } from "@/server/admin/dto";
import { toPurchaseLine } from "@/server/admin/purchases";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * EVENTOS EN LA CONSOLA (D-33). El plan efectivo NO se guarda ni se calcula con una lógica propia de la consola: sale de las compras del
 * evento con `getEffectiveEventPlan`, y el estado del acceso, de `getEventAccessState` / `isEventAccessActive` (las mismas funciones del producto).
 * MÍNIMO NECESARIO: de los invitados solo se ven CONTEOS y el resumen de confirmaciones; nunca correos, teléfonos, mensajes, respuestas ni
 * enlaces personalizados. La consola solo lee: no modifica el contenido de los clientes.
 */
export interface EventFilters {
  q?: string | undefined;
  publication?: PublicationState | undefined;
  type?: repo.EventsQuery["type"] | undefined;
  plan?: PlanId | undefined;
  sort: repo.EventSort;
}

export async function listAdminEvents(_admin: AdminUser, filters: EventFilters & { page: number; pageSize?: number }): Promise<AdminPageDto<AdminEventListItemDto>> {
  const { page, pageSize, ...where } = filters;
  const total = await repo.countEvents(where);
  const window = pageWindow(page, total, pageSize);
  const rows = await repo.listEvents({ ...where, skip: window.skip, take: window.take });
  return {
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      owner: { id: row.owner.id, name: row.owner.name, email: row.owner.email },
      template: row.template,
      plan: getEffectiveEventPlan(row.purchases),
      publication: row.publication ? derivePublicationState(row.publication) : "draft",
      startsAt: row.startsAt,
      createdAt: row.createdAt,
    })),
    window,
  };
}

export async function getAdminEvent(_admin: AdminUser, id: string, now: Date = new Date(getServerNow())): Promise<AdminEventDetailDto | null> {
  const row = await repo.findEvent(id);
  if (!row) return null;

  const plan = getEffectiveEventPlan(row.purchases);
  const access = { plan, paidAccessEndsAt: row.paidAccessEndsAt, now };
  const countOf = (...statuses: string[]) => row.guestStatus.filter((item) => statuses.includes(item.status)).reduce((sum, item) => sum + item.count, 0);

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    owner: { id: row.owner.id, name: row.owner.name, email: row.owner.email },
    startsAt: row.startsAt,
    timezone: row.timezone,
    invitationSlug: row.invitation?.slug ?? null,
    template: row.invitation?.template ?? null,
    publication: row.invitation ? derivePublicationState(row.invitation.columns) : "draft",
    publishedVersion: row.invitation?.columns.publishedVersion ?? 0,
    plan,
    paidAccessEndsAt: row.paidAccessEndsAt,
    accessState: getEventAccessState(access),
    accessActive: isEventAccessActive(access),
    guestCount: row.counts.guests,
    // «Tal vez» cuenta como pendiente (CLAUDE.md, decisión 8).
    rsvp: { received: row.counts.rsvps, confirmed: countOf("ATTENDING"), declined: countOf("DECLINED"), pending: countOf("PENDING", "MAYBE") },
    galleryCount: row.counts.galleryImages,
    mediaCount: row.counts.mediaAssets,
    mediaBytes: row.counts.mediaBytes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    purchases: row.purchases.map(toPurchaseLine),
  };
}
