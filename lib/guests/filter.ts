import type { GuestFilters, GuestRow, GuestStatus, GuestStatusFilter, GuestStatusGroup, GuestSummary } from "@/types/guests";

/**
 * Lógica pura del Guest Manager (sin React ni acceso a datos): la usan el servidor (filtrado por
 * `searchParams`) y las pruebas. "Tal vez" cuenta como Pendiente (CLAUDE.md decisión 8).
 */
export const statusGroupOf = (status: GuestStatus): GuestStatusGroup => (status === "ATTENDING" ? "confirmed" : status === "DECLINED" ? "declined" : "pending");

export const EMPTY_FILTERS: GuestFilters = { q: "", status: "all", group: "" };

/** Quita tildes y pasa a minúsculas para buscar sin distinguirlas ("Mendez" encuentra "Méndez"). */
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digits = (text: string) => text.replace(/\D/g, "");

/** Búsqueda por nombre, email y teléfono (este último solo por dígitos, para ignorar espacios y guiones). */
export function matchesSearch(guest: Pick<GuestRow, "name" | "email" | "phone">, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  if (fold(guest.name).includes(q) || fold(guest.email ?? "").includes(q)) return true;
  const qDigits = digits(q);
  return qDigits.length >= 3 && digits(guest.phone ?? "").includes(qDigits);
}

export function filterGuests(guests: readonly GuestRow[], filters: GuestFilters): GuestRow[] {
  return guests.filter((guest) => {
    if (filters.status !== "all" && guest.statusGroup !== filters.status) return false;
    if (filters.group === "none" ? guest.groupId !== null : filters.group !== "" && guest.groupId !== filters.group) return false;
    return matchesSearch(guest, filters.q);
  });
}

/** Métricas derivadas de los invitados actuales (no se guardan). */
export function summarizeGuests(guests: readonly Pick<GuestRow, "statusGroup" | "maxCompanions">[]): GuestSummary {
  const summary: GuestSummary = { total: guests.length, confirmed: 0, pending: 0, declined: 0, potentialCompanions: 0 };
  for (const guest of guests) {
    summary[guest.statusGroup] += 1;
    summary.potentialCompanions += guest.maxCompanions;
  }
  return summary;
}

const STATUS_FILTERS: readonly GuestStatusFilter[] = ["all", "confirmed", "pending", "declined"];

/** Lee `?q=&status=&group=` (valores desconocidos se ignoran). */
export function parseGuestFilters(params: Record<string, string | string[] | undefined>, groupIds: readonly string[]): GuestFilters {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const status = one(params.status);
  const group = one(params.group);
  return {
    q: one(params.q).slice(0, 100),
    status: (STATUS_FILTERS as readonly string[]).includes(status) ? (status as GuestStatusFilter) : "all",
    group: group === "none" || groupIds.includes(group) ? group : "",
  };
}

/** Filtros → query string (solo lo que difiere del valor por defecto). */
export function guestFiltersToSearch(filters: GuestFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.group) params.set("group", filters.group);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function hasActiveFilters(filters: GuestFilters): boolean {
  return Boolean(filters.q.trim()) || filters.status !== "all" || filters.group !== "";
}
