import { detectImageMime, readJpegOrientation } from "@/server/storage/image-inspect";
import type { AcceptedImageMime } from "@/lib/media/limits";

/**
 * NORMALIZACIÓN DE PRIVACIDAD DE LAS IMÁGENES SUBIDAS (preproducción). Una foto de móvil trae EXIF con la ubicación GPS, el modelo del
 * teléfono, la fecha y a veces una miniatura: al publicarla, cualquiera que descargue el archivo puede leerlo. Antes de declarar una
 * imagen `READY` el servidor elimina esos metadatos SIN degradar la imagen siempre que se pueda:
 *  - JPEG sin rotación: se eliminan los segmentos APP1 (EXIF/XMP), APP13 (IPTC/Photoshop), comentarios y APPn desconocidos; se conservan
 *    JFIF (APP0) y el perfil de color ICC (APP2 `ICC_PROFILE`). Los datos de imagen NO se recodifican (sin pérdida de calidad).
 *  - PNG: se eliminan los fragmentos `eXIf`, `tEXt`, `zTXt`, `iTXt` y `tIME`; el resto (incluido el perfil de color) se copia idéntico.
 *  - WEBP: se eliminan los fragmentos `EXIF` y `XMP ` y se limpian sus banderas en `VP8X`; el resto se copia idéntico.
 *  - Con ORIENTACIÓN EXIF distinta de 1 (foto tomada de lado) no basta con borrar la etiqueta —la imagen se vería girada—: se gira con
 *    `sharp` (el que ya trae Next.js, cargado bajo demanda) y se recodifica con calidad alta (JPEG 95 sin submuestreo de croma, WEBP 95).
 *    Si `sharp` no está disponible se RECHAZA la imagen (nunca se publica con metadatos ni girada).
 * Módulo puro salvo la carga perezosa de `sharp` (inyectable en pruebas).
 */
export type NormalizeMethod = "unchanged" | "stripped" | "rotated";
export type NormalizeResult = { ok: true; bytes: Uint8Array; changed: boolean; method: NormalizeMethod } | { ok: false; reason: "invalid" | "unavailable" };

export interface SharpLike {
  (input: Uint8Array, options?: Record<string, unknown>): {
    rotate(): { jpeg(options?: Record<string, unknown>): { toBuffer(): Promise<Uint8Array> }; webp(options?: Record<string, unknown>): { toBuffer(): Promise<Uint8Array> } };
  };
}

export interface NormalizeDeps {
  /** Carga `sharp` o devuelve `undefined` si no está instalado. */
  loadSharp: () => Promise<SharpLike | undefined>;
  maxMegapixels: number;
}

const defaultDeps: NormalizeDeps = {
  loadSharp: async () => {
    try {
      const sharpModule = await import("sharp");
      return (sharpModule.default ?? sharpModule) as unknown as SharpLike;
    } catch {
      return undefined;
    }
  },
  maxMegapixels: 40,
};

const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

// ───────── JPEG ─────────

/** Elimina metadatos de un JPEG sin recodificar. `undefined` si la estructura de segmentos está corrupta. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Fuera de la estructura de segmentos (imagen truncada o de relleno): los segmentos de metadatos ya se eliminaron; el resto se copia.
      kept.push(bytes.subarray(offset));
      return concat(kept);
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) return concat(kept);
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Inicio del escaneo (o fin): desde aquí todo son datos de imagen, se copian tal cual.
    if (marker === 0xda || marker === 0xd9) {
      kept.push(bytes.subarray(offset));
      return concat(kept);
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) return undefined;
    const length = view.getUint16(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return undefined;
    const isIcc = marker === 0xe2 && ascii(bytes, offset + 4, 11) === "ICC_PROFILE";
    const isJfif = marker === 0xe0 && ascii(bytes, offset + 4, 4) === "JFIF";
    const isAppOrComment = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isAppOrComment || isIcc || isJfif) kept.push(bytes.subarray(offset, end));
    offset = end;
  }
  // Sin marcador de escaneo (encabezado truncado): se devuelve lo conservado.
  return concat(kept);
}

// ───────── PNG ─────────

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

export function stripPngMetadata(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes.length < 8) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return undefined;
    if (!PNG_DROP.has(ascii(bytes, offset + 4, 4))) kept.push(bytes.subarray(offset, end));
    offset = end;
  }
  return concat(kept);
}

// ───────── WEBP ─────────

/** ¿Trae EXIF o XMP? (recorre los fragmentos RIFF). */
export function webpChunks(bytes: Uint8Array): Array<{ type: string; start: number; end: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Array<{ type: string; start: number; end: number }> = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true);
    const end = Math.min(bytes.length, offset + 8 + size + (size % 2));
    chunks.push({ type: ascii(bytes, offset, 4), start: offset, end });
    if (end <= offset) break;
    offset = end;
  }
  return chunks;
}

export function stripWebpMetadata(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes.length < 12) return undefined;
  const chunks = webpChunks(bytes);
  if (!chunks.some((chunk) => chunk.type === "EXIF" || chunk.type === "XMP ")) return bytes;
  const kept: Uint8Array[] = [];
  for (const chunk of chunks) {
    if (chunk.type === "EXIF" || chunk.type === "XMP ") continue;
    const part = bytes.slice(chunk.start, chunk.end);
    // VP8X: limpia las banderas de EXIF (0x08) y XMP (0x04).
    if (chunk.type === "VP8X" && part.length > 8) part[8] = (part[8] ?? 0) & ~0x0c;
    kept.push(part);
  }
  const body = concat(kept);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12));
  out.set(body, 12);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}

/** Orientación EXIF de un WEBP (dentro del fragmento `EXIF`, con o sin prefijo `Exif\0\0`). */
export function readWebpOrientation(bytes: Uint8Array): number | undefined {
  const chunk = webpChunks(bytes).find((item) => item.type === "EXIF");
  if (!chunk) return undefined;
  let start = chunk.start + 8;
  if (ascii(bytes, start, 4) === "Exif") start += 6;
  try {
    const little = ascii(bytes, start, 2) === "II";
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = (offset: number) => view.getUint16(offset, little);
    const ifd = start + view.getUint32(start + 4, little);
    const entries = u16(ifd);
    for (let index = 0; index < entries; index += 1) {
      const entry = ifd + 2 + index * 12;
      if (entry + 12 > chunk.end) break;
      if (u16(entry) === 0x0112) {
        const value = u16(entry + 8);
        return value >= 1 && value <= 8 ? value : undefined;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

// ───────── API ─────────

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, index) => value === b[index]);

export async function normalizeImage(bytes: Uint8Array, mime: AcceptedImageMime, deps: NormalizeDeps = defaultDeps): Promise<NormalizeResult> {
  if (detectImageMime(bytes) !== mime) return { ok: false, reason: "invalid" };

  let orientation: number | undefined;
  try {
    orientation = mime === "image/jpeg" ? readJpegOrientation(bytes) : mime === "image/webp" ? readWebpOrientation(bytes) : undefined;
  } catch {
    orientation = undefined;
  }

  if (orientation !== undefined && orientation > 1) {
    const sharp = await deps.loadSharp();
    if (!sharp) return { ok: false, reason: "unavailable" };
    try {
      const pipeline = sharp(bytes, { failOn: "error", limitInputPixels: deps.maxMegapixels * 1_000_000 }).rotate();
      const out = mime === "image/webp" ? await pipeline.webp({ quality: 95 }).toBuffer() : await pipeline.jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer();
      return { ok: true, bytes: new Uint8Array(out), changed: true, method: "rotated" };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }

  const stripped = mime === "image/jpeg" ? stripJpegMetadata(bytes) : mime === "image/png" ? stripPngMetadata(bytes) : stripWebpMetadata(bytes);
  if (!stripped) return { ok: false, reason: "invalid" };
  const changed = !same(bytes, stripped);
  return { ok: true, bytes: stripped, changed, method: changed ? "stripped" : "unchanged" };
}
