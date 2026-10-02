import { getTemplateStyles } from "@/lib/templates/filter";
import { isTemplateReady } from "@/lib/templates/status";
import type { Template } from "@/types/templates";

/**
 * Plantillas relacionadas ("Otros diseños que podrían gustarte", mockup 03): misma categoría de
 * evento primero, después las que comparten estilo. A igual puntuación se respeta el orden del
 * catálogo. Nunca incluye la propia plantilla. Solo sugiere plantillas listas (`isTemplateReady`,
 * la misma regla que el catálogo público `/templates`): no tiene sentido recomendar un diseño sin
 * aprobar, ni siquiera desde la página de detalle de otro diseño sin aprobar. Si quedan menos de
 * `limit` listas (o ninguna), devuelve menos tarjetas o una lista vacía — `RelatedTemplates` ya
 * oculta la sección entera cuando está vacía. Función pura: sirve igual con datos de la BD.
 */
export function getRelatedTemplates(template: Template, catalog: readonly Template[], limit = 3): Template[] {
  const styles = getTemplateStyles(template);
  const score = (candidate: Template) =>
    (candidate.eventType === template.eventType ? 2 : 0) +
    (getTemplateStyles(candidate).some((style) => styles.includes(style)) ? 1 : 0);

  return catalog
    .filter((candidate) => candidate.id !== template.id && isTemplateReady(candidate))
    .map((candidate, index) => ({ candidate, index, score: score(candidate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
