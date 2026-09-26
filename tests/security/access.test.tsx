import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { NextRequest, type NextFetchEvent } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import proxy, { config } from "@/proxy";
import { AccountNavLinkView } from "@/components/marketing/site-account-nav";
import { getAccountNavItem, getHeaderCta } from "@/lib/content/navigation";
import { decideAccess, isPrivatePath } from "@/server/auth/access";
import { getAuthMode, isClerkConfigured, isDemoAliasEnabled } from "@/server/auth/mode";
import { getOwnedEventByRef, listOwnedEvents } from "@/server/repositories/events";
import { getOwnedInvitation } from "@/server/repositories/invitations";
import { getOwnedDashboardData } from "@/server/repositories/dashboard";
import { DEMO_EVENT_ID, DEMO_USER } from "@/server/seed/demo-data";
import { visibleText } from "../invitation/helpers";

const ROOT = process.cwd();
const OTHER_USER = "usr_otra_persona";

function pageRoutes(): string[] {
  const appDir = join(ROOT, "app");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === "page.tsx") {
        const segments = relative(appDir, dir).split(sep).filter((segment) => !/^\(.*\)$/.test(segment));
        found.push(`/${segments.join("/").replace(/\[\[?\.\.\.[^\]]+\]?\]/g, "").replace(/\/$/, "")}`.replace(/\/+$/, "") || "/");
      }
    }
  };
  walk(appDir);
  return found;
}

afterEach(() => vi.unstubAllEnvs());

describe("1. Las rutas privadas exigen sesión; las públicas no", () => {
  it("todo /dashboard/**, /preview/** y /admin/** es privado; el resto de páginas, público", () => {
    const routes = pageRoutes();
    expect(routes.some((route) => route.startsWith("/dashboard/events"))).toBe(true);
    for (const route of routes) {
      const concrete = route.replace(/\[[^\]]+\]/g, "x");
      const expectPrivate = concrete.startsWith("/dashboard") || concrete.startsWith("/preview") || concrete.startsWith("/admin");
      expect(isPrivatePath(concrete), route).toBe(expectPrivate);
    }
    for (const publicPath of ["/", "/templates", "/templates/magnolia", "/i/andrea-y-fernando", "/sign-in", "/sign-up", "/sign-in/factor-one"]) expect(isPrivatePath(publicPath), publicPath).toBe(false);
    for (const privatePath of ["/dashboard", "/dashboard/events", "/dashboard/events/abc/edit", "/dashboard/events/abc/guests", "/preview/abc", "/admin", "/admin/users", "/admin/purchases/abc"]) expect(isPrivatePath(privatePath), privatePath).toBe(true);
  });

  it("sin sesión (o sin Clerk configurado) una ruta privada redirige a /sign-in; con sesión, pasa", () => {
    expect(decideAccess({ pathname: "/dashboard/events", mode: "clerk", signedIn: false })).toEqual({ action: "redirect-sign-in" });
    expect(decideAccess({ pathname: "/dashboard/events", mode: "clerk", signedIn: true })).toEqual({ action: "allow" });
    expect(decideAccess({ pathname: "/dashboard/events", mode: "unconfigured", signedIn: false })).toEqual({ action: "redirect-sign-in" });
    expect(decideAccess({ pathname: "/preview/abc", mode: "clerk", signedIn: false })).toEqual({ action: "redirect-sign-in" });
  });

  it("el proxy redirige con la URL de retorno y deja pasar las rutas públicas", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const event = {} as NextFetchEvent;
    const blocked = await proxy(new NextRequest("http://localhost:3000/dashboard/events/abc/edit?x=1"), event);
    expect(blocked?.status).toBe(307);
    const location = new URL(blocked?.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("redirect_url")).toBe("/dashboard/events/abc/edit?x=1");

    const open = await proxy(new NextRequest("http://localhost:3000/templates"), event);
    expect(open?.headers.get("location")).toBeNull();
    expect(config.matcher).toEqual(["/dashboard/:path*", "/preview/:path*", "/admin/:path*", "/pricing"]);
  });
});

describe("Modo de autenticación (decidido en el servidor por entorno)", () => {
  it("con claves → clerk; sin claves solo en development → demo; en otro caso → unconfigured", () => {
    const keys = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x", CLERK_SECRET_KEY: "sk_test_x" };
    expect(getAuthMode({ ...keys, NODE_ENV: "production" })).toBe("clerk");
    expect(getAuthMode({ ...keys, NODE_ENV: "development" })).toBe("clerk");
    expect(getAuthMode({ NODE_ENV: "development" })).toBe("demo");
    expect(getAuthMode({ NODE_ENV: "production" })).toBe("unconfigured");
    expect(getAuthMode({ NODE_ENV: "test" })).toBe("unconfigured");
    expect(isClerkConfigured({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x" })).toBe(false);
    expect(isClerkConfigured({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " ", CLERK_SECRET_KEY: "" })).toBe(false);
  });

  it("el modo demo y el alias `demo` nunca existen en producción", () => {
    expect(getAuthMode({ NODE_ENV: "production" })).not.toBe("demo");
    expect(isDemoAliasEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isDemoAliasEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("2–4. Propiedad de los eventos (origen de demostración: propietario usr_demo)", () => {
  it("el propietario lee su evento, su invitación y su dashboard", async () => {
    expect((await getOwnedEventByRef(DEMO_USER.id, DEMO_EVENT_ID))?.id).toBe(DEMO_EVENT_ID);
    expect((await getOwnedInvitation(DEMO_USER.id, DEMO_EVENT_ID))?.slug).toBe("andrea-y-fernando");
    expect((await getOwnedDashboardData(DEMO_USER.id, DEMO_EVENT_ID))?.event.id).toBe(DEMO_EVENT_ID);
    expect(await listOwnedEvents(DEMO_USER.id)).toHaveLength(1);
  });

  it("otra persona NO puede leer el evento (por id, slug ni alias), ni su invitación, ni su dashboard", async () => {
    for (const ref of [DEMO_EVENT_ID, "andrea-fernando", "demo"]) expect(await getOwnedEventByRef(OTHER_USER, ref), ref).toBeUndefined();
    expect(await getOwnedInvitation(OTHER_USER, DEMO_EVENT_ID)).toBeUndefined();
    expect(await getOwnedDashboardData(OTHER_USER, DEMO_EVENT_ID)).toBeUndefined();
    expect(await getOwnedDashboardData(OTHER_USER, "demo")).toBeUndefined();
  });

  it("9. una persona real (sin eventos) no recibe el evento demo: su lista está vacía", async () => {
    expect(await listOwnedEvents(OTHER_USER)).toEqual([]);
  });

  it("en producción el alias `demo` no resuelve ni siquiera para el propietario del seed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await getOwnedEventByRef(DEMO_USER.id, "demo")).toBeUndefined();
    expect((await getOwnedEventByRef(DEMO_USER.id, DEMO_EVENT_ID))?.id).toBe(DEMO_EVENT_ID);
  });
});

describe("5. La invitación pública no requiere cuenta", () => {
  it("/i/[slug] y su código no dependen de la autenticación", () => {
    expect(isPrivatePath("/i/andrea-y-fernando")).toBe(false);
    expect(decideAccess({ pathname: "/i/andrea-y-fernando", mode: "clerk", signedIn: false })).toEqual({ action: "allow" });
    const sources = [...readdirSync(join(ROOT, "app/(invitation)/i"), { recursive: true, withFileTypes: true })].filter((entry) => entry.isFile()).map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"));
    for (const source of sources) expect(source).not.toMatch(/@clerk|server\/auth|requireAuth|getOrCreateCurrentUser/);
    const layout = readFileSync(join(ROOT, "app/(invitation)/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/ClerkProvider|@clerk/);
  });
});

describe("7. clerkUserId es la identidad externa primaria", () => {
  it("el esquema lo declara único y anulable; el email sigue siendo único pero no es la identidad", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    const user = /model User \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(user).toMatch(/clerkUserId\s+String\?\s+@unique/);
    expect(user).not.toMatch(/password|token/i);
  });
});

describe("10. La navbar pública según la sesión", () => {
  it("autenticado: «Mi panel», nunca «Entrar»", () => {
    const html = renderToStaticMarkup(<AccountNavLinkView state="signed-in" pathname="/" />);
    expect(visibleText(html)).toBe("Mi panel");
    expect(html).not.toContain("Entrar");
    expect(getAccountNavItem("signed-in")).toEqual({ label: "Mi panel", href: "/dashboard" });
    expect(getHeaderCta("signed-in").href).toBe("/templates");
  });

  it("sin sesión: «Entrar» → /sign-in y CTA → /sign-up; cargando: sin enlace (espacio reservado, oculto)", () => {
    expect(getAccountNavItem("signed-out")).toEqual({ label: "Entrar", href: "/sign-in" });
    expect(getHeaderCta("signed-out").href).toBe("/sign-up");
    expect(getAccountNavItem("loading")).toBeUndefined();
    const loading = renderToStaticMarkup(<AccountNavLinkView state="loading" pathname="/" />);
    expect(loading).toContain('aria-hidden="true"');
    expect(loading).toContain("invisible");
    expect(loading).not.toContain("href=");
  });
});

describe("Los secretos y el acceso a datos son solo de servidor", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (entry === "node_modules" || entry === ".next") return [];
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
  const rel = (file: string) => relative(ROOT, file).replaceAll("\\", "/");

  it("CLERK_SECRET_KEY solo se lee en server/auth/mode.ts", () => {
    const offenders = ["app", "components", "lib", "server", "types"]
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /process\.env\.CLERK_SECRET_KEY/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual(["server/auth/mode.ts"]);
  });

  it("solo server/auth/session.ts y proxy.ts usan las APIs de servidor de Clerk", () => {
    const offenders = ["app", "components", "lib", "server", "types"]
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /@clerk\/nextjs\/server/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual(["server/auth/session.ts"]);
  });

  it("las páginas privadas y sus cargadores no usan lecturas sin propietario", () => {
    const privateCode = [...files(join(ROOT, "app/(site)/dashboard")), join(ROOT, "lib/dashboard/load-dashboard.ts"), join(ROOT, "lib/editor/load-event.ts"), join(ROOT, "app/(invitation)/preview/[id]/page.tsx")];
    const unscoped = /\b(getEventByRef|getEventById|getEventBySlug|listEvents|getInvitationByEventId|getDashboardData|getDemoEventInvitation)\b/;
    for (const file of privateCode) expect(readFileSync(file, "utf8"), rel(file)).not.toMatch(unscoped);
  });

  it("todo módulo de repositorios que consulta eventos privados exige userId", () => {
    const events = readFileSync(join(ROOT, "server/repositories/events.ts"), "utf8");
    for (const fn of ["getOwnedEventByRef", "listOwnedEvents"]) expect(events).toMatch(new RegExp(`function ${fn}\\(userId: string`));
    expect(events).toMatch(/ownerId: userId/);
    expect(readFileSync(join(ROOT, "server/repositories/invitations.ts"), "utf8")).toMatch(/event: \{ ownerId: userId \}/);
    expect(readFileSync(join(ROOT, "server/repositories/dashboard.ts"), "utf8")).toMatch(/ownerId: userId/);
  });
});

beforeEach(() => vi.unstubAllEnvs());
