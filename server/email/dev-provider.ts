import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/server/email/provider";
import { logger } from "@/server/observability/logger";

/**
 * PROVEEDOR DE DESARROLLO (D-36): sin `RESEND_API_KEY` (típico en `development`), este proveedor sustituye al real. NO manda
 * ningún correo, pero permite probar la plantilla y el servicio de principio a fin (idempotencia, EmailDelivery, staging
 * safety…). Se registra un aviso mínimo (tipo de correo y destinatario ENMASCARADO): nunca el asunto, el cuerpo ni el correo
 * completo, para no llenar la consola de desarrollo con contenido privado (punto 29 del encargo).
 */
const maskRecipient = (to: string): string => {
  const [user = "", domain = ""] = to.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(0, user.length - 2))}@${domain}`;
};

export class DevEmailProvider implements EmailProvider {
  readonly id = "dev" as const;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    logger.info("email.dev_preview", { to: maskRecipient(message.to) });
    return { ok: true, providerMessageId: `dev-${randomUUID()}` };
  }
}
