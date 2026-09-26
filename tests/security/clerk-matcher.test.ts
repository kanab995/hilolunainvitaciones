import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

/**
 * Regresión de staging: con Clerk real, `auth()` lanza si `clerkMiddleware` no corrió en la ruta. `/pricing` (pública, pero con CTA que dependen de la
 * sesión) respondía 500 porque el `matcher` de `proxy.ts` solo cubría las rutas privadas. Toda página FUERA de las rutas privadas que lea la sesión
 * debe estar en el `matcher`.
 */
const ROOT = process.cwd();
const SESSION_USERS = /@\/server\/auth\/(current-user|session|ownership|admin)/;

function pages(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) pages(path, found);
    else if (/^(page|layout|route)\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/** Ruta pública que aporta un archivo de `app/` (sin grupos `(x)`), p. ej. `app/(site)/(marketing)/pricing/page.tsx` → `/pricing`. */
const routeOf = (file: string) => `/${relative(join(ROOT, "app"), file).split(sep).slice(0, -1).filter((part) => !/^\(.*\)$/.test(part)).join("/")}`.replace(/\/$/, "") || "/";

describe("proxy.ts: cobertura de Clerk", () => {
  it("toda página que lee la sesión y no es privada está en el matcher (si no, auth() falla con Clerk real)", () => {
    const covered = (route: string) => (config.matcher as string[]).some((pattern) => (pattern.endsWith("/:path*") ? route === pattern.slice(0, -"/:path*".length) || route.startsWith(`${pattern.slice(0, -"/:path*".length)}/`) : route === pattern));
    const offenders = pages(join(ROOT, "app"))
      .filter((file) => SESSION_USERS.test(readFileSync(file, "utf8")))
      .map((file) => ({ file: relative(ROOT, file).split(sep).join("/"), route: routeOf(file) }))
      .filter(({ route }) => !covered(route));
    expect(offenders).toEqual([]);
  });

  it("/pricing está cubierta; los webhooks y las invitaciones NO pasan por Clerk", () => {
    expect(config.matcher).toContain("/pricing");
    for (const pattern of config.matcher as string[]) {
      expect(pattern).not.toMatch(/\/api|\/i\b|webhook/);
    }
  });
});
