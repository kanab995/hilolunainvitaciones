import type { EventCategoryId } from "@/types/marketing";

/** Resumen de un evento persistido (lo que necesitan las páginas sin cargar la invitación). */
export interface EventSummary {
  id: string;
  /** Referencia legible y única (`/dashboard/events/[id|slug]`). */
  slug: string;
  title: string;
  type: EventCategoryId;
  status: "draft" | "active" | "archived";
  /** ISO 8601 con el desfase de la zona del evento. Fuente canónica de la fecha (`Event.startsAt`). */
  startsAt: string;
  timezone: string;
}
