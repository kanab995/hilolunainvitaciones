import { describe, expect, it } from "vitest";
import { purchaseConfirmationEmail, rsvpNotificationEmail, upgradeConfirmationEmail } from "@/server/email/templates";

const eventUrl = "https://hiloluna.com/dashboard/events/evt_1/guests";

describe("(9/10/47.5) rsvpNotificationEmail", () => {
  it("el asunto y el cuerpo usan el nombre del invitado y la respuesta, con HTML y texto plano", () => {
    const content = rsvpNotificationEmail({ eventTitle: "Andrea & Fernando", eventUrl, guestName: "Mariana López", status: "ATTENDING", attendeeCount: 3 });
    expect(content.subject).toBe("Mariana López confirmó su asistencia");
    expect(content.html).toContain("Mariana López");
    expect(content.html).toContain("Andrea &amp; Fernando");
    expect(content.html).toContain("3");
    expect(content.text).toContain("Mariana López confirmó su asistencia");
    expect(content.text).toContain("Ver invitados: " + eventUrl);
  });

  it('DECLINED y MAYBE tienen su propio verbo, y DECLINED/MAYBE nunca muestran número de asistentes', () => {
    const declined = rsvpNotificationEmail({ eventTitle: "Boda", eventUrl, guestName: "Beto", status: "DECLINED", attendeeCount: null });
    expect(declined.subject).toBe("Beto no podrá asistir");
    expect(declined.html).not.toMatch(/asistentes/i);
    const maybe = rsvpNotificationEmail({ eventTitle: "Boda", eventUrl, guestName: "Ana", status: "MAYBE", attendeeCount: null });
    expect(maybe.subject).toBe('Ana respondió «tal vez»');
  });

  it("(10/47.5) NUNCA incluye inviteToken, ids internos, ids de Clerk ni el mensaje del invitado", () => {
    const content = rsvpNotificationEmail({ eventTitle: "Boda", eventUrl, guestName: "Mariana", status: "ATTENDING", attendeeCount: 1 });
    const all = content.subject + content.html + content.text;
    expect(all).not.toMatch(/inviteToken|guestId|gst_|user_[A-Za-z0-9]{10,}|Felicidades|mensaje/i);
  });

  it("(43) el nombre del invitado y el título del evento se escapan en el HTML", () => {
    const content = rsvpNotificationEmail({ eventTitle: 'Fiesta <script>alert(1)</script>', eventUrl, guestName: '<b>Malicioso</b>', status: "ATTENDING", attendeeCount: 1 });
    expect(content.html).not.toContain("<script>");
    expect(content.html).not.toContain("<b>Malicioso</b>");
    expect(content.html).toContain("&lt;b&gt;Malicioso&lt;/b&gt;");
  });
});

describe("(13/14/47.3/47.4) purchaseConfirmationEmail", () => {
  it("Esencial muestra 499 MXN reales (nunca reconstruidos en la interfaz)", () => {
    const content = purchaseConfirmationEmail({ eventTitle: "Andrea & Fernando", eventUrl, planName: "Esencial", amount: 499, currency: "MXN", paidAt: new Date("2027-01-05T12:00:00Z"), accessEndsAt: new Date("2027-06-17T00:00:00Z") });
    expect(content.subject).toBe("Tu evento ya tiene Hilo Luna Esencial");
    expect(content.html).toContain("$499 MXN");
    expect(content.text).toContain("$499 MXN");
  });

  it("Premium inicial muestra 799 MXN", () => {
    const content = purchaseConfirmationEmail({ eventTitle: "Andrea & Fernando", eventUrl, planName: "Premium", amount: 799, currency: "MXN", paidAt: new Date(), accessEndsAt: null });
    expect(content.subject).toBe("Tu evento ya tiene Hilo Luna Premium");
    expect(content.html).toContain("$799 MXN");
  });

  it("(16) nunca se presenta como factura ni recibo fiscal", () => {
    const content = purchaseConfirmationEmail({ eventTitle: "Boda", eventUrl, planName: "Esencial", amount: 499, currency: "MXN", paidAt: new Date(), accessEndsAt: null });
    expect(content.html.toLowerCase()).toContain("no es una factura ni un recibo fiscal");
  });
});

describe("(15/47.5) upgradeConfirmationEmail", () => {
  it("muestra la DIFERENCIA real (300), no el precio completo de Premium (799)", () => {
    const content = upgradeConfirmationEmail({ eventTitle: "Andrea & Fernando", eventUrl, amount: 300, currency: "MXN", paidAt: new Date("2027-02-01T00:00:00Z"), accessEndsAt: null });
    expect(content.subject).toBe("Tu evento ahora es Premium");
    expect(content.html).toContain("$300 MXN");
    expect(content.html).not.toContain("$799");
    expect(content.text).not.toContain("$799");
  });
});
