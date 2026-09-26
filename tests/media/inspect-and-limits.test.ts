import { describe, expect, it } from "vitest";
import { MEDIA_LIMITS, mediaMessages, sanitizeFilename, validateImageMeta } from "@/lib/media/limits";
import { detectImageMime, inspectImage } from "@/server/storage/image-inspect";
import { GIF_BYTES, jpegBytes, pngBytes, SVG_BYTES, webpBytes } from "../helpers/media-world";

describe("Inspección de la imagen REAL (firma, dimensiones, EXIF)", () => {
  it("reconoce JPEG, PNG y WEBP por su firma y lee sus dimensiones", () => {
    expect(inspectImage(pngBytes(800, 600))).toEqual({ ok: true, image: { mime: "image/png", width: 800, height: 600 } });
    expect(inspectImage(jpegBytes(1200, 900))).toEqual({ ok: true, image: { mime: "image/jpeg", width: 1200, height: 900 } });
    expect(inspectImage(webpBytes(640, 480))).toEqual({ ok: true, image: { mime: "image/webp", width: 640, height: 480 } });
  });

  it("respeta la orientación EXIF: en 5–8 el ancho y el alto se intercambian", () => {
    expect(inspectImage(jpegBytes(4000, 3000, 6))).toMatchObject({ ok: true, image: { width: 3000, height: 4000 } });
    expect(inspectImage(jpegBytes(4000, 3000, 1))).toMatchObject({ ok: true, image: { width: 4000, height: 3000 } });
  });

  it("bloquea SVG, GIF, texto y ejecutables aunque se declaren como imagen", () => {
    expect(inspectImage(SVG_BYTES)).toEqual({ ok: false, reason: "type" });
    expect(inspectImage(GIF_BYTES)).toEqual({ ok: false, reason: "type" });
    expect(inspectImage(new TextEncoder().encode("<html>hola</html>"))).toEqual({ ok: false, reason: "type" });
    expect(detectImageMime(new Uint8Array([0x4d, 0x5a, 0x90, 0]))).toBeUndefined(); // MZ (ejecutable)
  });

  it("rechaza imágenes por encima de 40 megapíxeles y las ilegibles", () => {
    expect(inspectImage(pngBytes(8000, 5000))).toEqual({ ok: true, image: { mime: "image/png", width: 8000, height: 5000 } }); // 40 MP exactos
    expect(inspectImage(pngBytes(8001, 5000))).toEqual({ ok: false, reason: "pixels" });
    expect(inspectImage(pngBytes(0, 10))).toEqual({ ok: false, reason: "unreadable" });
    expect(inspectImage(new Uint8Array([0xff, 0xd8, 0xff]))).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("Límites de cliente (respuesta rápida; el servidor decide)", () => {
  it("solo JPG, PNG y WEBP, hasta 10 MB, con el mensaje humano", () => {
    expect(validateImageMeta({ type: "image/jpeg", size: 1000 })).toBeUndefined();
    expect(validateImageMeta({ type: "image/svg+xml", size: 1000 })).toBe(mediaMessages.badType);
    expect(validateImageMeta({ type: "image/gif", size: 1000 })).toBe(mediaMessages.badType);
    expect(validateImageMeta({ type: "image/png", size: MEDIA_LIMITS.maxBytes })).toBeUndefined();
    expect(validateImageMeta({ type: "image/png", size: MEDIA_LIMITS.maxBytes + 1 })).toBe("La imagen supera el tamaño máximo permitido.");
    expect(validateImageMeta({ type: "image/png", size: 0 })).toBe(mediaMessages.empty);
  });

  it("el nombre del archivo es solo metadato: sin rutas, control ni marcado, longitud acotada", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\ana\\foto.jpg")).toBe("foto.jpg");
    expect(sanitizeFilename('<img src=x onerror="a">.png')).not.toMatch(/[<>"]/);
    expect(sanitizeFilename("")).toBe("imagen");
    expect(sanitizeFilename(`${"a".repeat(300)}.png`).length).toBeLessThanOrEqual(MEDIA_LIMITS.filenameMaxLength);
    expect(sanitizeFilename(`${"a".repeat(300)}.png`)).toMatch(/\.png$/);
  });
});
