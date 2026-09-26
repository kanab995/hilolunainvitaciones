import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GuestQrDialog } from "@/components/share/guest-qr-dialog";
import { ShareInvitationDialog } from "@/components/share/share-invitation-dialog";
import { getGuestInvitationUrl } from "@/lib/site-url";
import { deriveDemoInviteToken } from "@/server/services/invite-token";
import { visibleText } from "../invitation/helpers";

/** Radix pinta el diálogo en un portal (no existe al renderizar en servidor): se sustituye por contenedores planos para inspeccionar su contenido. */
vi.mock("@/components/ui/dialog", () => {
  const box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null), DialogContent: box, DialogHeader: box, DialogTitle: box, DialogDescription: box, DialogFooter: box, DialogClose: box };
});

const TOKEN = deriveDemoInviteToken("gst_demo_1");
const share = (state: "draft" | "published" | "changes") =>
  renderToStaticMarkup(<ShareInvitationDialog open onOpenChange={() => {}} title="Andrea & Fernando" slug="andrea-y-fernando" state={state} eventId="evt_1" />);
const guest = (state: "draft" | "published" | "changes") =>
  renderToStaticMarkup(<GuestQrDialog guest={{ name: "Mariana López", inviteUrl: getGuestInvitationUrl("andrea-y-fernando", TOKEN) }} slug="andrea-y-fernando" state={state} eventId="evt_1" onClose={() => {}} />);

describe("Modal «Compartir invitación» (compartido por dashboard, editor y lista de eventos)", () => {
  it("(38.1) en borrador pide publicar y NO muestra enlace, QR ni calendario", () => {
    const html = share("draft");
    expect(visibleText(html)).toContain("Publica tu invitación para poder compartirla.");
    expect(html).not.toContain("/i/andrea-y-fernando");
    expect(html).not.toContain("<svg viewBox");
    expect(html).not.toContain("calendar.ics");
    expect(html).toContain("/dashboard/events/evt_1/edit");
  });

  it("(38.2) publicada: enlace público, copiar, código QR y calendario", () => {
    const html = share("published");
    const text = visibleText(html);
    expect(html).toMatch(/<input[^>]*value="[^"]*\/i\/andrea-y-fernando"/);
    expect(text).toContain("Copiar enlace");
    expect(html).toContain('aria-label="Código QR para abrir la invitación"');
    expect(text).toContain("Descargar QR");
    expect(html).toContain("/i/andrea-y-fernando/calendar.ics");
    expect(text).not.toContain("Publica tu invitación para poder compartirla.");
  });

  it("(38.3) con «Cambios sin publicar» comparte lo mismo que publicada (misma URL, mismo QR)", () => {
    const note = "Compartes la última versión publicada. Tus cambios nuevos se verán cuando los publiques.";
    expect(visibleText(share("changes"))).toContain(note);
    expect(share("changes").replace(/<p class="rounded[^>]*>[^<]*<\/p>/, "")).toBe(share("published"));
  });

  it("(2) el botón «Compartir» de Web Share no se renderiza en servidor (solo si el navegador lo soporta)", () => {
    expect(visibleText(share("published"))).not.toMatch(/\bCompartir\b(?! invitación)/);
  });

  it("(33) sin alert(): el feedback se anuncia con aria-live", () => {
    expect(share("published")).toContain('role="status"'); // role=status = región aria-live polite
  });
});

describe("Modal «Ver QR» de un invitado", () => {
  it("(21/22) título «Invitación de Mariana López», QR, Descargar QR y Copiar enlace", () => {
    const html = guest("published");
    const text = visibleText(html);
    expect(text).toContain("Invitación de Mariana López");
    expect(html).toContain('aria-label="Código QR para abrir la invitación de Mariana López"');
    expect(text).toContain("Descargar QR");
    expect(text).toContain("Copiar enlace");
  });

  it("(23) el token NUNCA aparece como texto ni se muestra el enlace; tampoco el id", () => {
    const html = guest("published");
    expect(html).not.toContain(TOKEN);
    expect(html).not.toContain("guest=");
    expect(html).not.toContain("gst_demo_1");
  });

  it("(24) no descarga nada por sí solo: solo botones (sin auto-descarga ni enlaces con download)", () => {
    expect(guest("published")).not.toMatch(/<a[^>]* download/);
  });

  it("en borrador no hay QR del invitado: pide publicar", () => {
    const html = guest("draft");
    expect(visibleText(html)).toContain("Publica tu invitación para poder compartirla.");
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain(TOKEN);
  });
});
