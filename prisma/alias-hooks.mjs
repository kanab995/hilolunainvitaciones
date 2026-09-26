import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Hooks de resolución para ejecutar el seed con Node (sin dependencias extra): traducen el alias
 * `@/…` (tsconfig `paths`) y las importaciones sin extensión a archivos `.ts`. Solo se usan al
 * ejecutar `prisma/seed.ts`; Next.js y Vitest resuelven el alias por su cuenta.
 */
const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = [".ts", "/index.ts"];

function tryResolve(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of EXTENSIONS) if (existsSync(base + extension)) return base + extension;
  return undefined;
}

export async function resolve(specifier, context, nextResolve) {
  let base;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  const file = base && tryResolve(base);
  if (file) return nextResolve(pathToFileURL(file).href, context);
  return nextResolve(specifier, context);
}
