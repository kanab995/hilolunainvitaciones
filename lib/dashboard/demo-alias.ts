/**
 * Alias histórico de la ruta demo: `/dashboard/events/demo`. Se resuelve internamente al evento del
 * seed y las páginas redirigen a la URL canónica (`/dashboard/events/[id]`). Módulo puro (sin acceso
 * a datos): lo importan también componentes de cliente.
 */
export const DEMO_EVENT_ALIAS = "demo";
