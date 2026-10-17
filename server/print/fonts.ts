import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Font, Glyph, TypeFeatures } from "@pdf-lib/fontkit";
import type { PrintFontKey, PrintFontMetrics } from "@/lib/print/scene";
import { fontkit } from "@/server/print/fontkit";

/**
 * FUENTES DE LA VERSIÓN IMPRESA (D-47): TTF estáticos con licencia SIL OFL 1.1 (`assets/print/fonts`, registrados en
 * docs/ASSET_LICENSES.md §3), leídos del disco del servidor —nunca se sirven al navegador— e incrustados como subconjunto en cada PDF.
 * `next.config.ts` (`outputFileTracingIncludes`) los incluye en el paquete de las rutas que imprimen.
 *
 * La composición (`lib/print/layout.ts`) y los dos pintores usan EXACTAMENTE la misma maquetación de fontkit (mismos glifos, mismos
 * avances, sin kerning: es lo que hace pdf-lib al incrustar), así que la vista previa coincide con el PDF.
 */
export const PRINT_FONT_FILES: Readonly<Record<PrintFontKey, string>> = {
  script: "PinyonScript-Regular.ttf",
  caps: "CormorantGaramond-Medium.ttf",
  serif: "CormorantGaramond-Regular.ttf",
  italic: "CormorantGaramond-Italic.ttf",
  lightItalic: "CormorantGaramond-LightItalic.ttf",
};

/** Cifras de caja alta proporcionales en Cormorant («17 DE MAYO DE 2027» no parece escrito en minúsculas). */
const LINING: TypeFeatures = { lnum: true, pnum: true };
export const PRINT_FONT_FEATURES: Readonly<Record<PrintFontKey, TypeFeatures | undefined>> = { script: undefined, caps: LINING, serif: LINING, italic: LINING, lightItalic: LINING };

const KEYS = Object.keys(PRINT_FONT_FILES) as PrintFontKey[];

export interface PrintFontSet {
  bytes: Readonly<Record<PrintFontKey, Uint8Array>>;
  fonts: Readonly<Record<PrintFontKey, Font>>;
  metrics: PrintFontMetrics;
  /** Glifos de un texto ya maquetado (con las mismas características OpenType que el PDF). */
  glyphs(font: PrintFontKey, text: string): Glyph[];
}

/** Quita los caracteres que la fuente no tiene (se verían como una caja vacía): emojis, símbolos raros. */
function cleanFor(font: Font, text: string): string {
  return [...text].filter((char) => /\s/.test(char) || font.glyphForCodePoint(char.codePointAt(0) ?? 0).id !== 0).join("");
}

export function createPrintFontSet(bytes: Readonly<Record<PrintFontKey, Uint8Array>>): PrintFontSet {
  const fonts = Object.fromEntries(KEYS.map((key) => [key, fontkit.create(bytes[key])])) as Record<PrintFontKey, Font>;
  const glyphs = (key: PrintFontKey, text: string): Glyph[] => fonts[key].layout(cleanFor(fonts[key], text), PRINT_FONT_FEATURES[key]).glyphs;
  const metrics: PrintFontMetrics = {
    clean: (key, text) => cleanFor(fonts[key], text),
    widthOf: (key, text, size) => (glyphs(key, text).reduce((sum, glyph) => sum + glyph.advanceWidth, 0) * size) / fonts[key].unitsPerEm,
    glyphBox: (key, char, size) => {
      const font = fonts[key];
      const box = font.glyphForCodePoint(char.codePointAt(0) ?? 0).bbox;
      const scale = size / font.unitsPerEm;
      return { minX: box.minX * scale, maxX: box.maxX * scale, minY: box.minY * scale, maxY: box.maxY * scale };
    },
  };
  return { bytes, fonts, metrics, glyphs };
}

let cached: Promise<PrintFontSet> | undefined;

/**
 * Carga (una vez por proceso) las cinco fuentes del diseño. La ruta va ESCRITA ENTERA en la llamada (`process.cwd()` + carpeta fija): con
 * una ruta variable, el rastreo de archivos del build incluiría todo el proyecto en el paquete del servidor.
 */
export function loadPrintFonts(): Promise<PrintFontSet> {
  const load = async () => {
    const entries = await Promise.all(KEYS.map(async (key) => [key, new Uint8Array(await readFile(join(process.cwd(), "assets", "print", "fonts", PRINT_FONT_FILES[key])))] as const));
    return createPrintFontSet(Object.fromEntries(entries) as Record<PrintFontKey, Uint8Array>);
  };
  cached ??= load().catch((error: unknown) => {
    cached = undefined; // un fallo de lectura no se queda en caché
    throw error;
  });
  return cached;
}
