import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isCurrentUserAdmin } from "@/server/auth/admin";
import { requireAuth } from "@/server/auth/current-user";
import { getAuthMode } from "@/server/auth/mode";
import { listOwnedEvents } from "@/server/repositories/events";

/**
 * Marco del panel. Exige sesión (`requireAuth`); la comprobación de PROPIEDAD de cada evento la hace
 * cada página, porque los layouts no se vuelven a ejecutar al navegar entre páginas hijas.
 */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  const name = user.name?.trim() || user.email.split("@")[0] || user.email;
  // Las secciones del evento (invitados, confirmaciones…) apuntan al primer evento del usuario; sin eventos no se muestran.
  const [[firstEvent], isAdmin] = await Promise.all([listOwnedEvents(user.id), isCurrentUserAdmin()]);
  return (
    <DashboardShell user={{ name, email: user.email }} canSignOut={getAuthMode() === "clerk"} defaultEventId={firstEvent?.id ?? null} isAdmin={isAdmin}>
      {children}
    </DashboardShell>
  );
}
