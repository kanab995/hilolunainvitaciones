/**
 * SLUGS (docs/ROUTES.md §2): minúsculas, `a-z0-9-`, 3–60 caracteres, sin guiones al inicio/fin ni dobles.
 * Lógica pura y probada: normaliza (sin acentos ni caracteres inseguros), propone una base a partir de los
 * nombres y elige un sufijo libre (`-2`, `-3`…) entre los ya ocupados. La unicidad DEFINITIVA la decide el
 * índice único de la base de datos (el servicio reintenta si otra petición ganó la carrera).
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

/** Prefijo de las invitaciones de demostración de plantillas (`/i/demo-<plantilla>`): ningún slug real lo usa. */
const RESERVED_PREFIX = "demo-";

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Recorta a `max` sin dejar un guion al final. */
const clip = (slug: string, max: number) => slug.slice(0, max).replace(/-+$/g, "");

/** Base de un slug: normalizada, acotada, de al menos 3 caracteres y sin el prefijo reservado. */
export function slugBase(text: string, fallback: string, reserve = 0): string {
  let slug = clip(slugify(text), SLUG_MAX - reserve);
  if (slug.length < SLUG_MIN) slug = clip(`${slug}-${fallback}`.replace(/^-+/, ""), SLUG_MAX - reserve);
  if (slug.startsWith(RESERVED_PREFIX) || slug === "demo") slug = `mi-${slug}`;
  return slug;
}

/** Slug del EVENTO (referencia del panel): los nombres unidos con guion. "Andrea & Fernando" → "andrea-fernando". */
export function eventSlugBase(title: string): string {
  return slugBase(title, "evento", 4);
}

/** Slug PÚBLICO de la invitación (`/i/[slug]`): pareja → "andrea-y-fernando"; un nombre → ese nombre. */
export function invitationSlugBase(names: readonly string[]): string {
  const clean = names.map((name) => slugify(name)).filter(Boolean);
  return slugBase(clean.join("-y-"), "invitacion", 4);
}

/** Primer slug libre a partir de `base`: `base`, `base-2`, `base-3`… Respeta el largo máximo. */
export function pickUniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${clip(base, SLUG_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("No se pudo generar un slug libre.");
}

export const isValidSlug = (slug: string): boolean => slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
