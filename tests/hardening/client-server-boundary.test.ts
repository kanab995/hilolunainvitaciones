import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMonitoringConfig } from "@/server/observability/monitoring";

const ROOT = process.cwd();

/** Todos los `.ts`/`.tsx` del proyecto (sin `node_modules`, `.next` ni los propios tests). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (["node_modules", ".next", "tests", ".git"].includes(entry)) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}
const ALL_FILES = ["app", "components", "lib", "server", "types"].flatMap((dir) => sourceFiles(join(ROOT, dir)));
const rel = (file: string) => relative(ROOT, file).replaceAll("\\", "/");

/** Especificadores `from "..."` / `from '...'` (estáticos; ignora `import type`, que no entra al bundle). */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  for (const match of source.matchAll(/^\s*import\s+(?:type\s+)?(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
    const stmt = match[0];
    if (/^\s*import\s+type\b/.test(stmt)) continue;
    specs.push(match[1]!);
  }
  return specs;
}

/** Resuelve un especificador a un archivo real del proyecto (`@/...` o relativo). `undefined` = paquete externo u otro caso fuera de alcance. */
function resolveSpecifier(fromFile: string, spec: string): string | undefined {
  if (!spec.startsWith("@/") && !spec.startsWith(".")) return undefined; // paquete de node_modules
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** `"use server"` como primera directiva real del archivo (Server Action): Next sustituye su cuerpo por
 * una referencia RPC en el cliente — su propio código (y lo que él importe) NUNCA llega al bundle,
 * aunque un "use client" lo importe para llamarlo. Es una frontera, igual que "use client" en el otro sentido. */
function isServerActionFile(source: string): boolean {
  return /^\s*["']use server["'];?\s*$/m.test(source.split("\n").slice(0, 3).join("\n"));
}

/** Cierre transitivo de imports ESTÁTICOS desde `entry`, parando en archivos ya visitados o en la frontera de un Server Action. */
function reachableFrom(entry: string): Set<string> {
  const visited = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file) || !existsSync(file)) continue;
    visited.add(file);
    const source = readFileSync(file, "utf8");
    if (file !== entry && isServerActionFile(source)) continue; // frontera: no seguir importando desde aquí
    for (const spec of importSpecifiers(source)) {
      const resolved = resolveSpecifier(file, spec);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

const CLIENT_FILES = ALL_FILES.filter((file) => /^\s*["']use client["'];?\s*$/m.test(readFileSync(file, "utf8").split("\n").slice(0, 3).join("\n")));

describe("Frontera cliente/servidor: @sentry/node nunca llega a un bundle de cliente (D-41)", () => {
  it("hay archivos \"use client\" en el proyecto (la prueba no está vacía por error)", () => {
    expect(CLIENT_FILES.length).toBeGreaterThan(5);
  });

  it("ningún componente \"use client\" importa, ni transitivamente, server/observability/logger o .../monitoring", () => {
    const forbidden = [join(ROOT, "server/observability/logger.ts"), join(ROOT, "server/observability/monitoring.ts")];
    const offenders: string[] = [];
    for (const client of CLIENT_FILES) {
      const reachable = reachableFrom(client);
      for (const target of forbidden) if (reachable.has(target)) offenders.push(`${rel(client)} → ${rel(target)}`);
    }
    expect(offenders).toEqual([]);
  });

  it("@sentry/node se importa SOLO desde server/observability/monitoring.ts", () => {
    const offenders = ALL_FILES.filter((file) => file !== join(ROOT, "server/observability/monitoring.ts"))
      .filter((file) => /from\s+["']@sentry\/node["']|require\(["']@sentry\/node["']\)/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("monitoring.ts declara `import \"server-only\"` y next.config.ts externaliza @sentry/node para el bundler", () => {
    expect(readFileSync(join(ROOT, "server/observability/monitoring.ts"), "utf8")).toMatch(/^import "server-only";/m);
    expect(readFileSync(join(ROOT, "next.config.ts"), "utf8")).toMatch(/serverExternalPackages:\s*\[[^\]]*["']@sentry\/node["']/);
  });
});

describe("El logger funciona sin Sentry configurado (D-37/D-41)", () => {
  it("sin SENTRY_DSN: \"not_configured\", sin importar el SDK", () => {
    expect(resolveMonitoringConfig({})).toEqual({ status: "not_configured" });
    expect(resolveMonitoringConfig({ SENTRY_DSN: "" })).toEqual({ status: "not_configured" });
    expect(resolveMonitoringConfig({ SENTRY_DSN: "   " })).toEqual({ status: "not_configured" });
  });

  it("captureException nunca lanza, con o sin SENTRY_DSN, y no bloquea al llamador", async () => {
    const { captureException } = await import("@/server/observability/monitoring");
    expect(() => captureException(new Error("x"), "evento.de.prueba")).not.toThrow();
  });

  it("un DSN mal formado no rompe el arranque: \"invalid\", nunca una excepción", () => {
    expect(resolveMonitoringConfig({ SENTRY_DSN: "no-es-un-dsn" })).toMatchObject({ status: "invalid" });
  });

  it("en producción, sin SENTRY_DSN, sigue siendo \"not_configured\" (nunca un error de arranque)", () => {
    expect(resolveMonitoringConfig({ NODE_ENV: "production", APP_ENV: "production" })).toEqual({ status: "not_configured" });
  });
});
