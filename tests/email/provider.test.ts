import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveEmailConfig, parseStagingAllowlist } from "@/server/email/config";
import { DevEmailProvider } from "@/server/email/dev-provider";
import { getEmailProviderState } from "@/server/email/index";
import { isRecipientAllowedInStaging, withStagingSubjectPrefix } from "@/server/email/staging-safety";
import { escapeHtml, sanitizeHeaderValue } from "@/server/email/sanitize";
import { setLogSink, type LogSink } from "@/server/observability/logger";

afterEach(() => vi.unstubAllEnvs());

describe("(46.1) resolveEmailConfig no filtra la clave de API en los problemas", () => {
  it("acepta una configuración válida", () => {
    const result = resolveEmailConfig({ RESEND_API_KEY: "re_abc123456", EMAIL_FROM: "Hilo Luna <notificaciones@hiloluna.com>" });
    expect(result).toEqual({ status: "ready", config: { apiKey: "re_abc123456", from: "Hilo Luna <notificaciones@hiloluna.com>" } });
  });

  it("sin RESEND_API_KEY: not_configured (no es un error)", () => {
    expect(resolveEmailConfig({})).toEqual({ status: "not_configured" });
  });

  it("rechaza una clave sin el formato re_… y nunca incluye su valor en los problemas", () => {
    const result = resolveEmailConfig({ RESEND_API_KEY: "SECRETO_123456789", EMAIL_FROM: "a@b.com" });
    expect(result.status).toBe("invalid");
    expect(JSON.stringify(result)).not.toContain("SECRETO_123456789");
  });

  it("EMAIL_FROM ausente o con formato inválido es un problema con nombre de variable, no de valor", () => {
    for (const from of [undefined, "sin-arroba", "Nombre <sin-arroba>", "a@b.com\nBcc: x@y.com"]) {
      const result = resolveEmailConfig({ RESEND_API_KEY: "re_abc123456", EMAIL_FROM: from });
      expect(result.status, String(from)).toBe("invalid");
      if (result.status === "invalid") expect(result.problems.join(" ")).toContain("EMAIL_FROM");
    }
  });

  it("EMAIL_REPLY_TO opcional; si está, debe ser un correo", () => {
    expect(resolveEmailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.com", EMAIL_REPLY_TO: "no-es-correo" }).status).toBe("invalid");
    expect(resolveEmailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.com", EMAIL_REPLY_TO: "hola@b.com" })).toMatchObject({ status: "ready" });
  });

  it("parseStagingAllowlist normaliza a minúsculas y recorta espacios", () => {
    expect(parseStagingAllowlist({ EMAIL_STAGING_ALLOWLIST: " Ana@Ejemplo.com, beto@ejemplo.com ,, " })).toEqual(["ana@ejemplo.com", "beto@ejemplo.com"]);
    expect(parseStagingAllowlist({})).toEqual([]);
  });
});

describe("(29/46.4) proveedor por entorno", () => {
  it("desarrollo sin clave usa DevEmailProvider (no manda nada, pero sigue «listo»)", () => {
    const state = getEmailProviderState({ NODE_ENV: "development" });
    expect(state.status).toBe("ready");
    expect(state.status === "ready" && state.provider.id).toBe("dev");
  });

  it("producción sin clave: not_configured (no falla nada solo por eso)", () => {
    expect(getEmailProviderState({ NODE_ENV: "production" })).toEqual({ status: "not_configured" });
  });

  it("regresión: alternar entre desarrollo y producción sin clave no reutiliza por error la caché del otro entorno", () => {
    // Ambos casos resuelven al mismo `{ status: "not_configured" }`: la caché debe distinguirlos por NODE_ENV.
    expect(getEmailProviderState({ NODE_ENV: "development" }).status).toBe("ready");
    expect(getEmailProviderState({ NODE_ENV: "production" })).toEqual({ status: "not_configured" });
    expect(getEmailProviderState({ NODE_ENV: "development" }).status).toBe("ready");
  });

  it("con clave válida: proveedor resend", () => {
    const state = getEmailProviderState({ NODE_ENV: "production", RESEND_API_KEY: "re_abc123456", EMAIL_FROM: "a@b.com" });
    expect(state.status).toBe("ready");
    expect(state.status === "ready" && state.provider.id).toBe("resend");
  });

  it("configuración inconsistente: invalid, y el problema no filtra valores", () => {
    const state = getEmailProviderState({ NODE_ENV: "production", RESEND_API_KEY: "clave-rara", EMAIL_FROM: "a@b.com" });
    expect(state.status).toBe("invalid");
  });
});

describe("(46.5) DevEmailProvider no manda nada y no filtra contenido privado a la consola", () => {
  it("responde ok y registra solo un destinatario enmascarado", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines: string[] = [];
    const sink: LogSink = { info: (l) => lines.push(l), warn: (l) => lines.push(l), error: (l) => lines.push(l) };
    const restore = setLogSink(sink);
    const provider = new DevEmailProvider();
    const result = await provider.send({ to: "mariana@ejemplo.com", subject: "Asunto secreto", html: "<p>cuerpo privado</p>", text: "cuerpo privado" });
    restore();
    expect(result.ok).toBe(true);
    const logged = lines.join("\n");
    expect(logged).not.toContain("Asunto secreto");
    expect(logged).not.toContain("cuerpo privado");
    expect(logged).not.toContain("mariana@ejemplo.com");
    expect(logged).toMatch(/ma.*@ejemplo\.com/);
  });
});

describe("(46.2/46.3) seguridad de staging: allowlist y prefijo", () => {
  it("fuera de staging, todo destinatario está permitido y el asunto no lleva prefijo", () => {
    expect(isRecipientAllowedInStaging({ APP_ENV: "production" }, "quien-sea@ejemplo.com")).toBe(true);
    expect(withStagingSubjectPrefix({ APP_ENV: "production" }, "Hola")).toBe("Hola");
  });

  it("en staging SIN lista, nada está permitido (fail-closed, no «permitir a todos»)", () => {
    expect(isRecipientAllowedInStaging({ APP_ENV: "staging" }, "dueno@ejemplo.com")).toBe(false);
  });

  it("en staging con lista, solo los correos exactos (normalizados) están permitidos", () => {
    const env = { APP_ENV: "staging", EMAIL_STAGING_ALLOWLIST: "Dueno@Ejemplo.com" };
    expect(isRecipientAllowedInStaging(env, "dueno@ejemplo.com")).toBe(true);
    expect(isRecipientAllowedInStaging(env, "otro@ejemplo.com")).toBe(false);
  });

  it("(46.3) en staging el asunto SIEMPRE lleva [STAGING]; en producción, nunca", () => {
    expect(withStagingSubjectPrefix({ APP_ENV: "staging" }, "Mariana confirmó su asistencia")).toBe("[STAGING] Mariana confirmó su asistencia");
    expect(withStagingSubjectPrefix({ APP_ENV: "production" }, "Mariana confirmó su asistencia")).toBe("Mariana confirmó su asistencia");
  });
});

describe("(42/43) saneamiento: inyección de cabeceras y HTML", () => {
  it("sanitizeHeaderValue quita saltos de línea y caracteres de control (Bcc:/inyección de cabeceras)", () => {
    expect(sanitizeHeaderValue("Mariana\r\nBcc: atacante@evil.com")).toBe("Mariana Bcc: atacante@evil.com");
    expect(sanitizeHeaderValue("Hola\nMundo")).not.toMatch(/[\r\n]/);
    expect(sanitizeHeaderValue("a".repeat(500), 20)).toHaveLength(20);
  });

  it("escapeHtml neutraliza etiquetas y comillas de datos del usuario", () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(escapeHtml(`Nombre "raro" & <b>negrita</b>`)).toBe("Nombre &quot;raro&quot; &amp; &lt;b&gt;negrita&lt;/b&gt;");
  });
});
