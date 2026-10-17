import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PrintProductCard } from "@/components/print/print-product-card";
import { DEFAULT_PRINT_OPTIONS } from "@/lib/print/options";
import { loadPrintFonts, type PrintFontSet } from "@/server/print/fonts";
import type { OwnedPublication } from "@/server/repositories/publishing";
import { getPrintFile, getPrintPageView, getPrintPreview, type PrintDeps } from "@/server/services/print-service";
import { demo } from "./fixtures";

const ROOT = process.cwd();
const user = { id: "usr_owner", email: "owner@example.com", name: "Owner" };
const published: OwnedPublication = { state: "published", invitation: demo, slug: "andrea-y-fernando", title: "Boda", publication: { version: 3, publishedAt: "2027-01-01T00:00:00.000Z" }, expired: false };

let fonts: PrintFontSet;
beforeAll(async () => {
  fonts = await loadPrintFonts();
});

function deps(overrides: Partial<PrintDeps> = {}): PrintDeps {
  return {
    loadPublication: vi.fn(async () => published),
    loadFonts: async () => fonts,
    getPlan: vi.fn(async () => "ESSENTIAL" as const),
    isAdmin: vi.fn(async () => false),
    publicUrl: (slug) => `https://hiloluna.com/i/${slug}`,
    rasterize: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    ...overrides,
  };
}

describe("página «Versión para imprimir»", () => {
  it("evento ajeno o inexistente → not_found; borrador → pide publicar; otro tipo de evento → no disponible", async () => {
    expect(await getPrintPageView(user, "evt", deps({ loadPublication: async () => undefined }))).toEqual({ status: "not_found" });
    expect(await getPrintPageView(user, "evt", deps({ loadPublication: async () => ({ state: "draft" }) }))).toEqual({ status: "draft" });
    expect(await getPrintPageView(user, "evt", deps({ loadPublication: async () => ({ ...published, invitation: { ...demo, eventType: "quinceanera" } }) }))).toEqual({ status: "unsupported" });
  });

  it("lista: versión publicada, iniciales, plan elegible, compra apagada y precio de $199", async () => {
    const view = await getPrintPageView(user, "evt", deps());
    expect(view).toMatchObject({ status: "ready", publicationVersion: 3, qrAvailable: true, defaultInitials: "AF", plan: "ESSENTIAL", eligible: true, purchasable: false, canDownload: false, price: 199, warnings: [] });
  });

  it("un evento Gratis ve la vista previa pero no es elegible; un acceso vencido no ofrece QR", async () => {
    expect(await getPrintPageView(user, "evt", deps({ getPlan: async () => "FREE" }))).toMatchObject({ status: "ready", eligible: false });
    expect(await getPrintPageView(user, "evt", deps({ loadPublication: async () => ({ ...published, expired: true }) }))).toMatchObject({ status: "ready", qrAvailable: false });
  });

  it("la propiedad viaja hasta la consulta (userId + eventId)", async () => {
    const d = deps();
    await getPrintPageView(user, "evt_42", d);
    expect(d.loadPublication).toHaveBeenCalledWith("usr_owner", "evt_42");
  });
});

describe("vista previa", () => {
  it("devuelve la imagen rasterizada de la cara pedida (con marca de agua)", async () => {
    const d = deps();
    const result = await getPrintPreview(user, "evt", DEFAULT_PRINT_OPTIONS, "front", d);
    expect(result).toMatchObject({ ok: true, contentType: "image/png" });
    const svg = vi.mocked(d.rasterize).mock.calls[0]?.[0] ?? "";
    expect(svg).toContain('fill-opacity="0.16"');
  });

  it("sin rasterizador NO hay vista previa (nunca el SVG vectorial); sin reverso no hay vista del reverso", async () => {
    expect(await getPrintPreview(user, "evt", DEFAULT_PRINT_OPTIONS, "back", deps({ rasterize: async () => undefined }))).toEqual({ ok: false });
    expect(await getPrintPreview(user, "evt", { ...DEFAULT_PRINT_OPTIONS, includeBack: false }, "back", deps())).toEqual({ ok: false });
    expect(await getPrintPreview(user, "evt", DEFAULT_PRINT_OPTIONS, "front", deps({ loadPublication: async () => ({ state: "draft" }) }))).toEqual({ ok: false });
  });
});

describe("PDF limpio (compra apagada)", () => {
  it("sin compra ni rol ADMIN no se genera NADA (ni se lee el evento)", async () => {
    const d = deps();
    expect(await getPrintFile(user, "evt", DEFAULT_PRINT_OPTIONS, d)).toEqual({ ok: false });
    expect(d.loadPublication).not.toHaveBeenCalled();
  });

  it("prueba interna de ADMIN: un PDF de 3 páginas con nombre de archivo seguro", async () => {
    const result = await getPrintFile(user, "evt", { ...DEFAULT_PRINT_OPTIONS, format: "a5", cropMarks: true }, deps({ isAdmin: async () => true }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toBe("invitacion-andrea-y-fernando-a5-marcas.pdf");
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBe(3);
  });

  it("el QR apunta a la URL pública GENERAL; con el acceso vencido no se imprime QR", async () => {
    const admin = deps({ isAdmin: async () => true });
    const withQr = await getPrintFile(user, "evt", DEFAULT_PRINT_OPTIONS, admin);
    const expired = await getPrintFile(user, "evt", DEFAULT_PRINT_OPTIONS, deps({ isAdmin: async () => true, loadPublication: async () => ({ ...published, expired: true }) }));
    expect(withQr.ok && expired.ok).toBe(true);
    if (!withQr.ok || !expired.ok) return;
    // El texto del enlace se imprime junto al QR (incrustado en el PDF como glifos); el reverso sin QR es más ligero.
    expect(expired.bytes.length).toBeLessThan(withQr.bytes.length);
  });
});

describe("producto en la página", () => {
  it("muestra $199 MXN, lo que incluye y el botón apagado «Muy pronto»", () => {
    const html = renderToStaticMarkup(<PrintProductCard price={199} currency="MXN" eligible={false} purchasable={false} />);
    expect(html).toContain("$199");
    expect(html).toContain("MXN");
    expect(html).toContain("Muy pronto");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain("Disponible para eventos Esencial y Premium.");
    expect(html).toContain("deja de funcionar 30 días después del evento");
  });
});

describe("arquitectura y seguridad de la versión impresa", () => {
  const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

  it("las rutas viven bajo /dashboard (protegidas por proxy) y comprueban propiedad en el servidor", () => {
    for (const file of ["app/(site)/dashboard/(workspace)/events/[id]/print/preview/route.ts", "app/(site)/dashboard/(workspace)/events/[id]/print/file/route.ts"]) {
      const source = read(file);
      expect(source).toContain("resolveOwnedEvent(id)");
      expect(source).toContain('"private, no-store"');
    }
    expect(read("app/(site)/dashboard/(workspace)/events/[id]/print/page.tsx")).toContain("loadDashboardPage(id, routes.eventPrint)");
  });

  it("nada de la versión impresa cobra todavía: ni Stripe ni checkout", () => {
    for (const file of ["server/services/print-service.ts", "lib/billing/addons.ts", "components/print/print-product-card.tsx", "components/print/print-studio.tsx"]) {
      // Sin comentarios: el código, no la documentación, es lo que no puede tocar el cobro.
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/stripe|checkout|createEventCheckout/i);
    }
  });

  it("las fuentes del PDF son archivos del servidor (no se sirven) con su licencia OFL, registrados en ASSET_LICENSES y empaquetados para Vercel", () => {
    for (const file of ["PinyonScript-Regular.ttf", "CormorantGaramond-Regular.ttf", "CormorantGaramond-Medium.ttf", "CormorantGaramond-Italic.ttf", "CormorantGaramond-LightItalic.ttf", "PinyonScript-OFL.txt", "CormorantGaramond-OFL.txt"]) {
      expect(existsSync(join(ROOT, "assets/print/fonts", file)), file).toBe(true);
    }
    expect(existsSync(join(ROOT, "public/fonts/PinyonScript-Regular.ttf"))).toBe(false);
    const licenses = read("docs/ASSET_LICENSES.md");
    expect(licenses).toContain("Pinyon Script");
    expect(licenses).toContain("assets/print/fonts");
    expect(read("next.config.ts")).toContain("./assets/print/fonts/**");
  });
});
