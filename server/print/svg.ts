import { printCopy } from "@/lib/print/copy";
import type { SceneItem, ScenePage } from "@/lib/print/scene";
import type { PrintFontSet } from "@/server/print/fonts";

/**
 * PINTOR SVG (D-47): la misma escena que el PDF, dibujada para la VISTA PREVIA. Las letras son los contornos reales de los glifos
 * (misma maquetación que el PDF), así que la vista previa no depende de fuentes del navegador y coincide con el archivo. Muestra el
 * papel final (el corte), sin sangrado. Con `watermark`, una marca de agua de contornos repetida en diagonal.
 */
export interface PrintSvgOptions {
  watermark: boolean;
  /** Píxeles por punto del SVG resultante (sus `width`/`height`). */
  pixelsPerPoint: number;
}

const n = (value: number) => +value.toFixed(2);
const attr = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

class GlyphDefs {
  private readonly ids = new Map<string, string>();
  readonly defs: string[] = [];
  id(key: string, path: () => string): string | undefined {
    const known = this.ids.get(key);
    if (known !== undefined) return known || undefined;
    const d = path();
    const id = d ? `g${this.ids.size}` : "";
    this.ids.set(key, id);
    if (d) this.defs.push(`<path id="${id}" d="${d}"/>`);
    return id || undefined;
  }
}

/** Glifos de un texto colocados desde (x, línea base); coordenadas del SVG (y hacia abajo). */
function glyphRun(fontSet: PrintFontSet, defs: GlyphDefs, font: Parameters<PrintFontSet["glyphs"]>[0], text: string, size: number, x: number, baseline: number, tracking = 0): string {
  const scale = size / fontSet.fonts[font].unitsPerEm;
  let cursor = x;
  let out = "";
  for (const glyph of fontSet.glyphs(font, text)) {
    const id = defs.id(`${font}:${glyph.id}`, () => glyph.path.toSVG());
    if (id) out += `<use href="#${id}" transform="translate(${n(cursor)} ${n(baseline)}) scale(${+scale.toFixed(5)} ${-(+scale.toFixed(5))})"/>`;
    cursor += glyph.advanceWidth * scale + tracking;
  }
  return out;
}

function item(fontSet: PrintFontSet, defs: GlyphDefs, page: ScenePage, node: SceneItem): string {
  const H = page.height;
  switch (node.kind) {
    case "text": {
      const scale = node.size / fontSet.fonts[node.font].unitsPerEm;
      const stroke = node.stroke ? ` stroke="${node.color}" stroke-width="${+(node.stroke / scale).toFixed(3)}" stroke-linejoin="round"` : "";
      return `<g fill="${node.color}"${stroke}>${glyphRun(fontSet, defs, node.font, node.text, node.size, node.x, H - node.y, node.tracking ?? 0)}</g>`;
    }
    case "line":
      return `<line x1="${n(node.x1)}" y1="${n(H - node.y1)}" x2="${n(node.x2)}" y2="${n(H - node.y2)}" stroke="${node.color}" stroke-width="${node.width}" stroke-linecap="round"/>`;
    case "path":
      return `<path transform="translate(0 ${n(H)})" d="${attr(node.d)}" fill="${node.fill ?? "none"}"${node.stroke ? ` stroke="${node.stroke.color}" stroke-width="${node.stroke.width}" stroke-linecap="round" stroke-linejoin="round"` : ""}/>`;
    case "circle":
      return `<circle cx="${n(node.cx)}" cy="${n(H - node.cy)}" r="${n(node.r)}" fill="${node.fill}"${node.stroke ? ` stroke="${node.stroke.color}" stroke-width="${node.stroke.width}"` : ""}/>`;
    case "qr": {
      const count = node.rows.length, m = node.size / count, top = H - (node.y + node.size);
      let d = "";
      node.rows.forEach((row, r) => {
        let c = 0;
        while (c < count) {
          if (row[c] !== true) {
            c += 1;
            continue;
          }
          let end = c;
          while (end < count && row[end] === true) end += 1;
          d += `M${n(node.x + c * m)} ${n(top + r * m)}h${n((end - c) * m)}v${n(m)}h${n(-(end - c) * m)}z`;
          c = end;
        }
      });
      return `<path d="${d}" fill="${node.color}" shape-rendering="crispEdges"/>`;
    }
  }
}

/** Marca de agua: «VISTA PREVIA · HILO LUNA» en contornos, repetida en diagonal y muy tenue (no tapa el diseño, sí lo invalida). */
function watermark(fontSet: PrintFontSet, defs: GlyphDefs, page: ScenePage): string {
  const size = Math.max(9, page.height / 22);
  const text = printCopy.page.watermark;
  const width = fontSet.metrics.widthOf("caps", text, size) + 2 * (text.length - 1);
  const rows: string[] = [];
  const diagonal = Math.hypot(page.width, page.height);
  for (let y = -diagonal / 2, row = 0; y < diagonal; y += size * 4.2, row++) {
    for (let x = -diagonal / 2 + (row % 2) * (width / 2); x < diagonal; x += width + size * 3) rows.push(glyphRun(fontSet, defs, "caps", text, size, x, y, 2));
  }
  return `<g fill="#6b5a3c" fill-opacity="0.16" transform="rotate(-24 ${n(page.width / 2)} ${n(page.height / 2)})">${rows.join("")}</g>`;
}

export function renderPrintSvg(page: ScenePage, fontSet: PrintFontSet, options: PrintSvgOptions): string {
  const defs = new GlyphDefs();
  const body = page.items.map((node) => item(fontSet, defs, page, node)).join("");
  const mark = options.watermark ? watermark(fontSet, defs, page) : "";
  const background = page.background ? `<rect width="${n(page.width)}" height="${n(page.height)}" fill="${page.background}"/>` : "";
  const width = Math.round(page.width * options.pixelsPerPoint), height = Math.round(page.height * options.pixelsPerPoint);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${n(page.width)} ${n(page.height)}"><defs>${defs.defs.join("")}</defs>${background}${body}${mark}</svg>`;
}
