import { LineCapStyle, LineJoinStyle, PDFDocument, rgb, setCharacterSpacing, setLineJoin, setLineWidth, setStrokingColor, setTextRenderingMode, TextRenderingMode, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { BLEED_PT, SLUG_PT } from "@/lib/print/formats";
import { siteConfig } from "@/lib/site-config";
import type { PrintFontKey, PrintScene, SceneItem, ScenePage } from "@/lib/print/scene";
import { PRINT_FONT_FEATURES, type PrintFontSet } from "@/server/print/fonts";
import { fontkit } from "@/server/print/fontkit";

/**
 * PINTOR PDF (D-47): convierte la escena en el archivo de imprenta. Texto 100 % vectorial con las fuentes incrustadas como subconjunto,
 * QR vectorial, TrimBox (corte) y BleedBox (sangrado de 3 mm) en cada página; opcionalmente marcas de corte y un rótulo FUERA del
 * sangrado. Sin imágenes, sombras, texturas ni simulaciones de relieve. Color RGB (la imprenta convierte a CMYK).
 */
export interface PrintPdfOptions {
  cropMarks: boolean;
  title: string;
  /** Rótulo de la versión con marcas (fuera del sangrado): p. ej. «ANDREA & FERNANDO · 5×7"». */
  label: string;
}

const hex = (value: string): RGB => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);

const PAGE_LABEL: Readonly<Record<ScenePage["kind"], string>> = { front: "FRENTE", back: "REVERSO", envelope: "MONOGRAMA PARA SOBRE" };

function drawItem(page: PDFPage, item: SceneItem, off: number, fonts: Readonly<Record<PrintFontKey, PDFFont>>) {
  switch (item.kind) {
    case "text": {
      const color = hex(item.color);
      if (item.tracking) page.pushOperators(setCharacterSpacing(item.tracking));
      // Refuerzo de trazo fino: relleno + contorno del mismo color (modo de texto 2).
      if (item.stroke) page.pushOperators(setTextRenderingMode(TextRenderingMode.FillAndOutline), setLineWidth(item.stroke), setLineJoin(LineJoinStyle.Round), setStrokingColor(color));
      page.drawText(item.text, { x: off + item.x, y: off + item.y, size: item.size, font: fonts[item.font], color });
      if (item.stroke) page.pushOperators(setTextRenderingMode(TextRenderingMode.Fill), setLineWidth(1), setLineJoin(LineJoinStyle.Miter));
      if (item.tracking) page.pushOperators(setCharacterSpacing(0));
      return;
    }
    case "line":
      page.drawLine({ start: { x: off + item.x1, y: off + item.y1 }, end: { x: off + item.x2, y: off + item.y2 }, thickness: item.width, color: hex(item.color), lineCap: LineCapStyle.Round });
      return;
    case "path":
      page.drawSvgPath(item.d, {
        x: off,
        y: off,
        ...(item.fill ? { color: hex(item.fill) } : {}),
        ...(item.stroke ? { borderColor: hex(item.stroke.color), borderWidth: item.stroke.width, borderLineCap: LineCapStyle.Round } : {}),
      });
      return;
    case "circle":
      page.drawCircle({ x: off + item.cx, y: off + item.cy, size: item.r, color: hex(item.fill), ...(item.stroke ? { borderColor: hex(item.stroke.color), borderWidth: item.stroke.width } : {}) });
      return;
    case "qr": {
      const n = item.rows.length, m = item.size / n, color = hex(item.color);
      item.rows.forEach((row, r) => {
        let run = -1;
        for (let col = 0; col <= n; col++) {
          const dark = col < n && row[col] === true;
          if (dark && run < 0) run = col;
          if (!dark && run >= 0) {
            // +0,02 pt: sin rendijas blancas entre módulos vecinos al rasterizar.
            page.drawRectangle({ x: off + item.x + run * m, y: off + item.y + (n - 1 - r) * m, width: (col - run) * m + 0.02, height: m + 0.02, color });
            run = -1;
          }
        }
      });
      return;
    }
  }
}

function cropMarks(page: PDFPage, off: number, width: number, height: number) {
  const length = 12, gap = BLEED_PT + 2, black = rgb(0, 0, 0);
  for (const x of [off, off + width])
    for (const y of [off, off + height]) {
      const sx = x === off ? -1 : 1, sy = y === off ? -1 : 1;
      page.drawLine({ start: { x: x + sx * gap, y }, end: { x: x + sx * (gap + length), y }, thickness: 0.25, color: black });
      page.drawLine({ start: { x, y: y + sy * gap }, end: { x, y: y + sy * (gap + length) }, thickness: 0.25, color: black });
    }
}

export async function renderPrintPdf(scene: PrintScene, fontSet: PrintFontSet, options: PrintPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(options.title);
  doc.setAuthor(siteConfig.name);
  doc.setCreator(`${siteConfig.name} — archivo listo para imprimir`);
  doc.setProducer(siteConfig.name);

  // Solo se incrustan las fuentes que la escena usa, como subconjunto y con las mismas características OpenType que la composición.
  const used = new Set<PrintFontKey>(scene.pages.flatMap((page) => page.items.flatMap((item) => (item.kind === "text" ? [item.font] : []))));
  if (options.cropMarks) used.add("caps"); // el rótulo de la zona de marcas
  const fonts = {} as Record<PrintFontKey, PDFFont>;
  for (const key of used) {
    const features = PRINT_FONT_FEATURES[key];
    fonts[key] = await doc.embedFont(fontSet.bytes[key], { subset: true, ...(features ? { features } : {}) });
  }

  const off = BLEED_PT + (options.cropMarks ? SLUG_PT : 0);
  for (const scenePage of scene.pages) {
    const page = doc.addPage([scenePage.width + 2 * off, scenePage.height + 2 * off]);
    page.setTrimBox(off, off, scenePage.width, scenePage.height);
    page.setBleedBox(off - BLEED_PT, off - BLEED_PT, scenePage.width + 2 * BLEED_PT, scenePage.height + 2 * BLEED_PT);
    if (scenePage.background) page.drawRectangle({ x: off - BLEED_PT, y: off - BLEED_PT, width: scenePage.width + 2 * BLEED_PT, height: scenePage.height + 2 * BLEED_PT, color: hex(scenePage.background) });
    for (const item of scenePage.items) drawItem(page, item, off, fonts);
    if (options.cropMarks) {
      cropMarks(page, off, scenePage.width, scenePage.height);
      const label = fontSet.metrics.clean("caps", `${siteConfig.name.toLocaleUpperCase("es-MX")} · ${options.label} · ${PAGE_LABEL[scenePage.kind]} · SANGRADO 3 MM`);
      page.drawText(label, { x: off, y: 6, size: 5.5, font: fonts.caps, color: rgb(0.35, 0.35, 0.35) });
    }
  }
  return doc.save();
}
