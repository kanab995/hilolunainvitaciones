import { after } from "next/server";
import { logger } from "@/server/observability/logger";

/**
 * SIDE EFFECT DESPUÉS DE LA RESPUESTA (D-36, encargo punto 22). Decisión: usar `after()` de Next 16 (estable, soportado en
 * Server Actions y Route Handlers — exactamente donde se dispara un correo: la acción del RSVP público y el webhook de
 * Stripe). La respuesta al invitado o al proveedor de pagos NUNCA espera a que Resend responda; el correo se intenta después
 * de que la respuesta ya se envió, con un tiempo máximo acotado (`server/email/service.ts`). No se introduce una cola (Redis
 * u otra): un único intento por disparo, con reintento manual preparado (`retryFailedEmailDelivery`, sin interfaz todavía).
 * Fuera del ciclo de vida de una petición (pruebas, scripts, `next build`) `after()` lanza: aquí se captura y el efecto se
 * ejecuta igual, sin bloquear el resultado de la función que lo programó (no se espera su promesa).
 */
export function runAfterResponse(effect: () => Promise<void>): void {
  try {
    after(effect);
  } catch {
    void effect().catch((error: unknown) => logger.error("email.after_fallback_failed", error));
  }
}
