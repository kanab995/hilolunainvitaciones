import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatDaysLeft, formatEventDate, formatRelativeTime, describeActivity } from "@/lib/dashboard/format";
import { getActiveNavId, getDashboardNav } from "@/lib/dashboard/navigation";
import { canUseWebShare, copyToClipboard } from "@/lib/dashboard/share";

describe("format", () => {
  it("fecha con mes capitalizado en la zona del evento", () => {
    expect(formatEventDate("2027-05-17T17:00:00-06:00", "America/Mexico_City")).toBe("17 Mayo 2027");
  });

  it("días restantes: plural, singular, menos de un día y pasado", () => {
    const now = Date.parse("2027-05-10T12:00:00-06:00");
    expect(formatDaysLeft("2027-05-17T12:00:00-06:00", now).label).toBe("Faltan 7 días");
    expect(formatDaysLeft("2027-05-11T12:00:00-06:00", now).label).toBe("Falta 1 día");
    expect(formatDaysLeft("2027-05-10T20:00:00-06:00", now).label).toBe("Falta menos de un día");
    expect(formatDaysLeft("2027-05-01T12:00:00-06:00", now).label).toBe("El evento ya pasó");
  });

  it("tiempo relativo largo y corto", () => {
    const now = Date.parse("2027-01-02T12:00:00Z");
    expect(formatRelativeTime("2027-01-02T10:00:00Z", now)).toEqual({ long: "Hace 2 horas", short: "2 h" });
    expect(formatRelativeTime("2027-01-01T10:00:00Z", now)).toEqual({ long: "Hace 1 día", short: "1 d" });
    expect(formatRelativeTime("2027-01-02T11:20:00Z", now).long).toBe("Hace 40 minutos");
  });

  it("frases de actividad", () => {
    expect(describeActivity({ type: "rsvp_confirmed" })).toBe("confirmó asistencia");
    expect(describeActivity({ type: "rsvp_confirmed", metadata: { guests: 3 } })).toBe("confirmó 3 invitados");
    expect(describeActivity({ type: "rsvp_declined" })).toBe("no asistirá");
    expect(describeActivity({ type: "invitation_viewed" })).toBe("está revisando su invitación");
  });
});

describe("navegación lateral", () => {
  const items = getDashboardNav("demo");

  it("expone los seis destinos con sus rutas", () => {
    expect(items.map((item) => [item.label, item.href])).toEqual([
      ["Mis eventos", "/dashboard/events"],
      ["Plantillas", "/templates"],
      ["Lista de invitados", "/dashboard/events/demo/guests"],
      ["Confirmaciones", "/dashboard/events/demo/rsvp"],
      ["Mensajes", "/dashboard/events/demo/messages"],
      ["Configuración", "/dashboard/events/demo/settings"],
    ]);
  });

  it("«Mis eventos» está activo en el evento y las secciones específicas ganan", () => {
    expect(getActiveNavId("/dashboard/events/demo", items)).toBe("events");
    expect(getActiveNavId("/dashboard/events", items)).toBe("events");
    expect(getActiveNavId("/dashboard/events/demo/rsvp", items)).toBe("rsvp");
    expect(getActiveNavId("/dashboard/events/demo/guests", items)).toBe("guests");
    expect(getActiveNavId("/templates", items)).toBe("templates");
    expect(getActiveNavId(null, items)).toBeUndefined();
  });
});

describe("copiar enlace", () => {
  it("usa la Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyToClipboard("https://x", { clipboard: { writeText } })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://x");
  });

  it("recurre al método clásico si la API falla y avisa si nada funciona", async () => {
    const area = { value: "", style: { position: "", opacity: "" }, setAttribute: vi.fn(), select: vi.fn() };
    const doc = { createElement: () => area, body: { appendChild: vi.fn(), removeChild: vi.fn() }, execCommand: vi.fn().mockReturnValue(true) };
    const denied = { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } };
    expect(await copyToClipboard("https://x", denied, doc)).toBe(true);
    expect(area.value).toBe("https://x");
    expect(doc.body.removeChild).toHaveBeenCalled();
    expect(await copyToClipboard("https://x", {}, undefined)).toBe(false);
  });

  it("detecta Web Share API", () => {
    expect(canUseWebShare({ share: () => undefined })).toBe(true);
    expect(canUseWebShare({})).toBe(false);
  });
});

describe("arquitectura del panel", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
  const sources = [...files(join(process.cwd(), "components/dashboard")), ...files(join(process.cwd(), "lib/dashboard"))];

  it("no usa tokens de invitación (`--inv-*`) ni depende de Prisma", () => {
    for (const file of sources) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toMatch(/--inv-/);
      expect(code, file).not.toMatch(/@prisma|from "next-auth|stripe/i);
    }
  });

  it("no incorpora logos ni marcas de terceros en los enlaces de compartir", () => {
    for (const file of sources) expect(readFileSync(file, "utf8"), file).not.toMatch(/whatsapp\.(svg|png)|instagram\.(svg|png)|facebook\.(svg|png)/i);
  });
});
