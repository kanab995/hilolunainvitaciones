import type { InvitationSection } from "@/types/invitation";

/**
 * Operaciones PURAS sobre listas del borrador. Nunca mutan la entrada: devuelven una copia (o la
 * misma referencia si no hay nada que cambiar, para no provocar renders ni autoguardados inútiles).
 */

export interface WithId {
  id: string;
}

export type Direction = "up" | "down";

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return next;
  next.splice(to, 0, item);
  return next;
}

/** Sube o baja un elemento una posición. Sin cambio si ya está en el límite o no existe. */
export function moveById<T extends WithId>(list: readonly T[], id: string, direction: Direction): readonly T[] {
  const from = list.findIndex((item) => item.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= list.length) return list;
  return moveItem(list, from, to);
}

/** Lleva un elemento a una posición concreta (arrastrar y soltar). */
export function reorderById<T extends WithId>(list: readonly T[], id: string, toIndex: number): readonly T[] {
  const from = list.findIndex((item) => item.id === id);
  if (from < 0) return list;
  const to = Math.max(0, Math.min(list.length - 1, toIndex));
  return to === from ? list : moveItem(list, from, to);
}

export function removeById<T extends WithId>(list: readonly T[], id: string): readonly T[] {
  return list.some((item) => item.id === id) ? list.filter((item) => item.id !== id) : list;
}

export function patchById<T extends WithId>(list: readonly T[], id: string, patch: Partial<Omit<T, "id">>): readonly T[] {
  return list.some((item) => item.id === id) ? list.map((item) => (item.id === id ? { ...item, ...patch } : item)) : list;
}

/* ───────── Secciones ───────── */

/**
 * La portada va siempre primera y el cierre siempre último: son el principio y el final de la
 * experiencia (docs/ARCHITECTURE.md §4.10). Las demás se pueden ordenar libremente entre ambas.
 * Decisión de UX: aunque el renderizador técnicamente admitiría otro orden, una invitación que no
 * abre con su portada rompe el botón "Abrir invitación".
 */
export function isPinnedSection(section: Pick<InvitationSection, "type">): boolean {
  return section.type === "hero" || section.type === "footer";
}

/** Rango de posiciones en las que puede vivir una sección movible: entre la portada y el cierre. */
function movableRange(sections: readonly InvitationSection[]): { min: number; max: number } {
  const min = sections[0] && isPinnedSection(sections[0]) && sections[0].type === "hero" ? 1 : 0;
  const last = sections[sections.length - 1];
  const max = last && last.type === "footer" ? sections.length - 2 : sections.length - 1;
  return { min, max };
}

export function canMoveSection(sections: readonly InvitationSection[], id: string, direction: Direction): boolean {
  const index = sections.findIndex((section) => section.id === id);
  const section = sections[index];
  if (!section || isPinnedSection(section)) return false;
  const { min, max } = movableRange(sections);
  return direction === "up" ? index > min : index < max;
}

export function moveSection(sections: readonly InvitationSection[], id: string, direction: Direction): readonly InvitationSection[] {
  return canMoveSection(sections, id, direction) ? moveById(sections, id, direction) : sections;
}

/** Arrastrar y soltar: la posición se limita al rango movible (nunca antes de la portada ni tras el cierre). */
export function dropSection(sections: readonly InvitationSection[], id: string, toIndex: number): readonly InvitationSection[] {
  const section = sections.find((item) => item.id === id);
  if (!section || isPinnedSection(section)) return sections;
  const { min, max } = movableRange(sections);
  return reorderById(sections, id, Math.max(min, Math.min(max, toIndex)));
}
