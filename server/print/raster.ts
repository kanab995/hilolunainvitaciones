/**
 * Rasterizado de la VISTA PREVIA (D-47): SVG → PNG con `sharp` (el que ya trae Next.js, cargado bajo demanda como en
 * `server/media/normalize.ts`). Una imagen con marca de agua y ≈ 190 ppp no sirve como arte de imprenta, a diferencia de un SVG vectorial
 * que se podría limpiar. Sin `sharp` devuelve `undefined` y NO hay vista previa (el servicio responde 404; nunca sirve el SVG).
 */
interface SharpSvg {
  (input: Uint8Array): { png(options?: Record<string, unknown>): { toBuffer(): Promise<Uint8Array> } };
}

let loader: Promise<SharpSvg | undefined> | undefined;

function loadSharp(): Promise<SharpSvg | undefined> {
  loader ??= import("sharp").then(
    (module) => (module.default ?? module) as unknown as SharpSvg,
    () => undefined,
  );
  return loader;
}

export async function rasterizeSvg(svg: string): Promise<Uint8Array | undefined> {
  const sharp = await loadSharp();
  if (!sharp) return undefined;
  try {
    return new Uint8Array(await sharp(new TextEncoder().encode(svg)).png({ compressionLevel: 9, palette: false }).toBuffer());
  } catch {
    return undefined;
  }
}
