/**
 * ESCENA DE IMPRESIÓN (D-47): el diseño se calcula UNA vez como una lista de elementos en puntos, y dos pintores la dibujan: PDF
 * (`server/print/pdf.ts`, el archivo final) y SVG (`server/print/svg.ts`, la vista previa). Por eso la vista previa es el mismo arte que
 * el archivo, no una captura de la invitación web.
 *
 * Coordenadas: origen en la esquina INFERIOR izquierda del corte, y hacia arriba (como en PDF). El sangrado queda fuera del rango
 * [0, ancho] × [0, alto].
 */
export type PrintFontKey = "script" | "caps" | "serif" | "italic" | "lightItalic";

/** Colores aprobados del diseño «Romántica elegante» (iteración 3). */
export const PRINT_COLORS = {
  paper: "#FBF8F1",
  ink: "#3B352F",
  muted: "#5F564C",
  gold: "#8E7244",
  line: "#A68C5E",
  qr: "#24201C",
} as const;

export interface SceneText {
  kind: "text";
  text: string;
  font: PrintFontKey;
  size: number;
  /** Inicio de la línea base. */
  x: number;
  y: number;
  color: string;
  /** Espaciado entre letras, en puntos (se suma tras cada glifo). */
  tracking?: number;
  /** Refuerzo de trazo fino: contorno del mismo color, en puntos (engrosa la letra, no la cambia). */
  stroke?: number;
  /** Papel tipográfico (para las pruebas de legibilidad). */
  role: string;
}

export interface SceneLine {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
}

/**
 * Trazado vectorial. `d` es un trazado SVG en coordenadas del corte con la `y` NEGADA (y hacia abajo): así el pintor PDF lo pasa tal
 * cual a `drawSvgPath` (que invierte la `y`) y el SVG solo lo traslada. Los dos producen exactamente la misma forma.
 */
export interface ScenePath {
  kind: "path";
  d: string;
  fill?: string;
  stroke?: { color: string; width: number };
}

export interface SceneCircle {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: { color: string; width: number };
}

/** Código QR: `rows[fila][columna]`, fila 0 arriba; `x`, `y` = esquina inferior izquierda; `size` = lado. */
export interface SceneQr {
  kind: "qr";
  rows: readonly (readonly boolean[])[];
  x: number;
  y: number;
  size: number;
  color: string;
}

export type SceneItem = SceneText | SceneLine | ScenePath | SceneCircle | SceneQr;

export type ScenePageKind = "front" | "back" | "envelope";

export interface ScenePage {
  kind: ScenePageKind;
  /** Medidas del corte, en puntos. */
  width: number;
  height: number;
  /** Fondo impreso hasta el sangrado; sin él la página es transparente (arte del sobre). */
  background?: string;
  items: readonly SceneItem[];
}

export interface PrintScene {
  pages: readonly ScenePage[];
  /** Avisos de composición para mostrar antes de comprar (claves de `printCopy.page.warnings`). */
  warnings: readonly PrintWarning[];
}

export type PrintWarning = "textFitted" | "spacingCompressed" | "columnsTight";

/** Métricas de fuente que necesita la composición (las da `server/print/fonts.ts` con los TTF reales). */
export interface PrintFontMetrics {
  /** El texto sin los caracteres que la fuente no tiene (emojis y símbolos se verían como cajas vacías). */
  clean(font: PrintFontKey, text: string): string;
  /** Ancho del texto sin espaciado extra, igual que lo mide el PDF (suma de avances, sin kerning). */
  widthOf(font: PrintFontKey, text: string, size: number): number;
  /** Caja real del glifo de un carácter (para centrar las iniciales ópticamente). */
  glyphBox(font: PrintFontKey, char: string, size: number): { minX: number; maxX: number; minY: number; maxY: number };
}
