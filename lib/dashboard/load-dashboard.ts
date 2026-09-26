import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/current-user";
import { getOwnedDashboardData } from "@/server/repositories/dashboard";
import type { EventDashboardData } from "@/types/dashboard";

/**
 * Carga de una página del panel de un evento: exige SESIÓN y PROPIEDAD. Un evento inexistente y uno
 * ajeno responden igual (`notFound()`): nunca se revela que existe. `ref` puede ser el id, el slug o
 * el alias `demo` (solo fuera de producción); si no es el id canónico se redirige a la misma sección
 * con el id (`pathFor`), de modo que los enlaces antiguos siguen funcionando.
 */
export async function loadDashboardPage(ref: string, pathFor: (eventId: string) => string): Promise<EventDashboardData> {
  const user = await requireAuth();
  const data = await getOwnedDashboardData(user.id, ref);
  if (!data) notFound();
  if (data.event.id !== ref) redirect(pathFor(data.event.id));
  return data;
}
