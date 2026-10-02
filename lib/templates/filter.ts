import { categoryFilters } from "@/lib/content/templates";
import type { EventCategoryId } from "@/types/marketing";
import type { Template, TemplateFilterState, TemplateStyleId } from "@/types/templates";

/** Lógica pura de la galería: sin React ni acceso a datos (reutilizable en servidor y cliente). */

const eventTypeIds: readonly string[] = ["wedding", "quinceanera", "baptism", "birthday", "baby-shower", "kids"];

/** Todos los estilos de una plantilla: el principal y los adicionales. */
export function getTemplateStyles(template: Template): TemplateStyleId[] {
  return [template.style, ...(template.secondaryStyles ?? [])];
}

/** Estilos presentes en el catálogo, en orden de aparición. */
export function getAvailableStyles(catalog: readonly Template[]): TemplateStyleId[] {
  return [...new Set(catalog.flatMap(getTemplateStyles))];
}

/** ¿La plantilla pertenece a la categoría? Un chip puede agrupar varios tipos de evento y estilos. */
function matchesCategory(template: Template, category: EventCategoryId): boolean {
  const filter = categoryFilters.find((item) => item.id === category);
  if (!filter) return template.eventType === category;
  return (
    filter.eventTypes.includes(template.eventType) ||
    (filter.styles?.some((style) => getTemplateStyles(template).includes(style)) ?? false)
  );
}

export function filterTemplates(catalog: readonly Template[], { category, style }: TemplateFilterState): Template[] {
  return catalog.filter(
    (template) => (!category || matchesCategory(template, category)) && (!style || getTemplateStyles(template).includes(style)),
  );
}

/**
 * Lee `?category=` y `?style=` (docs/ROUTES.md §5). Los valores desconocidos se ignoran.
 * "kids" y "baby-shower" son válidos aunque hoy no tenga ninguna plantilla: dan el estado sin
 * resultados hasta que exista una.
 */
export function parseTemplateFilters(
  params: { get(name: string): string | null },
  catalog: readonly Template[],
): TemplateFilterState {
  const category = params.get("category");
  const style = params.get("style");
  const styles: readonly string[] = getAvailableStyles(catalog);
  return {
    category: category !== null && eventTypeIds.includes(category) ? (category as EventCategoryId) : null,
    style: style !== null && styles.includes(style) ? (style as TemplateStyleId) : null,
  };
}

/** Serializa los filtros a query string (sin `?`); vacío si no hay filtros. */
export function serializeTemplateFilters({ category, style }: TemplateFilterState): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (style) params.set("style", style);
  return params.toString();
}
