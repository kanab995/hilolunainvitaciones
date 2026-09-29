import { adminCopy } from "@/lib/admin/copy";
import { routes } from "@/lib/routes";

/**
 * Navegación lateral de la consola (D-33). Todas las rutas EXISTEN: la navegación visible nunca lleva a un 404.
 * El elemento activo sale de la ruta actual (las páginas de detalle activan su lista).
 */
export type AdminNavId = "overview" | "users" | "events" | "templates" | "purchases" | "webhooks" | "emails" | "audit";

export interface AdminNavItem {
  id: AdminNavId;
  label: string;
  href: string;
}

export const adminNav: readonly AdminNavItem[] = [
  { id: "overview", label: adminCopy.nav.overview, href: routes.admin },
  { id: "users", label: adminCopy.nav.users, href: routes.adminUsers },
  { id: "events", label: adminCopy.nav.events, href: routes.adminEvents },
  { id: "templates", label: adminCopy.nav.templates, href: routes.adminTemplates },
  { id: "purchases", label: adminCopy.nav.purchases, href: routes.adminPurchases },
  { id: "webhooks", label: adminCopy.nav.webhooks, href: routes.adminWebhooks },
  { id: "emails", label: adminCopy.nav.emails, href: routes.adminEmails },
  { id: "audit", label: adminCopy.nav.audit, href: routes.adminAudit },
];

export function getActiveAdminNavId(pathname: string | null): AdminNavId | undefined {
  if (!pathname) return undefined;
  if (pathname === routes.admin) return "overview";
  return adminNav.filter((item) => item.id !== "overview").find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.id;
}
