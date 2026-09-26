import { DEMO_EVENT_ALIAS } from "@/lib/dashboard/demo-alias";
import { routes } from "@/lib/routes";

/**
 * Navegación lateral del panel (mockup 05). Cada elemento apunta a una ruta que EXISTE (páginas
 * reales o marcadores coherentes): la navegación visible nunca lleva a un 404. Las secciones del
 * evento usan el evento de la ruta actual y, fuera de un evento, el alias `demo` (que redirige).
 */
export type DashboardNavIcon = "events" | "templates" | "guests" | "rsvp" | "messages" | "settings";

export interface DashboardNavItem {
  id: DashboardNavIcon;
  label: string;
  href: string;
  /** Rutas (prefijos) en las que el elemento está activo. */
  match: readonly string[];
}

/**
 * `eventId`: el evento de la ruta actual; `undefined` = alias demo (solo desarrollo y pruebas); `null` =
 * el usuario no tiene eventos, así que se omiten las secciones que dependen de un evento (nunca un enlace muerto).
 */
export function getDashboardNav(eventId: string | null = DEMO_EVENT_ALIAS): readonly DashboardNavItem[] {
  const general: DashboardNavItem[] = [
    // "Mis eventos" también está activo dentro del panel de un evento (mockup 05).
    { id: "events", label: "Mis eventos", href: routes.events, match: [routes.events] },
    { id: "templates", label: "Plantillas", href: routes.templates, match: [routes.templates] },
  ];
  if (eventId === null) return general;
  return [
    ...general,
    { id: "guests", label: "Lista de invitados", href: routes.eventGuests(eventId), match: [routes.eventGuests(eventId)] },
    { id: "rsvp", label: "Confirmaciones", href: routes.eventRsvp(eventId), match: [routes.eventRsvp(eventId)] },
    { id: "messages", label: "Mensajes", href: routes.eventMessages(eventId), match: [routes.eventMessages(eventId)] },
    { id: "settings", label: "Configuración", href: routes.eventSettings(eventId), match: [routes.eventSettings(eventId)] },
  ];
}

/** Id o slug del evento en una ruta `/dashboard/events/[id]/…` (`undefined` fuera de un evento). */
export function getEventRefFromPath(pathname: string | null): string | undefined {
  const match = pathname ? /^\/dashboard\/events\/([^/]+)/.exec(pathname) : null;
  // `/dashboard/events/new` es el alta de un evento, no un evento.
  return match?.[1] === "new" ? undefined : match?.[1];
}

/** ¿El elemento está activo en esta ruta? Las secciones específicas ganan a "Mis eventos". */
export function getActiveNavId(pathname: string | null, items: readonly DashboardNavItem[]): DashboardNavIcon | undefined {
  if (!pathname) return undefined;
  const specific = items.filter((item) => item.id !== "events").find((item) => item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
  if (specific) return specific.id;
  return pathname === routes.events || pathname.startsWith(`${routes.events}/`) ? "events" : undefined;
}
