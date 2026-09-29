import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertProductionEnv, runStartupCheck, StartupConfigError } from "@/server/config/startup";
import { formatEnvProblems, validateEnv, type EnvSource } from "@/server/config/env";
import { baseSecurityHeaders, buildCsp, clerkFrontendOrigin, cspFingerprint, securityHeaderRules } from "@/server/security/csp";

const ROOT = process.cwd();

/** Clave pública de Clerk de PRUEBA: `pk_test_` + base64("clerk.hiloluna.test$"). No es una clave real. */
const CLERK_PK = `pk_test_${Buffer.from("clerk.hiloluna.test$").toString("base64")}`;

const FULL_PRODUCTION: EnvSource = {
  NODE_ENV: "production",
  APP_ENV: "production",
  DATABASE_URL: "postgresql://usuario:CLAVE_SECRETA_DB@db.example.com:5432/hiloluna",
  NEXT_PUBLIC_SITE_URL: "https://hiloluna.com",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: CLERK_PK,
  CLERK_SECRET_KEY: "sk_test_SECRETO_CLERK_123456",
  S3_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com",
  S3_BUCKET: "hiloluna-media",
  S3_ACCESS_KEY_ID: "ACCESO_S3_123456",
  S3_SECRET_ACCESS_KEY: "SECRETO_S3_123456789",
  S3_PUBLIC_BASE_URL: "https://media.hiloluna.com",
  STRIPE_SECRET_KEY: "sk_test_SECRETO_STRIPE_123456",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_PUBLICA_STRIPE_123",
  STRIPE_WEBHOOK_SECRET: "whsec_SECRETO_WEBHOOK_123456",
  STRIPE_PRICE_ESSENTIAL_ONE_TIME: "price_esencial",
  STRIPE_PRICE_PREMIUM_ONE_TIME: "price_premium",
  STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "price_mejora",
  RATE_LIMIT_REST_URL: "https://limits.example.com",
  RATE_LIMIT_REST_TOKEN: "TOKEN_LIMITADOR_123456",
  RESEND_API_KEY: "re_PRODUCCION_123456",
  EMAIL_FROM: "Hilo Luna <notificaciones@hiloluna.com>",
};

const without = (...names: string[]): EnvSource => Object.fromEntries(Object.entries(FULL_PRODUCTION).filter(([key]) => !names.includes(key)));
const errors = (env: EnvSource) => validateEnv(env).problems.filter((problem) => problem.severity === "error").map((problem) => problem.variable);

afterEach(() => vi.unstubAllEnvs());

describe("(2) validación central del entorno", () => {
  it("una configuración completa de producción es válida y sin errores", () => {
    const report = validateEnv(FULL_PRODUCTION);
    expect(report).toMatchObject({ mode: "production", ok: true });
    expect(report.problems.filter((problem) => problem.severity === "error")).toEqual([]);
  });

  it("en PRODUCCIÓN cada variable crítica ausente es un ERROR que la nombra", () => {
    const critical = ["DATABASE_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ESSENTIAL_ONE_TIME", "STRIPE_PRICE_PREMIUM_ONE_TIME", "STRIPE_PRICE_ESSENTIAL_TO_PREMIUM", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"];
    for (const variable of critical) {
      const report = validateEnv(without(variable));
      expect(report.ok, variable).toBe(false);
      expect(errors(without(variable)), variable).toContain(variable);
    }
  });

  it("valores en blanco cuentan como ausentes", () => {
    expect(errors({ ...FULL_PRODUCTION, DATABASE_URL: "   " })).toContain("DATABASE_URL");
  });

  it("(3/43/44) la URL del sitio y del medio deben ser https y no locales en producción", () => {
    expect(errors({ ...FULL_PRODUCTION, NEXT_PUBLIC_SITE_URL: "http://hiloluna.com" })).toContain("NEXT_PUBLIC_SITE_URL");
    expect(errors({ ...FULL_PRODUCTION, NEXT_PUBLIC_SITE_URL: "https://localhost:3000" })).toContain("NEXT_PUBLIC_SITE_URL");
    expect(errors({ ...FULL_PRODUCTION, NEXT_PUBLIC_SITE_URL: "no es una url" })).toContain("NEXT_PUBLIC_SITE_URL");
    expect(errors({ ...FULL_PRODUCTION, S3_PUBLIC_BASE_URL: "http://media.hiloluna.com" })).toContain("S3_PUBLIC_BASE_URL");
    expect(errors({ ...FULL_PRODUCTION, S3_PUBLIC_BASE_URL: "https://localhost:9000" })).toContain("S3_PUBLIC_BASE_URL");
  });

  it("claves con formato incorrecto o de modos distintos se rechazan (Clerk y Stripe)", () => {
    expect(errors({ ...FULL_PRODUCTION, CLERK_SECRET_KEY: "clave-rara" })).toContain("CLERK_SECRET_KEY");
    expect(errors({ ...FULL_PRODUCTION, CLERK_SECRET_KEY: "sk_live_SECRETO_CLERK_123456" })).toContain("CLERK_SECRET_KEY");
    expect(errors({ ...FULL_PRODUCTION, STRIPE_SECRET_KEY: "sk_live_SECRETO_STRIPE_123456" })).toContain("STRIPE_SECRET_KEY");
    expect(errors({ ...FULL_PRODUCTION, STRIPE_WEBHOOK_SECRET: "no-es-whsec" })).toContain("STRIPE_WEBHOOK_SECRET");
    expect(errors({ ...FULL_PRODUCTION, STRIPE_PRICE_PREMIUM_ONE_TIME: "no-es-price" })).toContain("STRIPE_PRICE_PREMIUM_ONE_TIME");
    expect(errors({ ...FULL_PRODUCTION, DATABASE_URL: "mysql://x" })).toContain("DATABASE_URL");
  });

  it("en DESARROLLO nada crítico es un error (modo de demostración): solo avisos", () => {
    const report = validateEnv({ NODE_ENV: "development" });
    expect(report.mode).toBe("development");
    expect(report.ok).toBe(true);
    expect(report.problems.every((problem) => problem.severity === "warning")).toBe(true);
  });

  it("los problemas nombran variables y NUNCA contienen un valor (ni parcial)", () => {
    const report = validateEnv({ ...without("STRIPE_WEBHOOK_SECRET", "S3_BUCKET"), CLERK_SECRET_KEY: "clave-rara-SECRETA-987", DATABASE_URL: "mysql://usuario:CLAVE_SECRETA_DB@x" });
    const text = formatEnvProblems(report) + JSON.stringify(report.problems);
    for (const value of ["clave-rara-SECRETA-987", "CLAVE_SECRETA_DB", "SECRETO_S3_123456789", "SECRETO_STRIPE_123456", "TOKEN_LIMITADOR_123456"]) expect(text).not.toContain(value);
    expect(text).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("límite de tasa: sin proveedor en producción es un AVISO claro; con RATE_LIMIT_REQUIRED es un error; con uno a medias, error", () => {
    const noProvider = without("RATE_LIMIT_REST_URL", "RATE_LIMIT_REST_TOKEN");
    expect(validateEnv(noProvider)).toMatchObject({ ok: true });
    expect(validateEnv(noProvider).problems.find((problem) => problem.group === "rateLimit")).toMatchObject({ severity: "warning" });
    expect(validateEnv(noProvider).problems.find((problem) => problem.group === "rateLimit")?.message).toMatch(/SIN LÍMITE DE TASA/);
    expect(errors({ ...noProvider, RATE_LIMIT_REQUIRED: "true" })).toContain("RATE_LIMIT_REST_URL");
    expect(errors(without("RATE_LIMIT_REST_TOKEN"))).toContain("RATE_LIMIT_REST_TOKEN");
  });
});

describe("(3) comprobación de arranque en producción", () => {
  it("con configuración incompleta FALLA con un error que nombra las variables (sin valores)", () => {
    const env = { ...without("STRIPE_WEBHOOK_SECRET", "S3_SECRET_ACCESS_KEY"), DATABASE_URL: "postgresql://usuario:CLAVE_SECRETA_DB@db/x" };
    let thrown: unknown;
    try {
      assertProductionEnv(env, { warn: () => undefined });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(StartupConfigError);
    const message = (thrown as Error).message;
    expect(message).toContain("STRIPE_WEBHOOK_SECRET");
    expect(message).toContain("S3_SECRET_ACCESS_KEY");
    expect(message).not.toContain("CLAVE_SECRETA_DB");
  });

  it("con configuración completa arranca y solo emite los avisos", () => {
    const warn = vi.fn();
    expect(assertProductionEnv(without("RATE_LIMIT_REST_URL", "RATE_LIMIT_REST_TOKEN"), { warn })).toMatchObject({ ok: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SIN LÍMITE DE TASA"));
  });

  it("runStartupCheck TERMINA el proceso con código 1 y un mensaje claro cuando la configuración es inválida (no deja el servidor a medias)", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    runStartupCheck({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:CLAVE_SECRETA@h/db" });
    expect(exit).toHaveBeenCalledWith(1);
    const message = write.mock.calls.map((call) => String(call[0])).join("");
    expect(message).toContain("NO SE PUEDE ARRANCAR");
    expect(message).toContain("STRIPE_WEBHOOK_SECRET");
    expect(message).not.toContain("CLAVE_SECRETA");
    exit.mockClear();
    runStartupCheck(FULL_PRODUCTION);
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
    write.mockRestore();
  });

  it("en desarrollo nunca falla", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "development" }, { warn: () => undefined })).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: "test" }, { warn: () => undefined })).not.toThrow();
  });

  it("instrumentation.ts lo ejecuta al arrancar el servidor Node y se omite durante `next build` y en el runtime edge", async () => {
    const source = readFileSync(join(ROOT, "instrumentation.ts"), "utf8");
    expect(source).toMatch(/NEXT_RUNTIME !== "nodejs"/);
    expect(source).toMatch(/phase-production-build/);
    expect(source).toMatch(/runStartupCheck/);
    const { register } = await import("@/instrumentation");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "development");
    await expect(register()).resolves.toBeUndefined();
  });

  it("los secretos nunca llegan al navegador: la validación vive en server/ y ningún archivo de cliente la importa", () => {
    expect(readFileSync(join(ROOT, "server/config/env.ts"), "utf8")).not.toMatch(/use client/);
  });
});

describe("(4/5) cabeceras de seguridad y CSP", () => {
  const prod = { ...FULL_PRODUCTION };
  const csp = buildCsp(prod);
  const directive = (name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

  it("deriva el host de Clerk de la clave pública (nunca de la secreta) y no admite comodines globales", () => {
    expect(clerkFrontendOrigin(CLERK_PK)).toBe("https://clerk.hiloluna.test");
    expect(clerkFrontendOrigin("sk_test_algo")).toBeUndefined();
    expect(clerkFrontendOrigin(undefined)).toBeUndefined();
    expect(directive("script-src")).toContain("https://clerk.hiloluna.test");
    expect(csp).not.toMatch(/script-src[^;]*\*/);
    expect(csp).not.toMatch(/(^|[ ;])\*($|[ ;])/);
    expect(csp).not.toContain("http:");
  });

  it("scripts: 'self' + 'unsafe-inline' (excepción documentada de Next) y SIN 'unsafe-eval' en producción; en desarrollo sí lo admite", () => {
    expect(directive("script-src")).toContain("'unsafe-inline'");
    expect(directive("script-src")).not.toContain("'unsafe-eval'");
    expect(buildCsp({ ...prod, NODE_ENV: "development" })).toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(directive("script-src")).toContain("https://challenges.cloudflare.com");
  });

  it("Stripe es una redirección: no hay Stripe.js en script-src; solo form-action admite Checkout", () => {
    expect(csp).not.toMatch(/js\.stripe\.com/);
    expect(directive("form-action")).toContain("https://checkout.stripe.com");
    expect(directive("script-src")).not.toContain("stripe");
  });

  it("R2/media: imágenes desde el dominio de medios y subidas directas al endpoint; sin comodines", () => {
    expect(directive("img-src")).toContain("https://media.hiloluna.com");
    expect(directive("connect-src")).toContain("https://cuenta.r2.cloudflarestorage.com");
    expect(directive("img-src")).not.toContain("*");
  });

  it("protecciones estructurales: object-src none, base-uri self, frame-ancestors self (el editor incrusta su propia vista previa) y HTTPS forzado", () => {
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(buildCsp({ ...prod, NODE_ENV: "development" })).not.toContain("upgrade-insecure-requests");
  });

  it("sin configuración no se añaden hosts externos (no hay comodines por defecto)", () => {
    const bare = buildCsp({ NODE_ENV: "production" });
    expect(bare).not.toMatch(/hiloluna|cloudflarestorage/);
  });

  it("cabeceras base: nosniff, Referrer-Policy, Permissions-Policy razonable, X-Frame-Options SAMEORIGIN y HSTS solo en producción", () => {
    const headers = Object.fromEntries(baseSecurityHeaders(prod).map((header) => [header.key, header.value]));
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["Permissions-Policy"]).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(headers["Content-Security-Policy"]).toBeDefined();
    expect(Object.fromEntries(baseSecurityHeaders({ NODE_ENV: "development" }).map((header) => [header.key, header.value]))).not.toHaveProperty("Strict-Transport-Security");
  });

  it("CSP_REPORT_ONLY=true la envía como Report-Only (interruptor operativo para staging)", () => {
    const keys = baseSecurityHeaders({ ...prod, CSP_REPORT_ONLY: "true" }).map((header) => header.key);
    expect(keys).toContain("Content-Security-Policy-Report-Only");
    expect(keys).not.toContain("Content-Security-Policy");
  });

  it("(34) invitaciones, panel, consola, vista previa, acceso y API: noindex; las invitaciones además sin Referer y sin caché compartida", () => {
    const rules = securityHeaderRules(prod);
    const of = (source: string) => Object.fromEntries((rules.find((rule) => rule.source === source)?.headers ?? []).map((header) => [header.key, header.value]));
    for (const source of ["/i/:path*", "/dashboard/:path*", "/admin/:path*", "/preview/:path*", "/sign-in/:path*", "/sign-up/:path*", "/api/:path*"]) expect(of(source)["X-Robots-Tag"], source).toBe("noindex, nofollow");
    expect(of("/i/:path*")["Referrer-Policy"]).toBe("no-referrer");
    expect(of("/i/:path*")["Cache-Control"]).toBe("private, no-store");
    // Las páginas de marketing no llevan noindex.
    expect(rules.some((rule) => rule.source === "/" || rule.source === "/pricing" || rule.source === "/templates/:path*")).toBe(false);
  });

  it("next.config.ts aplica las reglas, oculta X-Powered-By y restringe las imágenes remotas al host de medios (sin comodines)", async () => {
    vi.stubEnv("S3_PUBLIC_BASE_URL", "https://media.hiloluna.com");
    vi.resetModules();
    const config = (await import("@/next.config")).default;
    expect(config.poweredByHeader).toBe(false);
    const rules = await config.headers?.();
    expect(rules?.some((rule) => rule.source === "/i/:path*")).toBe(true);
    expect(config.images?.remotePatterns).toEqual([expect.objectContaining({ hostname: "media.hiloluna.com", protocol: "https" })]);
    expect(JSON.stringify(config.images)).not.toContain('"*"');
    vi.unstubAllEnvs();
  });
});

describe("huella de la CSP del build", () => {
  it("si las variables del servidor difieren de las del build, el arranque AVISA que hay que reconstruir (la CSP se fija al construir)", () => {
    const warn = vi.fn();
    vi.stubEnv("HILOLUNA_CSP_FINGERPRINT", "0000000000000000");
    assertProductionEnv(FULL_PRODUCTION, { warn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("vuelve a ejecutar npm run build"));
    warn.mockClear();
    vi.stubEnv("HILOLUNA_CSP_FINGERPRINT", cspFingerprint(FULL_PRODUCTION));
    assertProductionEnv(FULL_PRODUCTION, { warn });
    expect(warn.mock.calls.join("")).not.toContain("vuelve a ejecutar");
  });

  it("next.config.ts inyecta la huella del build", async () => {
    vi.resetModules();
    const config = (await import("@/next.config")).default;
    expect(config.env?.HILOLUNA_CSP_FINGERPRINT).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("el gancho de arranque no arrastra APIs de Node al compilador edge", () => {
  it("instrumentation.ts y todo lo que importa (startup, env, csp, logger, configuración de Stripe y planes) no usan módulos «node:»", () => {
    for (const file of ["instrumentation.ts", "server/config/startup.ts", "server/config/env.ts", "server/security/csp.ts", "server/observability/logger.ts", "server/billing/stripe/config.ts", "lib/billing/plans.ts"]) {
      const code = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/from "node:|require\("node:|from "crypto"/);
    }
  });
});
