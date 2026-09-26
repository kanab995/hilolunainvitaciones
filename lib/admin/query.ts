/**
 * PARÁMETROS DE BÚSQUEDA de las listas de la consola (`?page=&q=&status=&plan=…`). Lógica pura: lo que llega en la URL es entrada del
 * usuario, así que se valida contra listas blancas y se acota (página, longitud del texto) ANTES de llegar a una consulta. Un valor
 * desconocido se ignora (nunca se usa tal cual).
 */
export type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export const ADMIN_PAGE_SIZE = 25;
const MAX_PAGE = 10_000;
const MAX_SEARCH_LENGTH = 80;

export const firstParam = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export function parsePage(raw: string | string[] | undefined): number {
  const value = Number.parseInt(firstParam(raw) ?? "", 10);
  return Number.isInteger(value) && value >= 1 ? Math.min(value, MAX_PAGE) : 1;
}

/** Texto de búsqueda recortado y acotado; vacío → `undefined`. */
export function parseSearch(raw: string | string[] | undefined): string | undefined {
  const value = firstParam(raw)?.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
  return value ? value : undefined;
}

/** Valor de una lista blanca (`undefined` si no es uno de los permitidos). */
export function parseChoice<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const value = firstParam(raw);
  return allowed.find((option) => option === value);
}

export interface PageWindow {
  page: number;
  pageSize: number;
  pageCount: number;
  skip: number;
  take: number;
  total: number;
}

/** Ventana de paginación de servidor: la página pedida se acota al rango real (una página fuera de rango muestra la última). */
export function pageWindow(requestedPage: number, total: number, pageSize: number = ADMIN_PAGE_SIZE): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  return { page, pageSize, pageCount, skip: (page - 1) * pageSize, take: pageSize, total };
}

/** Enlace de una lista con sus filtros: omite los vacíos y la página 1 (URL canónica). */
export function adminHref(path: string, params: Readonly<Record<string, string | number | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
