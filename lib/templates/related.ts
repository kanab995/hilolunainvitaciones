import { getTemplateStyles } from "@/lib/templates/filter";
import type { Template } from "@/types/templates";

/**
 * Plantillas relacionadas ("Otros diseños que podrían gustarte", mockup 03): misma categoría de
 * evento primero, después las que comparten estilo. A igual puntuación se respeta el orden del
 * catálogo. Nunca incluye la propia plantilla. Función pura: sirve igual con datos de la BD.
 */
export function getRelatedTemplates(template: Template, catalog: readonly Template[], limit = 3): Template[] {
  const styles = getTemplateStyles(template);
  const score = (candidate: Template) =>
    (candidate.eventType === template.eventType ? 2 : 0) +
    (getTemplateStyles(candidate).some((style) => styles.includes(style)) ? 1 : 0);

  return catalog
    .filter((candidate) => candidate.id !== template.id)
    .map((candidate, index) => ({ candidate, index, score: score(candidate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
