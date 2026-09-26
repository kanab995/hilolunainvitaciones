import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeImage, readWebpOrientation, stripJpegMetadata, stripPngMetadata, stripWebpMetadata, webpChunks, type SharpLike } from "@/server/media/normalize";
import { inspectImage, readJpegOrientation } from "@/server/storage/image-inspect";
import { createImageUpload, finalizeImageUpload } from "@/server/services/media-service";
import { makeWorld } from "../helpers/media-world";

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const u16 = (value: number) => [(value >> 8) & 0xff, value & 0xff];
const contains = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text));

/** APP1 EXIF con GPS (marcadores legibles) y, opcionalmente, orientación. */
function exifSegment(orientation?: number): number[] {
  const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation ?? 1, 0, 0, 0, 0, 0, 0];
  const payload = [...ascii("Exif"), 0, 0, ...tiff, ...ascii("GPSLatitude=19.4326 GPSLongitude=-99.1332 Model=iPhone"),];
  return [0xff, 0xe1, ...u16(payload.length + 2), ...payload];
}

/** JPEG mínimo pero estructurado: SOI, JFIF, EXIF/GPS, IPTC (APP13), comentario, ICC, DQT, SOF0, SOS y datos. */
function richJpeg(width: number, height: number, orientation?: number): Uint8Array {
  const jfif = [0xff, 0xe0, 0, 16, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const iptc = [0xff, 0xed, ...u16(2 + 13), ...ascii("Photoshop 3.0")];
  const comment = [0xff, 0xfe, ...u16(2 + 15), ...ascii("Foto de Andrea!")];
  const icc = [0xff, 0xe2, ...u16(2 + 12 + 4), ...ascii("ICC_PROFILE"), 0, 1, 2, 3, 4];
  const dqt = [0xff, 0xdb, 0, 5, 0, 1, 2];
  const sof = [0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0];
  const data = [0x12, 0x34, 0x56, 0xff, 0xd9];
  return new Uint8Array([0xff, 0xd8, ...jfif, ...exifSegment(orientation), ...iptc, ...comment, ...icc, ...dqt, ...sof, ...sos, ...data]);
}

function pngWith(chunks: Array<[string, number[]]>): Uint8Array {
  const out: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (const [type, data] of chunks) out.push((data.length >>> 24) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 8) & 0xff, data.length & 0xff, ...ascii(type), ...data, 1, 2, 3, 4);
  return new Uint8Array(out);
}

function webpWith(width: number, height: number, extra: Array<[string, number[]]>): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  const flags = extra.some(([type]) => type === "EXIF") ? 0x08 : 0;
  const chunk = (type: string, data: number[]) => [...ascii(type), data.length & 0xff, (data.length >> 8) & 0xff, 0, 0, ...data, ...(data.length % 2 ? [0] : [])];
  const vp8x = chunk("VP8X", [flags, 0, 0, 0, w & 0xff, (w >> 8) & 0xff, 0, h & 0xff, (h >> 8) & 0xff, 0]);
  const body = [...vp8x, ...extra.flatMap(([type, data]) => chunk(type, data)), ...chunk("VP8 ", [1, 2, 3, 4])];
  const size = 4 + body.length;
  return new Uint8Array([...ascii("RIFF"), size & 0xff, (size >> 8) & 0xff, 0, 0, ...ascii("WEBP"), ...body]);
}

describe("(18/19) JPEG: se eliminan EXIF/GPS, IPTC y comentarios SIN recodificar la imagen", () => {
  it("la fixture trae GPS, IPTC y comentario", () => {
    const jpeg = richJpeg(1200, 800);
    for (const marker of ["GPSLatitude", "Model=iPhone", "Photoshop 3.0", "Foto de Andrea"]) expect(contains(jpeg, marker), marker).toBe(true);
  });

  it("tras normalizar no queda ninguno; se conservan JFIF y el perfil de color ICC; los datos de imagen (SOS + escaneo) son idénticos", async () => {
    const original = richJpeg(1200, 800);
    const result = await normalizeImage(original, "image/jpeg");
    expect(result).toMatchObject({ ok: true, changed: true, method: "stripped" });
    if (!result.ok) return;
    for (const marker of ["GPSLatitude", "GPSLongitude", "Model=iPhone", "Exif", "Photoshop 3.0", "Foto de Andrea"]) expect(contains(result.bytes, marker), marker).toBe(false);
    expect(contains(result.bytes, "JFIF")).toBe(true);
    expect(contains(result.bytes, "ICC_PROFILE")).toBe(true);
    // Lo que va desde el marcador SOS hasta el final es exactamente igual: sin pérdida de calidad.
    const tail = (bytes: Uint8Array) => Buffer.from(bytes).subarray(Buffer.from(bytes).indexOf(Buffer.from([0xff, 0xda])));
    expect(tail(result.bytes).equals(tail(original))).toBe(true);
    // La imagen resultante sigue siendo válida y con las mismas dimensiones.
    expect(inspectImage(result.bytes)).toMatchObject({ ok: true, image: { mime: "image/jpeg", width: 1200, height: 800 } });
  });

  it("orientación EXIF 1 (sin giro): solo se limpia; una imagen ya limpia queda sin cambios", async () => {
    expect(readJpegOrientation(richJpeg(10, 10, 1))).toBe(1);
    expect(await normalizeImage(richJpeg(10, 10, 1), "image/jpeg")).toMatchObject({ ok: true, method: "stripped" });
    const clean = (await normalizeImage(richJpeg(10, 10), "image/jpeg")) as { ok: true; bytes: Uint8Array };
    expect(await normalizeImage(clean.bytes, "image/jpeg")).toMatchObject({ ok: true, changed: false, method: "unchanged" });
  });

  it("orientación 2–8: se GIRA con sharp (no basta con borrar la etiqueta) y se recodifica con calidad alta", async () => {
    const jpegOptions: Array<Record<string, unknown> | undefined> = [];
    const fakeSharp: SharpLike = () => ({
      rotate: () => ({
        jpeg: (options) => {
          jpegOptions.push(options);
          return { toBuffer: async () => richJpeg(800, 1200) };
        },
        webp: () => ({ toBuffer: async () => new Uint8Array() }),
      }),
    });
    const result = await normalizeImage(richJpeg(1200, 800, 6), "image/jpeg", { loadSharp: async () => fakeSharp, maxMegapixels: 40 });
    expect(result).toMatchObject({ ok: true, changed: true, method: "rotated" });
    expect(jpegOptions[0]).toMatchObject({ quality: 95, chromaSubsampling: "4:4:4" });
  });

  it("orientación ≠ 1 sin sharp disponible: se RECHAZA (nunca se publica con metadatos ni girada)", async () => {
    expect(await normalizeImage(richJpeg(1200, 800, 8), "image/jpeg", { loadSharp: async () => undefined, maxMegapixels: 40 })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("un archivo que no es del tipo declarado o con estructura corrupta se rechaza", async () => {
    expect(await normalizeImage(new Uint8Array([1, 2, 3, 4, 5]), "image/jpeg")).toMatchObject({ ok: false });
    expect(await normalizeImage(richJpeg(10, 10), "image/png")).toMatchObject({ ok: false, reason: "invalid" });
    expect(stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0, 0]))).toBeUndefined();
  });
});

describe("PNG y WEBP", () => {
  it("PNG: se eliminan eXIf, tEXt, zTXt, iTXt y tIME; IHDR, IDAT, IEND, perfil y transparencia se copian idénticos", async () => {
    const png = pngWith([["IHDR", Array(13).fill(0)], ["eXIf", ascii("GPS 19.43")], ["tEXt", ascii("Author\0Ana")], ["iCCP", ascii("perfil")], ["tIME", [0, 0, 0, 0, 0, 0, 0]], ["IDAT", [9, 9]], ["IEND", []]]);
    const result = await normalizeImage(png, "image/png");
    expect(result).toMatchObject({ ok: true, changed: true });
    if (!result.ok) return;
    for (const text of ["eXIf", "tEXt", "tIME", "GPS 19.43", "Author"]) expect(contains(result.bytes, text), text).toBe(false);
    for (const text of ["IHDR", "iCCP", "IDAT", "IEND"]) expect(contains(result.bytes, text), text).toBe(true);
    expect(stripPngMetadata(new Uint8Array(4))).toBeUndefined();
  });

  it("WEBP: se eliminan EXIF y XMP, se limpian las banderas de VP8X y el tamaño RIFF queda consistente", async () => {
    const webp = webpWith(640, 480, [["EXIF", ascii("Exif\0\0GPS 19.43")], ["XMP ", ascii("<x:xmpmeta/>")]]);
    expect(webpChunks(webp).map((chunk) => chunk.type)).toEqual(["VP8X", "EXIF", "XMP ", "VP8 "]);
    const result = await normalizeImage(webp, "image/webp");
    expect(result).toMatchObject({ ok: true, changed: true, method: "stripped" });
    if (!result.ok) return;
    expect(webpChunks(result.bytes).map((chunk) => chunk.type)).toEqual(["VP8X", "VP8 "]);
    expect(contains(result.bytes, "GPS 19.43")).toBe(false);
    expect(result.bytes[20]! & 0x0c).toBe(0);
    expect(new DataView(result.bytes.buffer, result.bytes.byteOffset).getUint32(4, true)).toBe(result.bytes.length - 8);
    expect(inspectImage(result.bytes)).toMatchObject({ ok: true, image: { width: 640, height: 480 } });
  });

  it("WEBP sin metadatos queda idéntico; su orientación se lee del fragmento EXIF cuando existe", () => {
    const clean = webpWith(64, 64, []);
    expect(stripWebpMetadata(clean)).toBe(clean);
    const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0];
    expect(readWebpOrientation(webpWith(64, 64, [["EXIF", [...ascii("Exif"), 0, 0, ...tiff]]]))).toBe(6);
  });
});

describe("integración: finalizar una subida guarda la imagen SIN metadatos", () => {
  async function upload(world: ReturnType<typeof makeWorld>, bytes: Uint8Array, mime = "image/jpeg") {
    const created = await createImageUpload("evt_A", { filename: "foto.jpg", mimeType: mime, sizeBytes: bytes.length }, world.deps);
    if (!created.result.ok) throw new Error("no se pudo iniciar la subida");
    const { mediaAssetId } = created.result.upload;
    world.storage.put(world.repo.assets.get(mediaAssetId)!.storageKey, bytes);
    return { id: mediaAssetId, key: world.repo.assets.get(mediaAssetId)!.storageKey, finalized: await finalizeImageUpload("evt_A", mediaAssetId, world.deps) };
  }

  it("el objeto del almacenamiento se REESCRIBE limpio y el registro guarda el tamaño y las dimensiones reales", async () => {
    const world = makeWorld();
    const original = richJpeg(1600, 900);
    const { id, key, finalized } = await upload(world, original);
    expect(finalized.result.ok).toBe(true);
    expect(world.storage.written).toEqual([key]);
    const stored = world.storage.objects.get(key)!;
    for (const marker of ["GPSLatitude", "Model=iPhone"]) expect(contains(stored, marker)).toBe(false);
    expect(stored.length).toBeLessThan(original.length);
    expect(world.repo.assets.get(id)).toMatchObject({ status: "READY", sizeBytes: stored.length, width: 1600, height: 900 });
  });

  it("una imagen ya limpia no se reescribe", async () => {
    const world = makeWorld();
    const clean = ((await normalizeImage(richJpeg(400, 300), "image/jpeg")) as { ok: true; bytes: Uint8Array }).bytes;
    const { finalized } = await upload(world, clean);
    expect(finalized.result.ok).toBe(true);
    expect(world.storage.written).toEqual([]);
  });

  it("si no se puede procesar (giro sin sharp), la subida se rechaza, el objeto se borra y el registro queda retirado", async () => {
    const world = makeWorld();
    const deps = { ...world.deps, normalize: (bytes: Uint8Array, mime: "image/jpeg" | "image/png" | "image/webp") => normalizeImage(bytes, mime, { loadSharp: async () => undefined, maxMegapixels: 40 }) };
    const created = await createImageUpload("evt_A", { filename: "a.jpg", mimeType: "image/jpeg", sizeBytes: 500 }, deps);
    if (!created.result.ok) throw new Error("subida");
    const key = world.repo.assets.get(created.result.upload.mediaAssetId)!.storageKey;
    world.storage.put(key, richJpeg(1200, 800, 6));
    const outcome = await finalizeImageUpload("evt_A", created.result.upload.mediaAssetId, deps);
    expect(outcome.result).toMatchObject({ ok: false, code: "invalid", message: expect.stringContaining("No pudimos procesar la imagen") });
    expect(world.storage.deleted).toContain(key);
    expect(world.repo.assets.get(created.result.upload.mediaAssetId)?.status).toBe("DELETED");
  });

  it("sharp (el que trae Next) se carga bajo demanda, nunca al importar el módulo: sin él, solo falla el caso de rotación", () => {
    const code = readFileSync("server/media/normalize.ts", "utf8");
    expect(code).not.toMatch(/^import[^\n]*from "sharp"/m);
    expect(code).toMatch(/await import\("sharp"\)/);
  });
});
