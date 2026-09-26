import { MEDIA_LIMITS, type AcceptedImageMime } from "@/lib/media/limits";

/**
 * INSPECCIÓN DE UNA IMAGEN a partir de sus primeros bytes (sin librerías): tipo REAL por firma («magic
 * bytes»), dimensiones y orientación EXIF. Es la validación que decide el servidor tras la subida: el MIME
 * declarado por el navegador y la extensión no valen. Pura y probada.
 */
export interface InspectedImage {
  mime: AcceptedImageMime;
  /** Dimensiones DESPUÉS de aplicar la orientación EXIF (lo que verá la persona). */
  width: number;
  height: number;
}

export type InspectResult = { ok: true; image: InspectedImage } | { ok: false; reason: "type" | "unreadable" | "pixels" };

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) => signature.every((value, index) => bytes[offset + index] === value);
const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));

/** Tipo real por firma. `undefined` si no es JPEG, PNG ni WEBP (SVG, GIF, HTML, ejecutables…). */
export function detectImageMime(bytes: Uint8Array): AcceptedImageMime | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  return undefined;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 30) return undefined;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") return { width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff, height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff };
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const b = (i: number) => bytes[20 + i]!;
    return { width: 1 + (((b(2) & 0x3f) << 8) | b(1)), height: 1 + (((b(4) & 0x0f) << 10) | (b(3) << 2) | ((b(2) & 0xc0) >> 6)) };
  }
  if (chunk === "VP8X") return { width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)), height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) };
  return undefined;
}

/** Orientación EXIF (1–8) de un JPEG, si la trae en el segmento APP1. */
function jpegOrientation(bytes: Uint8Array, app1: number, length: number): number | undefined {
  const start = app1 + 4; // tras marcador (2) y longitud (2)
  if (ascii(bytes, start, 4) !== "Exif") return undefined;
  const tiff = start + 6;
  const little = ascii(bytes, tiff, 2) === "II";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, little);
  const u32 = (offset: number) => view.getUint32(offset, little);
  const end = Math.min(bytes.length, app1 + 2 + length);
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return undefined;
  const entries = u16(ifd);
  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > end) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : undefined;
    }
  }
  return undefined;
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let orientation: number | undefined;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1; // relleno
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (length < 2) return undefined;
    if (marker === 0xe1 && orientation === undefined) orientation = jpegOrientation(bytes, offset, length);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (offset + 9 > bytes.length) return undefined;
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);
      // Orientaciones 5–8 giran 90°: el ancho y el alto visibles se intercambian.
      return orientation !== undefined && orientation >= 5 ? { width: height, height: width } : { width, height };
    }
    offset += 2 + length;
  }
  return undefined;
}

/** Inspecciona los primeros bytes del objeto (basta ≈ 256 KB). */
export function inspectImage(bytes: Uint8Array): InspectResult {
  const mime = detectImageMime(bytes);
  if (!mime) return { ok: false, reason: "type" };
  const size = mime === "image/png" ? pngSize(bytes) : mime === "image/webp" ? webpSize(bytes) : jpegSize(bytes);
  if (!size || size.width < 1 || size.height < 1) return { ok: false, reason: "unreadable" };
  if ((size.width * size.height) / 1_000_000 > MEDIA_LIMITS.maxMegapixels) return { ok: false, reason: "pixels" };
  return { ok: true, image: { mime, ...size } };
}

/** Bytes que se leen del objeto para inspeccionarlo (el encabezado de un JPEG con EXIF grande cabe de sobra). */
export const INSPECT_BYTES = 256 * 1024;

/**
 * Orientación EXIF (1–8) de un JPEG completo o de su encabezado, o `undefined` si no la trae. Recorre los segmentos hasta el primer
 * APP1 con datos EXIF (ahí vive siempre). Lo usa la normalización de privacidad para decidir si hay que girar la imagen antes de
 * eliminar los metadatos.
 */
export function readJpegOrientation(bytes: Uint8Array): number | undefined {
  if (!startsWith(bytes, [0xff, 0xd8, 0xff])) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return undefined; // datos de imagen: ya no hay segmentos de metadatos
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (length < 2) return undefined;
    if (marker === 0xe1) {
      const found = jpegOrientation(bytes, offset, length);
      if (found !== undefined) return found;
    }
    offset += 2 + length;
  }
  return undefined;
}
