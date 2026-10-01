import { describe, expect, it } from "vitest";
import { resolveMonitoringConfig, scrubBreadcrumb, scrubEvent } from "@/server/observability/monitoring";

describe("(9) resolveMonitoringConfig", () => {
  it("sin SENTRY_DSN: not_configured (opcional, no es un error)", () => {
    expect(resolveMonitoringConfig({})).toEqual({ status: "not_configured" });
  });

  it("un DSN con formato inválido es un problema con nombre de variable, nunca con su valor", () => {
    const result = resolveMonitoringConfig({ SENTRY_DSN: "no-es-un-dsn" });
    expect(result.status).toBe("invalid");
    expect(JSON.stringify(result)).toContain("SENTRY_DSN");
  });

  it("con un DSN válido: listo, y el entorno sale de SENTRY_ENVIRONMENT > APP_ENV > NODE_ENV", () => {
    const dsn = "https://clave@o123456.ingest.sentry.io/7654321";
    expect(resolveMonitoringConfig({ SENTRY_DSN: dsn })).toEqual({ status: "ready", dsn, environment: "development" });
    expect(resolveMonitoringConfig({ SENTRY_DSN: dsn, NODE_ENV: "production" })).toMatchObject({ environment: "production" });
    expect(resolveMonitoringConfig({ SENTRY_DSN: dsn, NODE_ENV: "production", APP_ENV: "staging" })).toMatchObject({ environment: "staging" });
    expect(resolveMonitoringConfig({ SENTRY_DSN: dsn, NODE_ENV: "production", APP_ENV: "staging", SENTRY_ENVIRONMENT: "hiloluna-staging" })).toMatchObject({ environment: "hiloluna-staging" });
  });
});

describe("(8) scrubEvent / scrubBreadcrumb: nunca petición, usuario, ni datos con forma de secreto/PII", () => {
  it("elimina siempre request y user, sin importar lo que traigan", () => {
    const event = scrubEvent({ request: { headers: { cookie: "session=abc" }, data: "cuerpo del RSVP" }, user: { email: "invitado@ejemplo.com", id: "user_123" } });
    expect(event).not.toHaveProperty("request");
    expect(event).not.toHaveProperty("user");
  });

  it("sanea el mensaje de la excepción (correos, tokens, claves) igual que el registro", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"; // 32 caracteres, como los de invitación (mixto: nunca se confunde con un NOMBRE de variable)
    const event = scrubEvent({ exception: { values: [{ value: `fallo con guest@ejemplo.com y token ${token}` }] } });
    const value = event.exception?.values?.[0]?.value ?? "";
    expect(value).not.toContain("guest@ejemplo.com");
    expect(value).not.toContain(token);
    expect(value).toContain("[correo]");
  });

  it("sanea claves de Stripe/Resend/webhook dentro del mensaje", () => {
    for (const secret of ["sk_live_ABCDEFGHIJKL123456", "whsec_ABCDEFGHIJKL123456", "re_ABCDEFGHIJKL123456"]) {
      const event = scrubEvent({ message: `algo falló: ${secret}` });
      expect(event.message, secret).not.toContain(secret);
      expect(event.message).toContain("[clave]");
    }
  });

  it("sanea los valores de texto de `extra`", () => {
    const event = scrubEvent({ extra: { detail: "correo de contacto: dueno@hiloluna.com", count: 3 } });
    expect(event.extra?.detail).not.toContain("dueno@hiloluna.com");
    expect(event.extra?.count).toBe(3);
  });

  it("las migas de pan sanean el mensaje y descartan cualquier dato adjunto (podría llevar querystring o cuerpos)", () => {
    const breadcrumb = scrubBreadcrumb({ message: "GET /i/andrea?guest=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", data: { url: "https://…", body: "secreto" } });
    expect(breadcrumb.message).not.toMatch(/guest=AAAA/);
    expect(breadcrumb).not.toHaveProperty("data");
  });
});
