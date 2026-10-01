import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { visibleText } from "../invitation/helpers";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

vi.mock("next/navigation", () => ({ usePathname: () => "/privacy", useRouter: () => ({ push: vi.fn() }), redirect: vi.fn(), notFound: vi.fn() }));

import robots from "@/app/robots";
import PrivacyPage from "@/app/(site)/(marketing)/privacy/page";
import TermsPage from "@/app/(site)/(marketing)/terms/page";
import { GET as healthGet } from "@/app/api/health/route";
import { footerNav } from "@/lib/content/navigation";
import { privacyDocument, termsDocument } from "@/lib/content/legal";
import { toAuditEntry } from "@/server/admin/audit";
import { getActiveAdminNavId, adminNav } from "@/lib/admin/navigation";
import { getReadiness } from "@/server/services/health";

function files(dirs: string[], pattern = /\.(ts|tsx)$/): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (path: string) => {
    if (statSync(path).isDirectory()) for (const entry of readdirSync(path)) walk(join(path, entry));
    else if (pattern.test(path)) found.set(relative(ROOT, path).split(sep).join("/"), readFileSync(path, "utf8"));
  };
  for (const dir of dirs) walk(join(ROOT, dir));
  return found;
}

beforeEach(() => vi.unstubAllEnvs());

describe("(34/35) robots y sitemap", () => {
  it("robots.txt: indexable solo el marketing; panel, consola, vista previa, invitaciones, API y acceso quedan fuera; apunta al sitemap", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hiloluna.com");
    const config = robots();
    const rule = (Array.isArray(config.rules) ? config.rules[0] : config.rules) as { allow: string[]; disallow: string[] };
    expect(rule.allow).toEqual(["/", "/templates", "/pricing", "/privacy", "/terms"]);
    for (const path of ["/dashboard", "/admin", "/preview", "/i/", "/api/", "/sign-in", "/sign-up"]) expect(rule.disallow, path).toContain(path);
    expect(config.sitemap).toBe("https://hiloluna.com/sitemap.xml");
  });

  it("la metadata de las invitaciones públicas es noindex y sin Referer (y ya lo era el layout)", () => {
    const page = read("app/(invitation)/i/[slug]/page.tsx");
    expect(page).toMatch(/robots = \{ index: false, follow: false \}/);
    expect(page).toMatch(/referrer: "no-referrer"/);
    expect(read("app/(invitation)/layout.tsx")).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(read("app/(site)/admin/layout.tsx")).toMatch(/robots: \{ index: false, follow: false \}/);
  });
});

describe("(36/37/D-37) páginas legales: texto aprobado, sin borrador ni pendientes", () => {
  const html = (element: React.ReactElement) => renderToStaticMarkup(element);

  it("/privacy y /terms ya no muestran DRAFT, [PENDIENTE] ni placeholders, y tienen la fecha de aprobación", () => {
    for (const page of [PrivacyPage(), TermsPage()]) {
      const markup = html(page);
      const text = visibleText(markup);
      expect(text).not.toContain("DRAFT");
      expect(text).not.toContain("[PENDIENTE");
      expect(markup).not.toMatch(/\[[A-ZÁÉÍÓÚÑ ]+\]/);
      expect(markup).not.toContain("data-legal-draft");
      expect(text).toContain("30 de septiembre de 2026");
      expect(text).toContain("Kanab Domínguez Siliceo");
    }
  });

  it("la privacidad cubre cuentas, eventos, invitados, RSVP, imágenes, pagos (Stripe), proveedores, cookies y conservación, con el responsable y el correo de contacto reales", () => {
    const text = visibleText(html(PrivacyPage()));
    const titles = privacyDocument.sections.map((section) => section.title);
    for (const expected of [
      "Identidad del responsable",
      "Datos del evento",
      "Datos de invitados y RSVP",
      "Fotografías y archivos",
      "Datos de pago y compras",
      "Proveedores tecnológicos",
      "Cookies y tecnologías similares",
      "Conservación de datos",
      "Derechos ARCO",
    ])
      expect(titles, expected).toContain(expected);
    for (const word of ["Clerk", "Stripe", "Cloudflare R2", "EXIF", "30 días", "privacidad@hiloluna.com"]) expect(text, word).toContain(word);
  });

  it("los términos cubren contenido del usuario, compras por evento, ventana de acceso, reembolsos y uso prohibido, con el correo de soporte real", () => {
    const titles = termsDocument.sections.map((section) => section.title);
    for (const expected of ["Contenido del usuario", "Modelo de pago", "Acceso temporal del evento", "Reembolsos", "Contenido prohibido"]) expect(titles, expected).toContain(expected);
    const text = visibleText(html(TermsPage()));
    expect(text).toContain("soporte@hiloluna.com");
    expect(text).toContain("pago único por evento");
  });

  it("los textos no prometen cosas que el producto no hace (sin publicidad de terceros, sin datos de tarjeta)", () => {
    const text = JSON.stringify([privacyDocument, termsDocument]);
    expect(text).toMatch(/vender perfiles publicitarios a terceros/);
    expect(text).toMatch(/no (son almacenados por Hilo Luna|almacena el número completo de tarjeta)/);
  });

  it("el pie enlaza a Términos y Privacidad", () => {
    expect(footerNav.map((item) => item.href)).toEqual(expect.arrayContaining(["/terms", "/privacy"]));
  });
});

describe("(38/39) health", () => {
  it("/api/health responde solo { status: 'ok' } sin caché", async () => {
    const response = healthGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("/api/health/ready combina configuración y base de datos y responde solo booleanos (sin URLs, variables ni errores)", async () => {
    expect(await getReadiness({ configOk: () => true, ping: async () => true })).toEqual({ status: "ready", checks: { config: true, database: true } });
    expect(await getReadiness({ configOk: () => true, ping: async () => false })).toMatchObject({ status: "not_ready", checks: { database: false } });
    const broken = await getReadiness({ configOk: () => false, ping: async () => { throw Object.assign(new Error("connect ECONNREFUSED db.internal:5432 postgresql://u:SECRETA@h/db"), { code: "P1001" }); } });
    expect(broken).toEqual({ status: "not_ready", checks: { config: false, database: false } });
    expect(JSON.stringify(broken)).not.toMatch(/SECRETA|db\.internal|postgres/);
  });

  it("las rutas de salud no requieren sesión ni exponen nada interno", () => {
    for (const file of ["app/api/health/route.ts", "app/api/health/ready/route.ts", "server/services/health.ts"]) expect(read(file).replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/process\.env\.\w+[^)]*json|version|DATABASE_URL/i);
  });
});

describe("(27/28) auditoría de administración", () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: "aud_1", action: "template.update", entityType: "Template", entityId: "tpl_1", entityName: "Magnolia", before: { publicationStatus: "PUBLISHED", minimumPlan: "FREE" }, after: { publicationStatus: "DRAFT", minimumPlan: "ESSENTIAL" }, createdAt: new Date("2027-01-01T00:00:00Z"), admin: { id: "usr_a", name: "Admin", email: "admin@example.com" }, ...over });

  it("la entrada se traduce a etiquetas legibles: quién, qué elemento y solo lo que cambió (antes → después)", () => {
    const entry = toAuditEntry(row() as never);
    expect(entry).toMatchObject({ actor: { email: "admin@example.com" }, target: "Plantilla · Magnolia" });
    expect(entry.changes).toEqual([
      { field: "Visibilidad", from: "Visible", to: "Oculta" },
      { field: "Plan mínimo", from: "Gratis", to: "Esencial" },
    ]);
    expect(toAuditEntry(row({ before: { minimumPlan: "FREE" }, after: { minimumPlan: "PREMIUM" } }) as never).changes).toEqual([{ field: "Plan mínimo", from: "Gratis", to: "Premium" }]);
  });

  it("ignora claves desconocidas del JSON (nada de datos arbitrarios llega a la interfaz)", () => {
    const entry = toAuditEntry(row({ before: { secreto: "x", email: "a@b.c" }, after: { secreto: "y", email: "d@e.f" } }) as never);
    expect(entry.changes).toEqual([]);
    expect(JSON.stringify(entry)).not.toMatch(/secreto|a@b\.c|d@e\.f/);
  });

  it("la consola tiene la sección «Auditoría» (ruta, navegación y página con requireAdmin), solo lectura", () => {
    expect(adminNav.map((item) => item.label)).toContain("Auditoría");
    expect(getActiveAdminNavId("/admin/audit")).toBe("audit");
    const page = read("app/(site)/admin/audit/page.tsx");
    expect(page).toMatch(/requireAdmin\(\)/);
    expect(page).not.toMatch(/<form|"use server"|action=/);
  });

  it("solo las dos acciones de plantilla escriben auditoría y solo dentro de la transacción del repositorio", () => {
    const repo = read("server/repositories/admin.ts");
    expect([...repo.matchAll(/adminAuditLog\.create/g)]).toHaveLength(1);
    expect(repo).not.toMatch(/adminAuditLog\.(update|delete|upsert)/);
  });
});

describe("(31/32) índices y restricciones en la base de datos", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260926160000_preproduction_hardening/migration.sql");

  it("la migración es aditiva: solo CREATE, un DROP INDEX (el índice que sustituye una restricción única) y CHECK NOT VALID; nada de DELETE/UPDATE/DROP TABLE/TRUNCATE", () => {
    // `ON DELETE RESTRICT` de la clave foránea es una regla, no un borrado de datos; los comentarios no cuentan.
    const code = migration.replace(/^--.*$/gm, "").replace(/ON (DELETE|UPDATE) \w+/g, "");
    expect(code).not.toMatch(/\b(DELETE|UPDATE|TRUNCATE|DROP TABLE|DROP COLUMN|RENAME|ALTER COLUMN)\b/);
    expect([...code.matchAll(/\bDROP\b/g)]).toHaveLength(1);
    expect(migration).toMatch(/DROP INDEX "EventPurchase_providerPaymentIntentId_idx"/);
    for (const match of migration.matchAll(/ADD CONSTRAINT "[^"]+" CHECK[^;]*;/g)) expect(match[0], match[0]).toMatch(/NOT VALID;$/);
  });

  it("restricciones de integridad: importes no negativos, moneda ISO, PAID exige paidAt, revisiones/versiones válidas, una publicación vigente por invitación", () => {
    for (const expected of ["EventPurchase_amount_nonnegative", "EventPurchase_currency_iso", "EventPurchase_paid_has_paidAt", "Guest_maxCompanions_nonnegative", "Rsvp_attendeeCount_nonnegative", "Invitation_revisions_valid", "InvitationPublication_version_positive", "Event_endsAt_after_startsAt"]) expect(migration, expected).toContain(expected);
    expect(migration).toMatch(/CREATE UNIQUE INDEX "InvitationPublication_one_current_per_invitation" ON "InvitationPublication"\("invitationId"\) WHERE "isCurrent"/);
  });

  it("unicidades ya existentes siguen ahí: inviteToken, slug, una respuesta por invitado, (invitación, versión), sesión de cobro y ahora el pago del proveedor", () => {
    expect(schema).toMatch(/inviteToken\s+String\s+@unique/);
    expect(schema).toMatch(/slug\s+String\s+@unique/);
    expect(schema).toMatch(/guestId\s+String\s+@unique/);
    expect(schema).toMatch(/@@unique\(\[invitationId, version\]\)/);
    expect(schema).toMatch(/@@unique\(\[provider, providerCheckoutSessionId\]\)/);
    expect(schema).toMatch(/@@unique\(\[provider, providerPaymentIntentId\]\)/);
  });

  it("AdminAuditLog: solo inserción (FK Restrict), con índices por fecha, entidad y administrador", () => {
    const model = schema.match(/model AdminAuditLog \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(model).toMatch(/before\s+Json/);
    expect(model).toMatch(/after\s+Json/);
    expect(model).toMatch(/onDelete: Restrict/);
    expect(model).toMatch(/@@index\(\[createdAt\]\)/);
    expect(model).toMatch(/@@index\(\[entityType, entityId\]\)/);
  });

  it("los índices nuevos tienen una consulta real que los justifica (listados de la consola y detección de huérfanos)", () => {
    for (const index of ["@@index([processedAt])", "@@index([paidAccessEndsAt])", "@@index([status, createdAt])"]) expect(schema).toContain(index);
    expect(read("server/repositories/admin.ts")).toMatch(/orderBy: \[\{ processedAt: "desc" \}/);
    expect(read("server/repositories/admin.ts")).toMatch(/paidAccessEndsAt: \{ gte: now, lte: horizon \}/);
  });
});

describe("(42/43/44) configuración de entorno, URLs y medios", () => {
  it(".env.example agrupa App, Base de datos, Clerk, R2, Stripe y Límite de tasa, sin valores reales", () => {
    const example = read(".env.example").replace(/\r\n/g, "\n");
    for (const group of ["App", "Base de datos", "Clerk", "R2", "Stripe", "Límite de tasa"]) expect(example, group).toMatch(new RegExp(`^# ═+\\n# ${group}`, "m"));
    for (const variable of ["NEXT_PUBLIC_SITE_URL", "DATABASE_URL", "CLERK_SECRET_KEY", "S3_PUBLIC_BASE_URL", "STRIPE_WEBHOOK_SECRET", "RATE_LIMIT_REST_URL", "RATE_LIMIT_REST_TOKEN", "RATE_LIMIT_REQUIRED", "CSP_REPORT_ONLY", "LOG_LEVEL"]) expect(example, variable).toMatch(new RegExp(`^#? ?${variable}=`, "m"));
    expect(example).toMatch(/hiloluna\.com/);
    expect(example).not.toMatch(/(sk|pk|rk)_(test|live)_[A-Za-z0-9]{6,}|whsec_[A-Za-z0-9]{6,}|price_[A-Za-z0-9]{6,}/);
  });

  it("no hay URLs localhost ni dominios de producción escritos a mano en el código de la aplicación (solo en site-url/site-config y los ejemplos de comentarios)", () => {
    const allowed = new Set(["lib/site-url.ts", "lib/site-config.ts"]);
    for (const [file, code] of files(["app", "server", "components", "lib"])) {
      if (allowed.has(file)) continue;
      const executable = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(executable, file).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1)|"https:\/\/hiloluna\.com|'https:\/\/hiloluna\.com/);
    }
  });

  it("las imágenes remotas de next/image se limitan al host de S3_PUBLIC_BASE_URL y a /users/** (sin comodines)", () => {
    // Sin comentarios (uno de ellos nombra justamente lo prohibido).
    const config = read("next.config.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(config).not.toMatch(/hostname: "\*"|hostname: '\*'|hostname: "\*\*"/);
  });
});

describe("(52) los SDK de servidor no entran en el navegador", () => {
  it("ningún archivo «use client» ni de lib/ importa stripe, @aws-sdk, @prisma/client (runtime), sharp o server/", () => {
    for (const [file, code] of files(["components", "lib", "app"])) {
      const isClient = /^\s*["']use client["']/.test(code);
      if (isClient || file.startsWith("lib/") || file.startsWith("components/")) {
        expect(code, file).not.toMatch(/from "(stripe|sharp|@aws-sdk\/[^"]+)"/);
        expect(code, file).not.toMatch(/^import (?!type)[^;]*from "@prisma\/client"/m);
      }
      if (isClient) expect(code, file).not.toMatch(/^import (?!type)[^;\n]*from "@\/server\//m);
    }
  });
});

describe("(33/48/49) documentación operativa", () => {
  it("OPERATIONS: copias de PostgreSQL, restauración, R2, Stripe/Clerk como fuentes, huérfanos, eliminación de cuentas (Restrict) y cookies", () => {
    const doc = read("docs/OPERATIONS.md");
    for (const expected of ["Copia de seguridad de PostgreSQL", "Checklist de restauración", "Cloudflare R2", "Stripe no necesita copia de seguridad de tarjetas", "Clerk es la fuente de la identidad", "npm run media:orphans", "`Restrict`", "Procedimiento manual de soporte", "SELECT count(*) FROM \"Subscription\"", "No existe «borrar cuenta»"]) expect(doc, expected).toContain(expected);
  });

  it("DEPLOYMENT: proveedor-neutral, con base de datos, migraciones sin reset, Clerk, R2 + CORS, Stripe, CSP con excepciones, límite de tasa, build y checklist", () => {
    const doc = read("docs/DEPLOYMENT.md");
    for (const expected of ["neutral al proveedor", "npm run db:deploy", "Nunca** uses `migrate reset`", "https://hiloluna.com", "https://www.hiloluna.com", "AllowedOrigins", "https://media.hiloluna.com", "unsafe-inline", "CSP_REPORT_ONLY", "RATE_LIMIT_REST_URL", "fail-open", "Checklist de despliegue", "npm run smoke"]) expect(doc, expected).toContain(expected);
    expect(doc).not.toMatch(/vercel/i);
  });

  it("SMOKE_TESTS y el script cubren home, sign-in, plantillas, evento, editor, publicación, invitación, RSVP, QR, calendario, pago de prueba y consola", () => {
    const doc = read("docs/SMOKE_TESTS.md");
    for (const word of ["/sign-in", "/templates", "crear evento", "Editor", "Publicar", "RSVP", "QR", ".ics", "4242", "Consola", "Expiración"]) expect(doc.toLowerCase(), word).toContain(word.toLowerCase());
    const script = read("scripts/smoke.mjs");
    expect(script).toMatch(/SMOKE_BASE_URL/);
    expect(script).not.toMatch(/sk_(live|test)_|whsec_/);
    expect(JSON.parse(read("package.json")).scripts.smoke).toBe("node scripts/smoke.mjs");
  });
});
