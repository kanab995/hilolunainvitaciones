import { siteConfig } from "@/lib/site-config";
import { escapeHtml } from "@/server/email/sanitize";

/**
 * PLANTILLAS DE CORREO (D-36). Funciones PURAS: reciben datos ya resueltos por el servicio (nunca leen Prisma ni Clerk) y
 * devuelven `{ subject, html, text }`. Estrictamente transaccionales, en español, cálidas pero sobrias:
 *  - Marfil, sin gradientes ni efectos: mismos tokens que `design/DESIGN_SYSTEM.md` (`--lu-canvas`, `--lu-ink`…), pero en un
 *    documento de correo aparte (regla 2/CLAUDE.md §7: las invitaciones públicas ya tienen su propio lenguaje visual,
 *    independiente del producto; el correo es un tercer contexto con las mismas restricciones de fidelidad de marca).
 *  - Fuentes seguras de correo (`Georgia`/`Helvetica`), no `next/font`: los clientes de correo no cargan fuentes web.
 *  - Sin imágenes del evento ni del R2 del usuario (punto 24): solo la wordmark en texto. Funciona con las imágenes
 *    desactivadas del cliente de correo.
 *  - Toda variable (nombre del invitado, título del evento) se ESCAPA antes de insertarse en el HTML.
 *  - Siempre HTML + texto plano (punto 25).
 */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const COLORS = { canvas: "#FDFBF8", surface: "#FEFDFA", border: "#EFECE7", ink: "#21170D", onInk: "#F7F8F3", text: "#1A1410", secondary: "#555149", muted: "#6E6867" };

/** Envoltorio HTML común (cabecera con la wordmark, cuerpo, botón, pie). `bodyHtml` ya viene escapado por el llamador. */
function shell(input: { preheader: string; heading: string; bodyHtml: string; ctaLabel: string; ctaUrl: string }): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(siteConfig.name)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.canvas};font-family:Georgia,'Times New Roman',serif;color:${COLORS.text};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.canvas};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:0.04em;color:${COLORS.ink};">${escapeHtml(siteConfig.name)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.35;color:${COLORS.text};">${escapeHtml(input.heading)}</h1>
                <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${COLORS.secondary};">${input.bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 32px;">
                <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.onInk};font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">${escapeHtml(input.ctaLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid ${COLORS.border};">
                <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.muted};">Este es un correo transaccional de ${escapeHtml(siteConfig.name)} sobre tu evento. No es una campaña ni un boletín.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" });
export const formatEmailDate = (date: Date): string => dateFormatter.format(date);
export const formatEmailAmount = (amount: number, currency: string): string => `$${amount.toLocaleString("es-MX")} ${currency}`;

// ───────── 1. Notificación de RSVP al anfitrión (encargo puntos 9-10) ─────────

export type RsvpNotificationStatus = "ATTENDING" | "DECLINED" | "MAYBE";

export interface RsvpNotificationEmailInput {
  eventTitle: string;
  eventUrl: string;
  guestName: string;
  status: RsvpNotificationStatus;
  /** Solo con `ATTENDING`; incluye al invitado principal. */
  attendeeCount: number | null;
}

const rsvpVerb: Record<RsvpNotificationStatus, string> = { ATTENDING: "confirmó su asistencia", DECLINED: "no podrá asistir", MAYBE: "respondió «tal vez»" };

/**
 * NUNCA incluye: `inviteToken`, el id interno del invitado, ids de Clerk, ni el mensaje que dejó el invitado (punto 10: se
 * queda en el dashboard). El asunto lleva el NOMBRE del invitado y la respuesta, pero nada más personal.
 */
export function rsvpNotificationEmail(input: RsvpNotificationEmailInput): EmailContent {
  const guest = escapeHtml(input.guestName);
  const event = escapeHtml(input.eventTitle);
  const subject = `${input.guestName} ${rsvpVerb[input.status]}`;
  const countLine = input.status === "ATTENDING" && input.attendeeCount ? `<p style="margin:0 0 12px;">Número de asistentes: <strong>${input.attendeeCount}</strong>.</p>` : "";
  const heading = `Nueva respuesta en «${input.eventTitle}»`;
  const html = shell({
    preheader: `${input.guestName} ${rsvpVerb[input.status]}.`,
    heading,
    bodyHtml: `<p style="margin:0 0 12px;"><strong>${guest}</strong> ${rsvpVerb[input.status]} para <strong>${event}</strong>.</p>${countLine}`,
    ctaLabel: "Ver invitados",
    ctaUrl: input.eventUrl,
  });
  const text = [`Nueva respuesta en «${input.eventTitle}»`, "", `${input.guestName} ${rsvpVerb[input.status]}.`, input.status === "ATTENDING" && input.attendeeCount ? `Número de asistentes: ${input.attendeeCount}.` : "", "", `Ver invitados: ${input.eventUrl}`].filter(Boolean).join("\n");
  return { subject, html, text };
}

// ───────── 2 y 3. Confirmación de compra / mejora (encargo puntos 13-16) ─────────

export interface PurchaseConfirmationEmailInput {
  eventTitle: string;
  eventUrl: string;
  planName: string;
  /** Unidades enteras (pesos), de la compra REAL (`EventPurchase.amount`), nunca reconstruido en la interfaz. */
  amount: number;
  currency: string;
  paidAt: Date;
  accessEndsAt: Date | null;
}

/** Nota legal (punto 16): este correo NO es una factura ni un recibo fiscal. Stripe gestiona el suyo si está configurado. */
export function purchaseConfirmationEmail(input: PurchaseConfirmationEmailInput): EmailContent {
  const event = escapeHtml(input.eventTitle);
  const amountText = formatEmailAmount(input.amount, input.currency);
  const accessLine = input.accessEndsAt ? `<p style="margin:0 0 12px;">Tu invitación estará disponible hasta el <strong>${escapeHtml(formatEmailDate(input.accessEndsAt))}</strong>.</p>` : "";
  const html = shell({
    preheader: `Confirmamos que tu evento se actualizó a ${input.planName}.`,
    heading: `Tu evento ya tiene Hilo Luna ${input.planName}`,
    bodyHtml: `<p style="margin:0 0 12px;">Confirmamos que tu evento <strong>${event}</strong> se actualizó correctamente al plan <strong>${escapeHtml(input.planName)}</strong>.</p><p style="margin:0 0 12px;">Pago: <strong>${escapeHtml(amountText)}</strong> · ${escapeHtml(formatEmailDate(input.paidAt))}.</p>${accessLine}<p style="margin:0;font-size:13px;color:${COLORS.muted};">Este correo no es una factura ni un recibo fiscal.</p>`,
    ctaLabel: "Abrir evento",
    ctaUrl: input.eventUrl,
  });
  const text = [`Tu evento ya tiene Hilo Luna ${input.planName}`, "", `Confirmamos que tu evento «${input.eventTitle}» se actualizó correctamente al plan ${input.planName}.`, `Pago: ${amountText} · ${formatEmailDate(input.paidAt)}.`, input.accessEndsAt ? `Tu invitación estará disponible hasta el ${formatEmailDate(input.accessEndsAt)}.` : "", "Este correo no es una factura ni un recibo fiscal.", "", `Abrir evento: ${input.eventUrl}`].filter(Boolean).join("\n");
  return { subject: `Tu evento ya tiene Hilo Luna ${input.planName}`, html, text };
}

export interface UpgradeConfirmationEmailInput {
  eventTitle: string;
  eventUrl: string;
  /** Unidades enteras (pesos): la DIFERENCIA real pagada (p. ej. 300), nunca el precio completo de Premium. */
  amount: number;
  currency: string;
  paidAt: Date;
  accessEndsAt: Date | null;
}

export function upgradeConfirmationEmail(input: UpgradeConfirmationEmailInput): EmailContent {
  const event = escapeHtml(input.eventTitle);
  const amountText = formatEmailAmount(input.amount, input.currency);
  const accessLine = input.accessEndsAt ? `<p style="margin:0 0 12px;">Tu invitación estará disponible hasta el <strong>${escapeHtml(formatEmailDate(input.accessEndsAt))}</strong>.</p>` : "";
  const html = shell({
    preheader: "Confirmamos que tu evento se actualizó correctamente a Premium.",
    heading: "Tu evento ahora es Premium",
    bodyHtml: `<p style="margin:0 0 12px;">Confirmamos que tu evento <strong>${event}</strong> se actualizó correctamente a <strong>Premium</strong>.</p><p style="margin:0 0 12px;">Mejora pagada: <strong>${escapeHtml(amountText)}</strong> · ${escapeHtml(formatEmailDate(input.paidAt))}.</p>${accessLine}<p style="margin:0;font-size:13px;color:${COLORS.muted};">Este correo no es una factura ni un recibo fiscal.</p>`,
    ctaLabel: "Abrir evento",
    ctaUrl: input.eventUrl,
  });
  const text = [
    "Tu evento ahora es Premium",
    "",
    `Confirmamos que tu evento «${input.eventTitle}» se actualizó correctamente a Premium.`,
    `Mejora pagada: ${amountText} · ${formatEmailDate(input.paidAt)}.`,
    input.accessEndsAt ? `Tu invitación estará disponible hasta el ${formatEmailDate(input.accessEndsAt)}.` : "",
    "Este correo no es una factura ni un recibo fiscal.",
    "",
    `Abrir evento: ${input.eventUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject: "Tu evento ahora es Premium", html, text };
}
