import versions from "@/lib/images/asset-versions.json";

/**
 * Versionado de las imágenes estáticas de las plantillas (`public/templates/<slug>/**`), D-45.
 *
 * Las URLs de esas imágenes no cambian cuando se reemplaza el archivo (mismo nombre), y el optimizador
 * de imágenes de Next guarda cada variante durante `minimumCacheTTL` (4 h por defecto; sin forma de
 * invalidarla): tras sustituir un asset, el desarrollo local y Vercel seguían sirviendo la versión
 * anterior. Con `?v=<huella del contenido de la carpeta>` la URL cambia cuando cambia cualquier archivo
 * de esa plantilla, así que no hay nada que invalidar a mano. La huella sale de
 * `lib/images/asset-versions.json` (`scripts/asset-versions.mjs`, que corren `predev` y `prebuild`, y que
 * `tests/images/asset-versions.test.ts` comprueba). Es por carpeta, no por archivo, porque
 * `images.localPatterns` admite 25 entradas como máximo y compara la query de forma exacta.
 */
const TABLE: Readonly<Record<string, string>> = versions;

/** Carpeta de plantilla de una ruta (`/templates/luz-de-fe/cover-bg.png` → `/templates/luz-de-fe`). */
function templateFolder(src: string): string | undefined {
  const match = /^\/templates\/[^/?#]+(?=\/)/.exec(src);
  return match?.[0];
}

/** `/templates/x/y.png` → `/templates/x/y.png?v=ab12cd34ef`. Cualquier otra fuente (R2, marca, blob:) pasa igual. */
export function withAssetVersion(src: string, table: Readonly<Record<string, string>> = TABLE): string {
  if (src.includes("?")) return src;
  const folder = templateFolder(src);
  const version = folder ? table[folder] : undefined;
  return version ? `${src}?v=${version}` : src;
}

/** Una entrada de `images.localPatterns` por carpeta de plantilla (coincidencia EXACTA de la query). */
export function versionedAssetPatterns(table: Readonly<Record<string, string>> = TABLE): { pathname: string; search: string }[] {
  return Object.entries(table).map(([folder, version]) => ({ pathname: `${folder}/**`, search: `?v=${version}` }));
}
