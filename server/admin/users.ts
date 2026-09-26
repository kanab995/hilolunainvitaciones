import { pageWindow } from "@/lib/admin/query";
import { getEffectiveEventPlan } from "@/lib/billing/purchase";
import { derivePublicationState } from "@/lib/publishing/state";
import type { AdminPageDto, AdminUserDetailDto, AdminUserListItemDto } from "@/server/admin/dto";
import { toPurchaseLine } from "@/server/admin/purchases";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * USUARIOS EN LA CONSOLA (D-33): lectura. No hay «plan del usuario» (los planes son por evento): el detalle lista sus eventos con el plan
 * efectivo de cada uno (`getEffectiveEventPlan`, la misma función que usa el producto). Sin secretos, sin contraseñas, sin tokens de invitación,
 * sin el id de Clerk (solo si está vinculado) y sin datos de tarjeta. El rol se muestra pero NO se puede cambiar desde la interfaz.
 */
export async function listAdminUsers(_admin: AdminUser, filters: { page: number; q?: string | undefined; sort: repo.ListSort; pageSize?: number }): Promise<AdminPageDto<AdminUserListItemDto>> {
  const { page, pageSize, ...where } = filters;
  const total = await repo.countUsers(where);
  const window = pageWindow(page, total, pageSize);
  const rows = await repo.listUsers({ ...where, skip: window.skip, take: window.take });
  return { rows: rows.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.createdAt, eventCount: row.eventCount, paidEventCount: row.paidEventCount })), window };
}

export async function getAdminUser(_admin: AdminUser, id: string): Promise<AdminUserDetailDto | null> {
  const row = await repo.findUser(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    clerkLinked: row.clerkLinked,
    hasBillingCustomer: row.hasBillingCustomer,
    createdAt: row.createdAt,
    eventCount: row.eventCount,
    events: row.events.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      plan: getEffectiveEventPlan(event.purchases),
      publication: event.publication ? derivePublicationState(event.publication) : "draft",
      purchases: event.purchases.map(toPurchaseLine),
    })),
  };
}
