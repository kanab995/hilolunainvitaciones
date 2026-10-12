// Genera `lib/images/asset-versions.json`: huella de contenido (sha-256, 10 hex) de la carpeta de cada
// plantilla (`public/templates/<slug>/`). `lib/images/loader.ts` la añade como `?v=<huella>` a la fuente que
// recibe el optimizador de imágenes: si CUALQUIER imagen de la carpeta cambia, la URL de todas cambia y ni el
// navegador, ni la caché del optimizador de Next (`minimumCacheTTL` = 4 h por defecto, sin mecanismo de
// invalidación), ni la de Vercel pueden servir la versión anterior (docs/ARCHITECTURE.md D-45, punto 9).
//
// Una huella POR CARPETA (no por archivo) porque `images.localPatterns` admite como máximo 25 entradas y
// compara `search` de forma exacta: así hay una entrada por plantilla, sin comodines en la query.
//
//   node scripts/asset-versions.mjs          escribe el JSON (lo hacen `predev` y `prebuild`)
//   node scripts/asset-versions.mjs --check  no escribe; sale con 1 si el JSON está desactualizado
//
// Solo lectura de `public/`; la salida es determinista (orden alfabético, sin fechas).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public");
const OUT = join(ROOT, "lib", "images", "asset-versions.json");
const IMAGE = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : IMAGE.test(entry) ? [path] : [];
  });
}

/** `{ "/templates/<slug>": "<huella de 10 hex>" }`, ordenado por carpeta. */
export function computeVersions() {
  const base = join(PUBLIC_DIR, "templates");
  if (!existsSync(base)) return {};
  const folders = readdirSync(base).filter((entry) => statSync(join(base, entry)).isDirectory()).sort();
  const result = {};
  for (const folder of folders) {
    const hash = createHash("sha256");
    for (const file of walk(join(base, folder)).sort()) {
      hash.update(relative(PUBLIC_DIR, file).split(sep).join("/")).update("\0").update(readFileSync(file)).update("\0");
    }
    result[`/templates/${folder}`] = hash.digest("hex").slice(0, 10);
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const next = JSON.stringify(computeVersions(), null, 2) + "\n";
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
  if (process.argv.includes("--check")) {
    if (current !== next) {
      console.error("lib/images/asset-versions.json está desactualizado: ejecuta `npm run assets:versions`.");
      process.exit(1);
    }
    console.log("asset-versions.json al día.");
  } else if (current !== next) {
    writeFileSync(OUT, next);
    console.log(`asset-versions.json actualizado (${Object.keys(JSON.parse(next)).length} carpetas de plantilla).`);
  }
}
