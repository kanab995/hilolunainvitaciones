import { printCopy } from "@/lib/print/copy";
import type { PrintData } from "@/lib/print/data";
import { ENVELOPE_ART_PT, PRINT_FORMAT_SPECS, PT_PER_MM, SAFE_PT, type PrintFormat } from "@/lib/print/formats";
import { PRINT_COLORS as C, type PrintFontKey, type PrintFontMetrics, type PrintScene, type PrintWarning, type SceneItem, type ScenePage } from "@/lib/print/scene";
import { createQrMatrix } from "@/lib/share/qr";

/**
 * COMPOSICIÓN «ROMÁNTICA ELEGANTE» (D-47) — el diseño aprobado por el propietario (iteración 3, variante B) convertido en reglas:
 * doble filete abierto por el monograma de luna, nombres en Pinyon Script, textos en Cormorant Garamond, rama fina con la estrella de la
 * marca; reverso con ceremonia · recepción · vestimenta y QR opcional (hacia la invitación, la mesa de regalos o la tienda, D-49); arte del
 * sobre con el monograma.
 *
 * Todo se compone en un espacio VIRTUAL de 360 pt de alto (la tarjeta 5×7" aprobada) y se escala al formato real (A5 = ×1,165): la
 * composición, las proporciones y los márgenes relativos son idénticos en los dos formatos.
 */
export interface PrintLayoutOptions {
  format: PrintFormat;
  includeBack: boolean;
}

const BASE_H = 360;
const card = printCopy.card;

interface Style {
  font: PrintFontKey;
  size: number;
  color: string;
  tracking?: number;
  stroke?: number;
  role: string;
}

// Papeles tipográficos aprobados (iteración 3). Información importante ≥ 9 pt; versalitas ≥ 8 pt con espaciado 0,12–0,16 em.
const T = {
  kicker: { font: "script", size: 17, color: C.muted, role: "rótulo" },
  invite: { font: "italic", size: 12, color: C.muted, role: "invitación" },
  date: { font: "caps", size: 10.5, color: C.ink, tracking: 1.5, role: "fecha" },
  time: { font: "caps", size: 8.5, color: C.muted, tracking: 1.2, role: "hora" },
  venue: { font: "italic", size: 15.5, color: C.ink, role: "sede" },
  city: { font: "caps", size: 8, color: C.muted, tracking: 1.1, role: "ciudad" },
  closing: { font: "script", size: 16, color: C.gold, stroke: 0.16, role: "cierre" },
  backTitle: { font: "script", size: 30, color: C.gold, stroke: 0.12, role: "título" },
  label: { font: "caps", size: 8.2, color: C.ink, tracking: 1.3, role: "rótulo" },
  colTime: { font: "serif", size: 10.5, color: C.ink, role: "hora" },
  colVenue: { font: "italic", size: 13.5, color: C.ink, role: "sede" },
  addr: { font: "serif", size: 9.2, color: C.muted, role: "dirección" },
  rsvpTitle: { font: "italic", size: 13.5, color: C.ink, role: "QR" },
  url: { font: "caps", size: 9, color: C.ink, tracking: 0.3, role: "QR" },
} as const satisfies Record<string, Style>;

/** Lienzo de una página: emite elementos en coordenadas virtuales y los escala al formato real. */
class Canvas {
  readonly items: SceneItem[] = [];
  readonly w: number;
  readonly h: number;
  /** Puntos reales por unidad virtual. */
  readonly k: number;
  private readonly metrics: PrintFontMetrics;
  private readonly warnings: Set<PrintWarning>;

  // Sin propiedades de parámetro: el módulo también corre con `node` (que solo elimina tipos) en los scripts.
  constructor(w: number, h: number, k: number, metrics: PrintFontMetrics, warnings: Set<PrintWarning>) {
    this.w = w;
    this.h = h;
    this.k = k;
    this.metrics = metrics;
    this.warnings = warnings;
  }

  get cx() {
    return this.w / 2;
  }
  /** Zona segura en unidades virtuales. */
  get safe() {
    return SAFE_PT / this.k;
  }

  width(text: string, style: Pick<Style, "font" | "size" | "tracking">): number {
    const clean = this.metrics.clean(style.font, text);
    return this.metrics.widthOf(style.font, clean, style.size) + (style.tracking ?? 0) * Math.max(0, [...clean].length - 1);
  }

  text(raw: string, style: Style, x: number, y: number) {
    const { k } = this;
    const text = this.metrics.clean(style.font, raw);
    if (!text.trim()) return;
    this.items.push({ kind: "text", text, font: style.font, size: style.size * k, x: x * k, y: y * k, color: style.color, role: style.role, ...(style.tracking ? { tracking: style.tracking * k } : {}), ...(style.stroke ? { stroke: style.stroke * k } : {}) });
  }

  /**
   * Texto centrado. Si no cabe en `maxWidth` (por defecto, el ancho de la zona segura) el cuerpo se reduce hasta el 75 % y se avisa:
   * un dato muy largo nunca sale de la tarjeta.
   */
  centered(text: string, style: Style, y: number, cx = this.cx, maxWidth = this.w - 2 * this.safe) {
    let fitted = style;
    const natural = this.width(text, style);
    if (natural > maxWidth) {
      const scale = Math.max(0.75, maxWidth / natural);
      fitted = { ...style, size: style.size * scale, ...(style.tracking ? { tracking: style.tracking * scale } : {}) };
      this.warnings.add("textFitted");
    }
    this.text(text, fitted, cx - this.width(text, fitted) / 2, y);
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.4, color: string = C.line) {
    const { k } = this;
    this.items.push({ kind: "line", x1: x1 * k, y1: y1 * k, x2: x2 * k, y2: y2 * k, width: width * k, color });
  }

  /** Trazado con comandos en coordenadas virtuales y hacia arriba; se convierte a `d` con la `y` negada (ver `ScenePath`). */
  path(commands: readonly PathCommand[], paint: { fill?: string; stroke?: { color: string; width: number } }) {
    const { k } = this;
    const n = (value: number) => +(value * k).toFixed(3);
    const d = commands
      .map((cmd) => {
        switch (cmd[0]) {
          case "M":
          case "L":
            return `${cmd[0]} ${n(cmd[1])} ${n(-cmd[2])}`;
          case "Q":
            return `Q ${n(cmd[1])} ${n(-cmd[2])} ${n(cmd[3])} ${n(-cmd[4])}`;
          case "A":
            return `A ${n(cmd[1])} ${n(cmd[1])} 0 ${cmd[2]} ${cmd[3]} ${n(cmd[4])} ${n(-cmd[5])}`;
          case "Z":
            return "Z";
        }
      })
      .join(" ");
    this.items.push({ kind: "path", d, ...(paint.fill ? { fill: paint.fill } : {}), ...(paint.stroke ? { stroke: { color: paint.stroke.color, width: paint.stroke.width * k } } : {}) });
  }

  circle(cx: number, cy: number, r: number, fill: string, stroke?: { color: string; width: number }) {
    const { k } = this;
    this.items.push({ kind: "circle", cx: cx * k, cy: cy * k, r: r * k, fill, ...(stroke ? { stroke: { color: stroke.color, width: stroke.width * k } } : {}) });
  }

  qr(rows: readonly (readonly boolean[])[], x: number, y: number, size: number) {
    const { k } = this;
    this.items.push({ kind: "qr", rows, x: x * k, y: y * k, size: size * k, color: C.qr });
  }

  /** Inicial centrada ÓPTICAMENTE (por la caja real del glifo, no por su avance). */
  glyph(char: string, style: Style, cx: number, cy: number) {
    const box = this.metrics.glyphBox(style.font, char, style.size);
    this.text(char, style, cx - (box.minX + box.maxX) / 2, cy - (box.minY + box.maxY) / 2);
  }
}

type PathCommand = ["M" | "L", number, number] | ["Q", number, number, number, number] | ["A", number, 0 | 1, 0 | 1, number, number] | ["Z"];

/** Reparte un texto en el MENOR número de líneas (hasta 3) que quepan, con líneas lo más parejas posible. */
export function balanceLines(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (measure(text) <= maxWidth || words.length < 2) return [text];
  // El mejor reparto hasta ahora (en un objeto: TypeScript no sigue las asignaciones hechas dentro de `consider`).
  const found: { lines?: string[]; score: number } = { score: Infinity };
  const consider = (lines: string[]) => {
    const score = Math.max(...lines.map(measure));
    if (score <= maxWidth && score < found.score) Object.assign(found, { lines, score });
  };
  for (let i = 1; i < words.length; i++) consider([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
  if (found.lines) return found.lines;
  for (let i = 1; i < words.length - 1; i++) for (let j = i + 1; j < words.length; j++) consider([words.slice(0, i), words.slice(i, j), words.slice(j)].map((part) => part.join(" ")));
  if (found.lines) return found.lines;
  // Ni en tres líneas: corte voraz (el texto se ajustará al dibujarse).
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) > maxWidth && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  return [...out, line];
}

/* ───────── ornamentos (vectoriales, originales de Hilo Luna) ───────── */

/** Estrella de cuatro puntas: el «✦» de Hilo ✦ Luna. */
function sparkle(c: Canvas, x: number, y: number, r: number, color: string = C.gold) {
  const i = r * 0.22;
  c.path([["M", x, y + r], ["L", x + i, y + i], ["L", x + r, y], ["L", x + i, y - i], ["L", x, y - r], ["L", x - i, y - i], ["L", x - r, y], ["L", x - i, y + i], ["Z"]], { fill: color });
}

/** Rama fina con hojas alternas a cada lado de la estrella. */
function sprig(c: Canvas, cx: number, y: number, len = 44, gap = 8) {
  for (const dir of [-1, 1]) {
    const x0 = cx + dir * gap, x1 = cx + dir * (gap + len), ctrlX = cx + dir * (gap + len * 0.5), ctrlY = y - 3.2;
    c.path([["M", x0, y], ["Q", ctrlX, ctrlY, x1, y + 1.4]], { stroke: { color: C.gold, width: 0.45 } });
    ([[0.34, 1], [0.58, -1], [0.8, 1]] as const).forEach(([t, side], index) => {
      const bx = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * ctrlX + t * t * x1;
      const by = (1 - t) ** 2 * y + 2 * (1 - t) * t * ctrlY + t * t * (y + 1.4);
      const length = 6.8 - index * 0.6, width = 1.6 - index * 0.12, angle = side * 0.5;
      const ux = dir * Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
      const m1x = bx + ux * length * 0.45 + nx * width * (1 + 0.45 * side), m1y = by + uy * length * 0.45 + ny * width * (1 + 0.45 * side);
      const m2x = bx + ux * length * 0.55 - nx * width * (1 - 0.45 * side), m2y = by + uy * length * 0.55 - ny * width * (1 - 0.45 * side);
      c.path([["M", bx, by], ["Q", m1x, m1y, bx + ux * length, by + uy * length], ["Q", m2x, m2y, bx, by], ["Z"]], { fill: C.gold });
    });
  }
  sparkle(c, cx, y, 3);
}

/**
 * MONOGRAMA DE LUNA (aprobado): creciente fina que abraza las iniciales entrelazadas —la primera en Cormorant Garamond recta, la
 * segunda en cursiva—, con la estrella de la marca en la punta. Con una sola inicial, la letra va al centro. `s` = 1 → radio 34 pt.
 * `stroke` = refuerzo de trazo fino (el monograma pequeño del frente lo necesita para no perder los remates al imprimirse).
 */
function monogram(c: Canvas, initials: readonly string[], cx: number, cy: number, s: number, stroke = 0) {
  const k = (34 * s) / 62;
  const R = 62 * k, t = 3.6 * k, r = R - t * 0.55, d = t * 0.6, rot = 0.35;
  const ix = (d * d + R * R - r * r) / (2 * d), iy = Math.sqrt(R * R - ix * ix);
  const at = (x: number, y: number): [number, number] => [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
  const [x1, y1] = at(ix, iy), [x2, y2] = at(ix, -iy);
  // Las banderas de arco están pensadas para la `y` negada del trazado SVG (convención de `ScenePath`).
  c.path([["M", x1, y1], ["A", R, 1, 0, x2, y2], ["A", r, 1, 1, x1, y1], ["Z"]], { fill: C.gold, ...(stroke ? { stroke: { color: C.gold, width: stroke } } : {}) });
  const letter = (font: PrintFontKey, size: number): Style => ({ font, size, color: C.gold, role: "monograma", ...(stroke ? { stroke } : {}) });
  const [a, b] = initials;
  if (a && b) {
    c.glyph(a, letter("serif", 78 * k), cx - 12 * k, cy + 7 * k);
    c.glyph(b, letter("italic", 78 * k), cx + 14 * k, cy - 9 * k);
  } else if (a) c.glyph(a, letter("serif", 84 * k), cx - 2 * k, cy);
  sparkle(c, x1 + 3 * k, y1 + 3 * k, 5 * k);
}

/** Doble filete (0,75 pt fuera, 0,4 pt dentro), abierto arriba en `gapHalf` a cada lado del centro. */
function doubleFrame(c: Canvas, gapHalf: number) {
  for (const [inset, width] of [[24, 0.75], [28, 0.4]] as const) {
    const top = c.h - inset;
    c.line(inset, inset, c.w - inset, inset, width);
    c.line(inset, inset, inset, top, width);
    c.line(c.w - inset, inset, c.w - inset, top, width);
    c.line(inset, top, c.cx - gapHalf, top, width);
    c.line(c.cx + gapHalf, top, c.w - inset, top, width);
  }
}

/* ───────── páginas ───────── */

function front(c: Canvas, data: PrintData, warnings: Set<PrintWarning>) {
  doubleFrame(c, 32);
  monogram(c, data.initials, c.cx, c.h - 26, 0.46, 0.16);

  // Nombres: una línea si caben a ≥ 38 pt; si no, dos líneas («Nombre» / «& Nombre»).
  const [n1 = "", n2] = data.names;
  const ampRatio = 0.62, gapEm = 0.2;
  const script = (size: number): Style => ({ font: "script", size, color: C.gold, role: "nombres" });
  const ampStyle = (size: number): Style => ({ font: "lightItalic", size: size * ampRatio, color: C.gold, role: "nombres" });
  const oneLine = (size: number) => c.width(n1, script(size)) + (n2 ? c.width(n2, script(size)) + c.width("&", ampStyle(size)) + 2 * gapEm * size : 0);
  let nameSize = Math.min(52, (330 / oneLine(10)) * 10);
  const twoLines = Boolean(n2) && nameSize < 38;
  if (twoLines && n2) nameSize = Math.min(40, (340 / c.width(n1, script(10))) * 10, (340 / c.width(n2, script(10))) * 10);

  const venueLines = data.ceremony ? balanceLines(data.ceremony.name, 380, (value) => c.width(value, T.venue)) : [];
  // Pila vertical: [elemento, distancia de su línea base a la del anterior]. Con los datos de la demostración reproduce el arte aprobado.
  const stack: [string, number][] = [
    ["kicker", 0],
    ...(twoLines ? ([["name1", 46], ["name2", nameSize * 1.02], ["invite", 36]] as [string, number][]) : ([["names", 52], ["invite", 30]] as [string, number][])),
    ["sprig", 21],
    ["date", 26],
    ["time", 16],
    ...venueLines.map((_, index): [string, number] => [`venue${index}`, index ? 18.5 : 31]),
    ...(data.ceremony?.city ? ([["city", 16]] as [string, number][]) : []),
    ["closing", 30],
  ];
  // Centro óptico de la pila aprobada: y = 161 (rótulo en 272, cierre en 50). Límites: rótulo ≤ 296 (bajo el monograma) y cierre ≥ 44
  // (sobre el filete interior). Si no cabe, se apoya abajo y, si aún no cabe, se comprimen los ESPACIOS, nunca los cuerpos de letra.
  let span = stack.reduce((sum, [, gap]) => sum + gap, 0);
  const TOP = 296, BOTTOM = 44, MID = 161;
  const squeeze = Math.min(1, (TOP - BOTTOM) / span);
  if (squeeze < 1) {
    stack.forEach((entry) => (entry[1] *= squeeze));
    span *= squeeze;
    warnings.add("spacingCompressed");
  }
  let y = Math.min(TOP, Math.max(MID + span / 2, BOTTOM + span));
  const Y = new Map<string, number>();
  for (const [key, gap] of stack) {
    y -= gap;
    Y.set(key, y);
  }
  const at = (key: string) => Y.get(key) ?? 0;

  c.centered(card.intro, T.kicker, at("kicker"));
  const namesLine = (parts: { text: string; style: Style; dy: number }[], yy: number) => {
    const widths = parts.map((part) => c.width(part.text, part.style));
    let x = c.cx - (widths.reduce((sum, w) => sum + w, 0) + gapEm * nameSize * (parts.length - 1)) / 2;
    parts.forEach((part, index) => {
      c.text(part.text, part.style, x, yy + part.dy);
      x += (widths[index] ?? 0) + gapEm * nameSize;
    });
  };
  const amp = { text: "&", style: ampStyle(nameSize), dy: nameSize * 0.1 };
  if (twoLines && n2) {
    namesLine([{ text: n1, style: script(nameSize), dy: 0 }], at("name1"));
    namesLine([amp, { text: n2, style: script(nameSize), dy: 0 }], at("name2"));
  } else namesLine(n2 ? [{ text: n1, style: script(nameSize), dy: 0 }, amp, { text: n2, style: script(nameSize), dy: 0 }] : [{ text: n1, style: script(nameSize), dy: 0 }], at("names"));

  c.centered(card.invite, T.invite, at("invite"));
  sprig(c, c.cx, at("sprig"));
  c.centered(data.dateLine, T.date, at("date"));
  c.centered(data.timeLine.toLocaleUpperCase("es-MX"), T.time, at("time"));
  venueLines.forEach((line, index) => c.centered(line, T.venue, at(`venue${index}`)));
  if (data.ceremony?.city) c.centered(data.ceremony.city.toLocaleUpperCase("es-MX"), T.city, at("city"));
  c.centered(card.closing, T.closing, at("closing"));
}

interface Column {
  label: string;
  rows: ([Style, string, number] | [null, null, number])[];
  palette?: readonly string[];
}

function venueRows(time: string | undefined, name: string, addressLines: readonly string[]): Column["rows"] {
  const [first, ...rest] = addressLines;
  return [
    ...(time ? ([[T.colTime, time, 18]] as Column["rows"]) : ([[null, null, 18]] as Column["rows"])),
    [T.colVenue, name, 19],
    ...(first ? ([[T.addr, first, 15]] as Column["rows"]) : []),
    ...rest.map((line): Column["rows"][number] => [T.addr, line, 11.2]),
  ];
}

function back(c: Canvas, data: PrintData, warnings: Set<PrintWarning>) {
  doubleFrame(c, 12);
  sparkle(c, c.cx, c.h - 26, 4);
  c.centered(card.backTitle, T.backTitle, 282);

  const columns: Column[] = [];
  if (data.ceremony) columns.push({ label: card.ceremony, rows: venueRows(data.ceremony.time, data.ceremony.name, data.ceremony.addressLines) });
  if (data.reception) columns.push({ label: card.reception, rows: venueRows(data.reception.time, data.reception.name, data.reception.addressLines) });
  if (data.dressCode) columns.push({ label: card.dressCode, rows: [[null, null, 18], [T.colVenue, data.dressCode.style, 19], ...(data.dressCode.description ? ([[T.addr, data.dressCode.description, 15]] as Column["rows"]) : [])], palette: data.dressCode.palette });

  const grid = ({ 1: { xs: [0.5], w: 250 }, 2: { xs: [0.31, 0.69], w: 170 }, 3: { xs: [0.205, 0.5, 0.795], w: 128 } } as const)[columns.length as 1 | 2 | 3];
  const xs: readonly number[] = grid ? grid.xs.map((fraction) => c.w * fraction) : [];
  const colWidth = grid?.w ?? 250;

  // Dos pasadas: la primera mide (para centrar el bloque cuando no hay QR), la segunda dibuja.
  const run = (top: number, draw: boolean) => {
    let lowest = top;
    columns.forEach((column, index) => {
      const cx = xs[index] ?? c.cx;
      let y = top;
      if (draw) c.centered(column.label, T.label, y, cx, colWidth);
      for (const [style, text, gap] of column.rows) {
        if (!style) {
          y -= gap;
          continue;
        }
        let used: Style = style;
        let lines = style === T.colVenue || style === T.addr ? balanceLines(text, colWidth, (value) => c.width(value, used)) : [text];
        // Una sede que pediría 3 líneas prueba antes con 12 pt.
        if (style === T.colVenue && lines.length > 2) {
          const small: Style = { ...style, size: 12 };
          const retry = balanceLines(text, colWidth, (value) => c.width(value, small));
          if (retry.length < lines.length) {
            used = small;
            lines = retry;
          }
        }
        lines.forEach((line, lineIndex) => {
          y -= lineIndex === 0 ? gap : used.size * 1.22;
          if (draw) c.centered(line, used, y, cx, colWidth);
        });
      }
      if (column.palette?.length) {
        const dot = 3.8, step = 12, x0 = cx - ((column.palette.length - 1) * step) / 2;
        y -= 15;
        if (draw) column.palette.forEach((hex, index) => c.circle(x0 + index * step, y, dot, hex, { color: C.line, width: 0.3 }));
        y -= dot;
      }
      lowest = Math.min(lowest, y);
    });
    return lowest;
  };

  const qr = data.qr;
  // Con QR, las columnas arrancan en 246 (composición aprobada). Sin QR, el bloque se centra entre el título y el filete inferior.
  const height = 246 - run(246, false) + T.label.size;
  // Sin QR (D-49): el bloque sube un poco del centro óptico y lo cierra el mismo filete corto que separa las columnas del QR.
  const top = qr ? 246 : Math.min(246, (262 + 28) / 2 + height / 2 + 12);
  const lowest = run(top, true);
  for (let index = 0; index < columns.length - 1; index++) {
    const x = ((xs[index] ?? 0) + (xs[index + 1] ?? 0)) / 2;
    c.line(x, Math.max(lowest - 6, qr ? 150 : 0), x, top + 6, 0.4);
  }
  if (!qr && lowest - 30 > 40) c.line(c.cx - 22, lowest - 30, c.cx + 22, lowest - 30, 0.4);

  if (qr) {
    // QR: corrección M, lado ≥ 1" y módulo ≥ 0,75 mm (crece con URLs largas). Elegido con la simulación de impresión + cámara.
    const matrix = createQrMatrix(qr.url);
    const size = Math.max(72 * c.k, matrix.size * 0.75 * PT_PER_MM) / c.k; // en puntos reales: ≥ 1" (escalado) y módulo ≥ 0,75 mm
    const qy = 46, gapX = 20;
    const words = card.qr[qr.kind];
    // El enlace escrito se ajusta (hasta 7 pt) para que el grupo QR + texto quepa dentro del marco.
    const room = c.w - 2 * 40 - size - gapX;
    let urlStyle: Style = T.url;
    if (qr.label && c.width(qr.label, urlStyle) > room) {
      const scale = Math.max(7 / T.url.size, room / c.width(qr.label, urlStyle));
      urlStyle = { ...T.url, size: T.url.size * scale, tracking: (T.url.tracking ?? 0) * scale };
      warnings.add("textFitted");
    }
    // La indicación va en una línea si cabe junto al QR; si no, en líneas equilibradas.
    const hintLines = balanceLines(words.hint, room, (value) => c.width(value, T.addr));
    // Renglones del bloque (estilo, texto, distancia desde el anterior). El enlace directo a una tienda no se escribe: solo se escanea.
    const lines: Array<[Style, string, number]> = [[T.rsvpTitle, words.title, 0], ...hintLines.map((line, index): [Style, string, number] => [T.addr, line, index === 0 ? 15 : 11.5]), ...(qr.label ? [[urlStyle, qr.label, 12] as [Style, string, number]] : [])];
    const textWidth = Math.max(...lines.map(([style, text]) => c.width(text, style)));
    const qx = c.cx - (size + gapX + textWidth) / 2;
    if (lowest >= 150) c.line(c.cx - 22, 138, c.cx + 22, 138, 0.4);
    else if (lowest < qy + size + 16) warnings.add("columnsTight");
    c.qr(matrix.rows, qx, qy, size);
    const tx = qx + size + gapX, mid = qy + size / 2;
    // Bloque centrado en la altura del QR (con título, indicación y enlace: título en mid + 9, como en la composición aprobada).
    const span = lines.reduce((sum, [, , gap]) => sum + gap, 0);
    let baseline = mid + span / 2 - 4.5;
    for (const [style, text, gap] of lines) {
      baseline -= gap;
      c.text(text, style, tx, baseline);
    }
  }
}

function envelope(c: Canvas, data: PrintData) {
  monogram(c, data.initials, c.cx, c.h / 2 - 2, 1.45);
}

/** Compone la escena completa: frente, reverso (opcional) y arte del sobre. */
export function layoutRomanticElegant(data: PrintData, options: PrintLayoutOptions, metrics: PrintFontMetrics): PrintScene {
  const spec = PRINT_FORMAT_SPECS[options.format];
  const k = spec.height / BASE_H;
  const warnings = new Set<PrintWarning>();
  const page = (kind: ScenePage["kind"], width: number, height: number, scale: number, draw: (canvas: Canvas) => void, background?: string): ScenePage => {
    const canvas = new Canvas(width / scale, height / scale, scale, metrics, warnings);
    draw(canvas);
    return { kind, width, height, items: canvas.items, ...(background ? { background } : {}) };
  };

  const pages: ScenePage[] = [page("front", spec.width, spec.height, k, (c) => front(c, data, warnings), C.paper)];
  if (options.includeBack) pages.push(page("back", spec.width, spec.height, k, (c) => back(c, data, warnings), C.paper));
  pages.push(page("envelope", ENVELOPE_ART_PT, ENVELOPE_ART_PT, 1, (c) => envelope(c, data)));
  return { pages, warnings: [...warnings] };
}
