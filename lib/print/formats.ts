/**
 * FORMATOS DE IMPRESIÓN (D-47). Todas las medidas en puntos PDF (72 por pulgada). La tarjeta es HORIZONTAL; el arte del sobre es
 * una página aparte de 3×3", con fondo transparente, para imprimirse sobre la solapa.
 */
export const PT_PER_MM = 72 / 25.4;

/** Sangrado: el fondo se extiende 3 mm más allá del corte por cada lado. */
export const BLEED_PT = 3 * PT_PER_MM;
/** Zona segura: ningún texto a menos de 5 mm del corte. */
export const SAFE_PT = 5 * PT_PER_MM;
/** Margen exterior de la versión con marcas de corte (las marcas y el rótulo viven fuera del sangrado). */
export const SLUG_PT = 22;

export const PRINT_FORMATS = ["5x7", "a5"] as const;
export type PrintFormat = (typeof PRINT_FORMATS)[number];

export interface PrintFormatSpec {
  id: PrintFormat;
  label: string;
  /** Medida legible del corte final. */
  size: string;
  /** Tarjeta horizontal: ancho × alto del corte, en puntos. */
  width: number;
  height: number;
  /** Sobre recomendado (solo informativo). */
  envelope: string;
}

export const PRINT_FORMAT_SPECS: Readonly<Record<PrintFormat, PrintFormatSpec>> = {
  "5x7": { id: "5x7", label: "5×7\"", size: "17.8 × 12.7 cm", width: 7 * 72, height: 5 * 72, envelope: "Sobre A7 (18.4 × 13.3 cm)" },
  a5: { id: "a5", label: "A5", size: "21 × 14.8 cm", width: 210 * PT_PER_MM, height: 148 * PT_PER_MM, envelope: "Sobre C5 (22.9 × 16.2 cm)" },
};

/** Página del arte del sobre: 3×3" (7.62 cm). */
export const ENVELOPE_ART_PT = 3 * 72;

export const DEFAULT_PRINT_FORMAT: PrintFormat = "5x7";

export const isPrintFormat = (value: unknown): value is PrintFormat => typeof value === "string" && (PRINT_FORMATS as readonly string[]).includes(value);
