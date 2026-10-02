import { isTemplateReady } from "@/lib/templates/status";
import type { Template } from "@/types/templates";

/** Cuántas tarjetas muestra como máximo la sección de destacadas de la home. */
const DEFAULT_LIMIT = 8;

/**
 * Plantillas destacadas de la home ("Plantillas que se sienten como tu evento"): se calculan aquí,
 * no se hardcodean en `lib/content/home.ts` — agregar una plantilla nueva (`isTemplateReady`) es
 * suficiente para que aparezca, sin tocar la home.
 *
 * No existe hoy un campo `featured`/`homepageOrder` en `Template` (ni en el catálogo ni en la BD):
 * no se agrega uno nuevo sin necesidad (CLAUDE.md regla 19) porque el catálogo YA tiene una señal de
 * prioridad manual — el orden del array (`sortOrder` una vez en BD) — y es exactamente lo que
 * `buildTemplateRows()`/`upsertTemplates()` ya usan para todo lo demás. Si en el futuro se necesita
 * curar la home de forma distinta al orden del catálogo (p. ej. "Baby Bloom primero aunque sea más
 * nueva"), la forma mínima de hacerlo es agregar ese campo entonces — no antes.
 *
 * Algoritmo: 1) filtra a `isTemplateReady` (nunca concept/comingSoon/sin publicar). 2) una primera
 * pasada toma como máximo una plantilla por `eventType`, en orden de catálogo, para no repetir
 * categoría de más (Bodas, Cumpleaños, XV años, Bautizo, Infantil, Baby Shower si hay variedad
 * disponible); 3) completa los huecos restantes con el resto, también en orden de catálogo, hasta
 * `limit`. Con las plantillas listas de hoy (una o dos por categoría) esto no recorta nada: muestra
 * las mismas que listar por orden de catálogo, solo que si una categoría tiene más de una plantilla
 * lista, la segunda pasa al final en vez de ocupar el lugar de una categoría todavía sin representar.
 */
export function getFeaturedTemplates(catalog: readonly Template[], limit = DEFAULT_LIMIT): Template[] {
  const ready = catalog.filter(isTemplateReady);
  const seenCategories = new Set<string>();
  const firstPass: Template[] = [];
  const rest: Template[] = [];
  for (const template of ready) {
    if (seenCategories.has(template.eventType)) {
      rest.push(template);
    } else {
      seenCategories.add(template.eventType);
      firstPass.push(template);
    }
  }
  return [...firstPass, ...rest].slice(0, limit);
}
