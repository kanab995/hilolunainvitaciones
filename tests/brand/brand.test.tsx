import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/(invitation)/i/[slug]/page";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { siteConfig } from "@/lib/site-config";
import { getPublicInvitationUrl, getSiteUrl, LOCAL_SITE_URL } from "@/lib/site-url";
import { DEMO_EVENT_ID, DEMO_EVENT_SLUG, DEMO_USER } from "@/server/seed/demo-data";
import { render, visibleText } from "../invitation/helpers";

const ROOT = process.cwd();
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === ".next") return [];
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx|css|mjs|prisma)$/.test(entry) ? [path] : [];
  });
const rel = (file: string) => file.slice(ROOT.length + 1).replaceAll("\\", "/");
const productionCode = ["app", "components", "lib", "server", "types", "prisma"].flatMap((dir) => files(join(ROOT, dir)));

describe("Marca: Hilo Luna", () => {
  it("la configuración central declara nombre, dominio y URL canónica", () => {
    expect(siteConfig.name).toBe("Hilo Luna");
    expect(siteConfig.shortName).toBe("Hilo Luna");
    expect(siteConfig.domain).toBe("hiloluna.com");
    expect(siteConfig.url).toBe("https://hiloluna.com");
    expect(siteConfig.supportEmail).toBeNull();
  });

  it("no quedan `lunaria.com` ni «Lunaria» en el código de producción (salvo la nota histórica de la configuración y la migración)", () => {
    const offenders = productionCode
      .filter((file) => rel(file) !== "lib/site-config.ts" && !rel(file).startsWith("prisma/migrations/"))
      .filter((file) => /lunaria/i.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("la interfaz obtiene el nombre de siteConfig (sin cadenas de marca sueltas)", () => {
    const offenders = productionCode
      .filter((file) => /\.tsx?$/.test(file) && rel(file) !== "lib/site-config.ts")
      .filter((file) => /["'`>]Hilo Luna["'`<]/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("URL del sitio", () => {
  it("getSiteUrl usa localhost en desarrollo y pruebas", () => {
    expect(getSiteUrl({ NODE_ENV: "development" })).toBe(LOCAL_SITE_URL);
    expect(getSiteUrl({ NODE_ENV: "test" })).toBe("http://localhost:3000");
    expect(getSiteUrl({})).toBe("http://localhost:3000");
  });

  it("en producción usa NEXT_PUBLIC_SITE_URL o, sin ella, la URL canónica de la marca", () => {
    expect(getSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://hiloluna.com" })).toBe("https://hiloluna.com");
    expect(getSiteUrl({ NODE_ENV: "production" })).toBe("https://hiloluna.com");
    expect(getSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://staging.hiloluna.com/" })).toBe("https://staging.hiloluna.com");
  });

  it("la variable manda en cualquier entorno y un valor inválido se ignora", () => {
    expect(getSiteUrl({ NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "http://localhost:4000" })).toBe("http://localhost:4000");
    expect(getSiteUrl({ NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "no es una url" })).toBe("http://localhost:3000");
    expect(getSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "ftp://x" })).toBe("https://hiloluna.com");
  });

  it("getPublicInvitationUrl genera <base>/i/<slug>", () => {
    expect(getPublicInvitationUrl("andrea-y-fernando", { NODE_ENV: "development" })).toBe("http://localhost:3000/i/andrea-y-fernando");
    expect(getPublicInvitationUrl("andrea-y-fernando", { NODE_ENV: "production" })).toBe("https://hiloluna.com/i/andrea-y-fernando");
  });
});

describe("La migración de marca no cambia los datos", () => {
  it("los slugs, ids y la migración no cambian; solo el email demo", () => {
    expect(DEMO_EVENT_SLUG).toBe("andrea-fernando");
    expect(DEMO_EVENT_ID).toBe("evt_demo_andrea_fernando");
    expect(andreaFernandoInvitation.slug).toBe("andrea-y-fernando");
    expect(DEMO_USER).toMatchObject({ id: "usr_demo", email: "demo@hiloluna.local" });
    expect(readdirSync(join(ROOT, "prisma/migrations")).some((name) => name.endsWith("_init_lunaria"))).toBe(true);
  });

  it("el seed actualiza al usuario demo por id (no deja dos usuarios al cambiar el email)", () => {
    expect(readFileSync(join(ROOT, "server/repositories/invitations.ts"), "utf8")).toMatch(/user\.upsert\(\{ where: \{ id: owner\.id \}/);
  });
});

describe("La invitación pública no muestra la marca del producto", () => {
  it("el HTML de la invitación no contiene «Hilo Luna» ni el dominio", () => {
    const template = getInvitationTemplate("magnolia")!;
    const text = visibleText(render(andreaFernandoInvitation, template));
    expect(text).not.toMatch(/Hilo Luna|hiloluna/i);
  });

  it("ni el renderizador ni el título de la página importan la marca", async () => {
    const offenders = [...files(join(ROOT, "components/invitation")), ...files(join(ROOT, "lib/invitation"))].filter((file) => /site-config|siteConfig/.test(readFileSync(file, "utf8"))).map(rel);
    expect(offenders).toEqual([]);
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "andrea-y-fernando" }) } as never);
    expect(metadata.title).toBe("Andrea & Fernando");
  });
});
