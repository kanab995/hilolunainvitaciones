import qrcode from "qrcode-generator";

/**
 * CÓDIGO QR (D-30). Se genera LOCALMENTE con `qrcode-generator` (MIT, sin dependencias): ninguna URL sale a un
 * servicio de terceros y el QR no se guarda en la base de datos. Solo codifica una URL: por sí mismo no es una
 * capa de seguridad (el `inviteToken` sigue siendo la credencial). Estética: tinta oscura sobre blanco, sin
 * degradados ni logos (alto contraste para escanear e imprimir); corrección de errores «M».
 */
export const QR_COLORS = { dark: "#21170d", light: "#ffffff" } as const;
/** Margen (zona de silencio) en módulos: 4 es el mínimo de la norma. */
export const QR_MARGIN = 4;
/** Lado del PNG descargable: nítido para pantalla y para impresión (≈ 8,7 cm a 300 ppp). */
export const QR_PNG_SIZE = 1024;

export interface QrMatrix {
  /** Módulos por lado. */
  size: number;
  rows: boolean[][];
}

/** Matriz de módulos del QR de `text` (versión automática, corrección «M»). */
export function createQrMatrix(text: string): QrMatrix {
  if (!text) throw new Error("No hay nada que codificar.");
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const rows = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
  return { size, rows };
}

/** SVG limpio y escalable (una sola ruta, `crispEdges`): módulos oscuros sobre un fondo sólido. */
export function qrToSvg(matrix: QrMatrix, options: { margin?: number; dark?: string; light?: string } = {}): string {
  const { margin = QR_MARGIN, dark = QR_COLORS.dark, light = QR_COLORS.light } = options;
  const total = matrix.size + margin * 2;
  let path = "";
  matrix.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end += 1;
      path += `M${x + margin} ${y + margin}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}

/** Qué se codifica: la URL tal cual (nada más). Separado para poder probar qué contiene cada QR. */
export const qrPayload = (url: string): string => url;

/**
 * PNG del QR (solo navegador): dibuja los módulos en un canvas con celdas de tamaño entero (bordes nítidos, sin
 * suavizado) y lo exporta. Rechaza si el canvas o la exportación no están disponibles.
 */
export function qrToPngBlob(matrix: QrMatrix, size: number = QR_PNG_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return reject(new Error("El PNG solo se genera en el navegador."));
    const total = matrix.size + QR_MARGIN * 2;
    const cell = Math.max(1, Math.floor(size / total));
    const side = cell * total;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) return reject(new Error("Canvas no disponible."));
    context.fillStyle = QR_COLORS.light;
    context.fillRect(0, 0, side, side);
    context.fillStyle = QR_COLORS.dark;
    matrix.rows.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) context.fillRect((x + QR_MARGIN) * cell, (y + QR_MARGIN) * cell, cell, cell);
      }),
    );
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo exportar el PNG."))), "image/png");
  });
}
