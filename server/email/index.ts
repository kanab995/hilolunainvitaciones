import { resolveEmailConfig, type EmailEnv } from "@/server/email/config";
import { DevEmailProvider } from "@/server/email/dev-provider";
import type { EmailProviderState } from "@/server/email/provider";
import { ResendEmailProvider } from "@/server/email/resend-provider";
import { logger } from "@/server/observability/logger";

/**
 * PROVEEDOR DE CORREO ACTIVO (D-36). Único punto que decide qué adaptador se usa, mismo patrón que `server/billing/index.ts`:
 *  - `RESEND_API_KEY` configurada y válida → Resend real.
 *  - Sin configurar y `NODE_ENV !== "production"` (desarrollo o pruebas) → `DevEmailProvider` (no manda nada, pero permite
 *    probar la plantilla y el servicio de punta a punta; punto 29 del encargo).
 *  - Sin configurar en cualquier otro entorno (staging/producción sin clave) → `not_configured`: el servicio de correo se
 *    salta el envío y lo registra (`email.skipped`), sin fallar nada; `EMAIL_REQUIRED=true` lo convierte en error de arranque
 *    (`server/config/env.ts`).
 *  - Configuración inconsistente (p. ej. `EMAIL_FROM` con formato inválido) → `invalid`.
 */
let cached: { key: string; state: EmailProviderState } | undefined;
const reported = new Set<string>();

export function getEmailProviderState(env: EmailEnv = process.env): EmailProviderState {
  const resolved = resolveEmailConfig(env);
  // `NODE_ENV` entra en la clave: sin configurar, el resultado depende de él (DevEmailProvider solo fuera de producción) y
  // `resolved` por sí solo es idéntico en ambos casos (`{ status: "not_configured" }`).
  const key = JSON.stringify([resolved, env.NODE_ENV]);
  if (cached?.key === key) return cached.state;

  let state: EmailProviderState;
  if (resolved.status === "ready") {
    state = { status: "ready", provider: new ResendEmailProvider(resolved.config.apiKey, resolved.config.from, resolved.config.replyTo) };
  } else if (resolved.status === "invalid") {
    const summary = resolved.problems.join(" | ");
    if (!reported.has(summary)) {
      reported.add(summary);
      logger.error("email.config_invalid", undefined, { problems: summary });
    }
    state = { status: "invalid", problems: resolved.problems };
  } else if (env.NODE_ENV !== "production") {
    state = { status: "ready", provider: new DevEmailProvider() };
  } else {
    state = { status: "not_configured" };
  }
  cached = { key, state };
  return state;
}
