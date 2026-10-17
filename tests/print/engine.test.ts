import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { buildPrintData } from "@/lib/print/data";
import { BLEED_PT, ENVELOPE_ART_PT, PRINT_FORMAT_SPECS, PT_PER_MM, SAFE_PT } from "@/lib/print/formats";
import { layoutRomanticElegant } from "@/lib/print/layout";
import { PRINT_COLORS, type PrintScene, type SceneQr, type SceneText } from "@/lib/print/scene";
import { createQrMatrix } from "@/lib/share/qr";
import { loadPrintFonts, type PrintFontSet } from "@/server/print/fonts";
import { renderPrintPdf } from "@/server/print/pdf";
import { renderPrintSvg } from "@/server/print/svg";
import { DEMO_URL, demo, longWedding, minimalWedding } from "./fixtures";

let fonts: PrintFontSet;
beforeAll(async () => {
  fonts = await loadPrintFonts();
});

const scene = (invitation = demo, format: "5x7" | "a5" = "5x7", includeBack = true, publicUrl: string | null = DEMO_URL): PrintScene =>
  layoutRomanticElegant(buildPrintData(invitation, publicUrl ? { publicUrl } : {}), { format, includeBack }, fonts.metrics);
const texts = (s: PrintScene, kind: "front" | "back") => (s.pages.find((page) => page.kind === kind)?.items ?? []).filter((item): item is SceneText => item.kind === "text");
const width = (t: SceneText) => fonts.metrics.widthOf(t.font, t.text, t.size) + (t.tracking ?? 0) * Math.max(0, [...t.text].length - 1);

describe("composición «Romántica elegante» (diseño aprobado)", () => {
  it("con la boda de demostración reproduce el arte aprobado (posiciones y cuerpos)", () => {
    const front = texts(scene(), "front");
    const at = (text: string) => front.find((t) => t.text === text);
    expect(at("Junto a sus familias")).toMatchObject({ font: "script", size: 17, y: 272 });
    expect(at("LUNES 17 DE MAYO DE 2027")).toMatchObject({ font: "caps", size: 10.5, tracking: 1.5 });
    expect(at("A LAS CINCO DE LA TARDE")).toMatchObject({ font: "caps", size: 8.5 });
    expect(at("Tu presencia hará este día todavía más especial")).toMatchObject({ font: "script", size: 16, stroke: 0.16, color: PRINT_COLORS.gold, y: 50 });
    const names = front.filter((t) => t.role === "nombres");
    expect(names.map((t) => t.text)).toEqual(["Andrea", "&", "Fernando"]);
    expect(names[0]?.size).toBeGreaterThan(44);
    expect(names[0]?.size).toBeLessThanOrEqual(52);
  });

  it("ningún texto sale de la zona segura de 5 mm, ni con datos largos ni en A5", () => {
    for (const [invitation, format] of [[demo, "5x7"], [demo, "a5"], [longWedding, "5x7"], [longWedding, "a5"], [minimalWedding, "5x7"]] as const) {
      const s = scene(invitation, format);
      const spec = PRINT_FORMAT_SPECS[format];
      for (const kind of ["front", "back"] as const)
        for (const t of texts(s, kind)) {
          expect(t.x, `${t.text} (${format})`).toBeGreaterThanOrEqual(SAFE_PT - 0.01);
          expect(t.x + width(t), `${t.text} (${format})`).toBeLessThanOrEqual(spec.width - SAFE_PT + 0.01);
          expect(t.y).toBeGreaterThan(SAFE_PT);
          expect(t.y).toBeLessThan(spec.height - SAFE_PT);
        }
    }
  });

  it("información importante ≥ 8 pt (los nombres y la caligrafía aparte)", () => {
    for (const kind of ["front", "back"] as const) for (const t of texts(scene(longWedding), kind)) expect(t.size, t.text).toBeGreaterThanOrEqual(7.5);
    for (const kind of ["front", "back"] as const) for (const t of texts(scene(), kind)) expect(t.size, t.text).toBeGreaterThanOrEqual(8);
  });

  it("nombres largos pasan a dos líneas («Nombre» / «& Nombre»)", () => {
    const names = texts(scene(longWedding), "front").filter((t) => t.role === "nombres");
    expect(names.map((t) => t.text)).toEqual(["María Fernanda", "&", "Juan Sebastián"]);
    expect(names[0]!.y).toBeGreaterThan(names[2]!.y);
  });

  it("A5 es la misma composición escalada (×148/127)", () => {
    const k = PRINT_FORMAT_SPECS.a5.height / PRINT_FORMAT_SPECS["5x7"].height;
    const small = texts(scene(demo, "5x7"), "front"), large = texts(scene(demo, "a5"), "front");
    expect(large.map((t) => t.text)).toEqual(small.map((t) => t.text));
    large.forEach((t, i) => {
      expect(t.size).toBeCloseTo(small[i]!.size * k, 5);
      expect(t.y).toBeCloseTo(small[i]!.y * k, 5);
    });
  });

  it("QR: ≥ 1\" y módulo ≥ 0,75 mm, en tinta casi negra, y solo con URL pública", () => {
    const qr = scene().pages.find((p) => p.kind === "back")?.items.find((item): item is SceneQr => item.kind === "qr");
    expect(qr).toBeDefined();
    expect(qr!.size).toBeGreaterThanOrEqual(72 - 0.01);
    expect(qr!.size / qr!.rows.length / PT_PER_MM).toBeGreaterThanOrEqual(0.75);
    expect(qr!.color).toBe(PRINT_COLORS.qr);
    expect(qr!.rows).toEqual(createQrMatrix(DEMO_URL).rows);
    expect(scene(demo, "5x7", true, null).pages.find((p) => p.kind === "back")?.items.some((item) => item.kind === "qr")).toBe(false);
  });

  it("reverso opcional; el arte del sobre es una página de 3×3\" sin fondo", () => {
    expect(scene(demo, "5x7", false).pages.map((p) => p.kind)).toEqual(["front", "envelope"]);
    const envelope = scene().pages.find((p) => p.kind === "envelope")!;
    expect([envelope.width, envelope.height]).toEqual([ENVELOPE_ART_PT, ENVELOPE_ART_PT]);
    expect(envelope.background).toBeUndefined();
    expect(envelope.items.filter((item) => item.kind === "text").map((item) => (item as SceneText).text)).toEqual(["A", "F"]);
  });

  it("quita los caracteres que la fuente no tiene (un emoji nunca imprime una caja vacía)", () => {
    const names = texts(scene({ ...demo, names: ["Andrea 💍", "Fernando"] }), "front").filter((t) => t.role === "nombres");
    expect(names[0]?.text.trim()).toBe("Andrea");
  });
});

/** Fuentes del PDF: nombre, si están incrustadas y cuántas imágenes hay. */
function inspect(doc: PDFDocument) {
  const fontNames: string[] = [];
  let embedded = 0, images = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : undefined;
    if (!dict) continue;
    if (dict.get(PDFName.of("Type"))?.toString() === "/FontDescriptor") {
      fontNames.push(dict.get(PDFName.of("FontName"))?.toString() ?? "");
      if (dict.get(PDFName.of("FontFile2"))) embedded++;
    }
    if (dict.get(PDFName.of("Subtype"))?.toString() === "/Image") images++;
  }
  return { fontNames, embedded, images };
}

describe("PDF de imprenta", () => {
  it("5×7\": corte exacto, sangrado de 3 mm, fuentes incrustadas, sin imágenes", async () => {
    const bytes = await renderPrintPdf(scene(), fonts, { cropMarks: false, title: "Prueba", label: "ANDREA & FERNANDO" });
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    const [front, back, envelope] = doc.getPages();
    for (const page of [front!, back!]) {
      const trim = page.getTrimBox(), bleed = page.getBleedBox();
      expect(trim.width).toBeCloseTo(504, 3);
      expect(trim.height).toBeCloseTo(360, 3);
      expect(trim.x - bleed.x).toBeCloseTo(BLEED_PT, 3);
      expect(bleed.width).toBeCloseTo(504 + 2 * BLEED_PT, 3);
    }
    expect(envelope!.getTrimBox().width).toBeCloseTo(216, 3);
    const { fontNames, embedded, images } = inspect(doc);
    expect(embedded).toBe(fontNames.length);
    expect(fontNames.some((name) => name.includes("PinyonScript"))).toBe(true);
    expect(fontNames.some((name) => name.includes("CormorantGaramond"))).toBe(true);
    expect(images).toBe(0);
    expect(doc.getTitle()).toBe("Prueba");
  });

  it("A5 mide 210 × 148 mm; con marcas de corte la página crece y el corte no cambia", async () => {
    const plain = await PDFDocument.load(await renderPrintPdf(scene(demo, "a5"), fonts, { cropMarks: false, title: "A5", label: "A5" }));
    const marks = await PDFDocument.load(await renderPrintPdf(scene(demo, "a5"), fonts, { cropMarks: true, title: "A5", label: "A5" }));
    const trim = plain.getPage(0).getTrimBox();
    expect(trim.width / PT_PER_MM).toBeCloseTo(210, 2);
    expect(trim.height / PT_PER_MM).toBeCloseTo(148, 2);
    expect(marks.getPage(0).getTrimBox().width).toBeCloseTo(trim.width, 3);
    expect(marks.getPage(0).getMediaBox().width).toBeGreaterThan(plain.getPage(0).getMediaBox().width);
  });
});

describe("vista previa (mismo arte, en contornos)", () => {
  it("no usa fuentes del navegador ni texto seleccionable; la marca de agua solo cuando se pide", () => {
    const front = scene().pages[0]!;
    const plain = renderPrintSvg(front, fonts, { watermark: false, pixelsPerPoint: 2 });
    const marked = renderPrintSvg(front, fonts, { watermark: true, pixelsPerPoint: 2 });
    expect(plain.startsWith("<svg")).toBe(true);
    expect(plain).not.toMatch(/<text|font-family|<script|href="http/);
    expect(plain).toContain('width="1008"');
    expect(marked.length).toBeGreaterThan(plain.length);
    expect(marked).toContain('fill-opacity="0.16"');
    expect(plain).not.toContain('fill-opacity="0.16"');
  });
});
