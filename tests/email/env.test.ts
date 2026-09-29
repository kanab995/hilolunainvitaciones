import { describe, expect, it } from "vitest";
import { validateEnv, type EnvSource } from "@/server/config/env";

const BASE: EnvSource = { NODE_ENV: "production", APP_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://hiloluna.com" };
const errors = (env: EnvSource) => validateEnv(env).problems.filter((problem) => problem.severity === "error").map((problem) => problem.variable);
const warnings = (env: EnvSource) => validateEnv(env).problems.filter((problem) => problem.severity === "warning").map((problem) => problem.variable);

describe("(4/52) validación del correo transaccional", () => {
  it("sin RESEND_API_KEY en producción: solo un AVISO (no bloquea el arranque)", () => {
    expect(errors(BASE)).not.toContain("RESEND_API_KEY");
    expect(warnings(BASE)).toContain("RESEND_API_KEY");
  });

  it("con EMAIL_REQUIRED=true y sin clave: el arranque en producción FALLA", () => {
    expect(errors({ ...BASE, EMAIL_REQUIRED: "true" })).toContain("RESEND_API_KEY");
  });

  it("con EMAIL_REQUIRED=true y clave completa: sin errores DE CORREO (las demás variables ausentes no son de este grupo)", () => {
    const emailErrors = errors({ ...BASE, EMAIL_REQUIRED: "true", RESEND_API_KEY: "re_abc123456", EMAIL_FROM: "Hilo Luna <a@hiloluna.com>" }).filter((variable) => /^(RESEND|EMAIL)_/.test(variable));
    expect(emailErrors).toEqual([]);
  });

  it("EMAIL_FROM inválido con la clave presente es un ERROR en producción (nunca el valor en el mensaje)", () => {
    const report = validateEnv({ ...BASE, RESEND_API_KEY: "re_abc123456", EMAIL_FROM: "correo-invalido-secreto" });
    expect(errors({ ...BASE, RESEND_API_KEY: "re_abc123456", EMAIL_FROM: "correo-invalido-secreto" })).toContain("EMAIL_FROM");
    expect(JSON.stringify(report)).not.toContain("correo-invalido-secreto");
  });

  it("en desarrollo nada del correo es obligatorio", () => {
    expect(validateEnv({ NODE_ENV: "development" }).ok).toBe(true);
  });

  it("staging con proveedor listo pero SIN lista blanca: aviso (fail-closed silencioso, pero se avisa)", () => {
    const env: EnvSource = { ...BASE, APP_ENV: "staging", NEXT_PUBLIC_SITE_URL: "https://staging.hiloluna.com", RESEND_API_KEY: "re_abc123456", EMAIL_FROM: "a@hiloluna.com" };
    expect(warnings(env)).toContain("EMAIL_STAGING_ALLOWLIST");
  });

  it("staging con lista blanca: sin avisos de correo", () => {
    const env: EnvSource = { ...BASE, APP_ENV: "staging", NEXT_PUBLIC_SITE_URL: "https://staging.hiloluna.com", RESEND_API_KEY: "re_abc123456", EMAIL_FROM: "a@hiloluna.com", EMAIL_STAGING_ALLOWLIST: "owner@example.com" };
    expect(warnings(env)).not.toContain("EMAIL_STAGING_ALLOWLIST");
  });
});
