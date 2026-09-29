import { Resend } from "resend";
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/server/email/provider";
import { sanitizeHeaderValue } from "@/server/email/sanitize";

/**
 * ADAPTADOR DE RESEND (D-36): el ÚNICO módulo que importa su SDK. Traduce `EmailMessage` a su forma y viceversa. Nunca registra
 * el cuerpo, el destinatario ni la clave de API; el llamador (`server/email/service.ts`) es quien decide qué se registra.
 *  - `subject`, `from` y `replyTo` se limpian de saltos de línea aquí también (segunda capa: la primera es
 *    `server/email/sanitize.ts`, antes de construir el mensaje).
 *  - Sin seguimiento de aperturas ni clics (D-36 punto 20): Resend no los activa salvo que se pida explícitamente; aquí no se pide.
 *  - Sin webhook de Resend todavía (D-36 punto 45): `SENT` solo significa que el proveedor ACEPTÓ el mensaje, no que se entregó.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly id = "resend" as const;
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly replyTo?: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const replyTo = message.replyTo ?? this.replyTo;
    try {
      const result = await this.client.emails.send({
        from: sanitizeHeaderValue(this.from),
        to: [message.to],
        subject: sanitizeHeaderValue(message.subject),
        html: message.html,
        text: message.text,
        ...(replyTo ? { replyTo: sanitizeHeaderValue(replyTo) } : {}),
      });
      if (result.error) return { ok: false, errorCode: result.error.name || "resend_error" };
      const id = result.data?.id;
      if (!id) return { ok: false, errorCode: "no_message_id" };
      return { ok: true, providerMessageId: id };
    } catch (error) {
      const code = typeof error === "object" && error !== null && "name" in error && typeof (error as { name?: unknown }).name === "string" ? (error as { name: string }).name : "unknown_error";
      return { ok: false, errorCode: code };
    }
  }
}
