import { afterEach, describe, expect, it, vi } from "vitest";
import { readAppEnv } from "@/server/config/app-env";
import { validateEnv, type EnvSource } from "@/server/config/env";
import { baseSecurityHeaders, cspFingerprint, securityHeaderRules } from "@/server/security/csp";

vi.mock("@/server/repositories/templates", () => ({ getTemplates: async () => [{ slug: "magnolia" }] }));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

/** Clave pública de Clerk de PRUEBA: `pk_test_` + base64("clerk.hiloluna.test$"). No es una clave real. */
const CLERK_PK = `pk_test_${Buffer.from("clerk.hiloluna.test$").toString("base64")}`;

const STAGING: EnvSource = {
  NODE_ENV: "production",
  APP_ENV: "staging",
  DATABASE_URL: "postgresql://usuario:CLAVE_SECRETA_DB@db.example.com:5432/hiloluna_staging",
  NEXT_PUBLIC_SITE_URL: "https://staging.hiloluna.com",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: CLERK_PK,
  CLERK_SECRET_KEY: "sk_test_SECRETO_CLERK_123456",
  S3_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com",
  S3_BUCKET: "hiloluna-staging-media",
  S3_ACCESS_KEY_ID: "ACCESO_S3_123456",
  S3_SECRET_ACCESS_KEY: "SECRETO_S3_123456789",
  S3_PUBLIC_BASE_URL: "https://media-staging.hiloluna.com",
  STRIPE_SECRET_KEY: "sk_test_SECRETO_STRIPE_123456",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_PUBLICA_STRIPE_123",
  STRIPE_WEBHOOK_SECRET: "whsec_SECRETO_WEBHOOK_123456",
  STRIPE_PRICE_ESSENTIAL_ONE_TIME: "price_esencial",
  STRIPE_PRICE_PREMIUM_ONE_TIME: "price_premium",
  STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "price_mejora",
  RATE_LIMIT_REST_URL: "https://limits.example.com",
  RATE_LIMIT_REST_TOKEN: "TOKEN_LIMITADOR_123456",
  RESEND_API_KEY: "re_STAGING_TOKEN_123456",
  EMAIL_FROM: "Hilo Luna <notificaciones@hiloluna.com>",
  EMAIL_STAGING_ALLOWLIST: "owner-de-prueba@example.com",
};

const problems = (env: EnvSource, severity: "error" | "warning" = "error") => validateEnv(env).problems.filter((item) => item.severity === severity).map((item) => item.variable);

afterEach(() => vi.unstubAllEnvs());

describe("staging: APP_ENV y validación", () => {
  it("una configuración completa de staging es válida y sin avisos", () => {
    const report = validateEnv(STAGING);
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
  });

  it("APP_ENV es obligatorio en un despliegue (NODE_ENV=production): sin él, o con «development», falla el arranque", () => {
    const { APP_ENV: _omit, ...withoutAppEnv } = STAGING;
    expect(problems(withoutAppEnv)).toContain("APP_ENV");
    expect(problems({ ...STAGING, APP_ENV: "development" })).toContain("APP_ENV");
    expect(problems({ ...STAGING, APP_ENV: "prod" })).toContain("APP_ENV");
    expect(readAppEnv({ APP_ENV: " Staging " })).toBe("staging");
    expect(readAppEnv({})).toBeUndefined();
  });

  it("staging rechaza claves LIVE de Clerk y Stripe y nombra las variables (nunca sus valores)", () => {
    const live = { ...STAGING, CLERK_SECRET_KEY: "sk_live_SECRETO_CLERK_123456", STRIPE_SECRET_KEY: "sk_live_SECRETO_STRIPE_123456" };
    const report = validateEnv(live);
    expect(report.ok).toBe(false);
    expect(problems(live)).toEqual(expect.arrayContaining(["CLERK_SECRET_KEY", "STRIPE_SECRET_KEY"]));
    expect(JSON.stringify(report)).not.toContain("SECRETO_STRIPE_123456");
  });

  it("staging no puede usar el dominio de producción", () => {
    expect(problems({ ...STAGING, NEXT_PUBLIC_SITE_URL: "https://hiloluna.com" })).toContain("NEXT_PUBLIC_SITE_URL");
    expect(problems({ ...STAGING, NEXT_PUBLIC_SITE_URL: "https://www.hiloluna.com" })).toContain("NEXT_PUBLIC_SITE_URL");
    expect(problems({ ...STAGING, NEXT_PUBLIC_SITE_URL: "https://mi-app-staging.vercel.app" })).not.toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("un bucket sin «staging» en el nombre genera un aviso (no reutilizar el bucket de producción)", () => {
    expect(problems({ ...STAGING, S3_BUCKET: "hiloluna-media" }, "warning")).toContain("S3_BUCKET");
    expect(problems(STAGING, "warning")).toEqual([]);
  });

  it("producción con claves de PRUEBA solo avisa", () => {
    const production = { ...STAGING, APP_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://hiloluna.com" };
    expect(problems(production)).toEqual([]);
    expect(problems(production, "warning")).toEqual(expect.arrayContaining(["CLERK_SECRET_KEY", "STRIPE_SECRET_KEY"]));
  });
});

describe("staging: noindex global", () => {
  it("staging añade X-Robots-Tag noindex, nofollow a TODAS las respuestas; producción no", () => {
    const value = (env: EnvSource) => baseSecurityHeaders(env).find((header) => header.key === "X-Robots-Tag")?.value;
    expect(value(STAGING)).toBe("noindex, nofollow");
    expect(value({ ...STAGING, APP_ENV: "production" })).toBeUndefined();
    expect(securityHeaderRules(STAGING)[0]?.source).toBe("/:path*");
  });

  it("robots.txt de staging bloquea todo el sitio y no anuncia sitemap; el sitemap queda vacío", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.hiloluna.com");
    const config = robots();
    expect(config.rules).toEqual([{ userAgent: "*", disallow: ["/"] }]);
    expect(config.sitemap).toBeUndefined();
    expect(await sitemap()).toEqual([]);
  });

  it("fuera de staging el sitemap sigue listando el marketing", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hiloluna.com");
    expect((await sitemap()).length).toBeGreaterThan(1);
  });

  it("APP_ENV y la URL del sitio forman parte de la huella del build (si cambian al arrancar, se avisa de reconstruir)", () => {
    expect(cspFingerprint(STAGING)).not.toBe(cspFingerprint({ ...STAGING, APP_ENV: "production" }));
    expect(cspFingerprint(STAGING)).not.toBe(cspFingerprint({ ...STAGING, NEXT_PUBLIC_SITE_URL: "https://otro.example.com" }));
    expect(cspFingerprint(STAGING)).toBe(cspFingerprint({ ...STAGING }));
  });
});
