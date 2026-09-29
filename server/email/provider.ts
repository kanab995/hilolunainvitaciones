/**
 * ABSTRACCIÓN DE CORREO TRANSACCIONAL (D-36). El dominio y los servicios dependen SOLO de esta interfaz: nadie fuera de
 * `server/email/*-provider.ts` importa el SDK de un proveedor concreto. Añadir otro proveedor es escribir otro adaptador que
 * la cumpla, sin tocar `server/email/service.ts` ni los llamadores. Mismo patrón que `server/billing/provider.ts` (D-32).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type EmailSendResult = { ok: true; providerMessageId: string } | { ok: false; errorCode: string };

export interface EmailProvider {
  readonly id: "resend" | "dev";
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Estado de la configuración de correo de este entorno (mismo patrón que `BillingProviderState`). */
export type EmailProviderState =
  | { status: "ready"; provider: EmailProvider }
  /** Sin `RESEND_API_KEY`: en desarrollo se usa `DevEmailProvider`; fuera de desarrollo, no se envía nada (se registra `email.skipped`). */
  | { status: "not_configured" }
  /** Configuración inconsistente (p. ej. `EMAIL_FROM` sin formato válido). `problems` nombra variables, nunca valores. */
  | { status: "invalid"; problems: string[] };
