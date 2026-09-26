import { notFound, redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getOrCreateCurrentUser } from "@/server/auth/current-user";
import { getOwnedEventByRef } from "@/server/repositories/events";
import type { AppUser } from "@/server/services/user-sync";
import type { EventSummary } from "@/types/event";

/**
 * ÚNICA estrategia de propiedad: sesión + evento del usuario. `ref` es el id, el slug o el alias `demo`.
 * Un evento inexistente y un evento AJENO producen exactamente lo mismo (`not_found`): no se revela que
 * existe. Toda consulta privada por id debe pasar por aquí o por una función `getOwned*` (CLAUDE.md).
 *  - `resolveOwnedEvent`: devuelve el resultado (para las Server Actions, que responden con datos).
 *  - `requireOwnedEvent`: para las páginas (redirige o `notFound()`).
 */
export type OwnedEventResolution =
  | { status: "ok"; user: AppUser; event: EventSummary }
  | { status: "unauthenticated" }
  | { status: "not_found" };

export async function resolveOwnedEvent(ref: string): Promise<OwnedEventResolution> {
  const user = await getOrCreateCurrentUser();
  if (!user) return { status: "unauthenticated" };
  const event = await getOwnedEventByRef(user.id, ref);
  return event ? { status: "ok", user, event } : { status: "not_found" };
}

export async function requireOwnedEvent(ref: string): Promise<{ user: AppUser; event: EventSummary }> {
  const resolution = await resolveOwnedEvent(ref);
  if (resolution.status === "unauthenticated") redirect(routes.signIn);
  if (resolution.status === "not_found") notFound();
  return { user: resolution.user, event: resolution.event };
}
