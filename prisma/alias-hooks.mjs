import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Hooks de resolución para ejecutar el seed con Node (sin dependencias extra): traducen el alias
 * `@/…` (tsconfig `paths`) y las importaciones sin extensión a archivos `.ts`. Solo se usan al
 * ejecutar `prisma/seed.ts`; Next.js y Vitest resuelven el alias por su cuenta.
 *
 * `server-only` (D-41, server/observability/monitoring.ts) se alía aquí al `empty.js` del propio
 * paquete: solo es un no-op bajo la condición `react-server` que activa el compilador de Next; en
 * Node puro (este loader) su `index.js` SIEMPRE lanza. El seed (y cualquier script que pase por
 * `server/repositories/*` → `logger` → `monitoring`) necesita poder importarlo igual que Vitest
 * (`vitest.config.mts`, mismo motivo, mismo arreglo).
 */
const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = [".ts", "/index.ts"];
const SERVER_ONLY_NOOP = pathToFileURL(join(ROOT, "node_modules/server-only/empty.js")).href;

function tryResolve(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of EXTENSIONS) if (existsSync(base + extension)) return base + extension;
  return undefined;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return nextResolve(SERVER_ONLY_NOOP, context);
  let base;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  const file = base && tryResolve(base);
  if (file) return nextResolve(pathToFileURL(file).href, context);
  return nextResolve(specifier, context);
}
