import { parseInitials } from "@/lib/print/data";
import { DEFAULT_PRINT_FORMAT, isPrintFormat, type PrintFormat } from "@/lib/print/formats";
import { cleanPlaceInput } from "@/lib/print/place";

/**
 * OPCIONES de la versión impresa (D-47), leídas de la URL de la vista previa y de la descarga. Todo lo que llega del navegador se
 * valida aquí; un valor desconocido vuelve al de por defecto (nunca rompe la generación).
 */
export interface PrintOptions {
  format: PrintFormat;
  includeBack: boolean;
  /** Solo se respeta si hay una invitación publicada y vigente (lo decide el servicio). */
  includeQr: boolean;
  cropMarks: boolean;
  /** Iniciales personalizadas del monograma; sin ellas, las de los nombres. */
  initials?: readonly string[];
  /** Ciudad y estado confirmados por el anfitrión (texto plano, ≤ 60). Ausente = lo que se lee de la dirección; vacío = sin esa línea. */
  place?: string;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = { format: DEFAULT_PRINT_FORMAT, includeBack: true, includeQr: true, cropMarks: false };

export const PREVIEW_SIDES = ["front", "back", "envelope"] as const;
export type PreviewSide = (typeof PREVIEW_SIDES)[number];
export const isPreviewSide = (value: unknown): value is PreviewSide => typeof value === "string" && (PREVIEW_SIDES as readonly string[]).includes(value);

type Params = Pick<URLSearchParams, "get">;

const flag = (value: string | null, fallback: boolean) => (value === "1" ? true : value === "0" ? false : fallback);

export function parsePrintOptions(params: Params): PrintOptions {
  const format = params.get("format");
  const initials = parseInitials(params.get("initials") ?? "");
  return {
    format: isPrintFormat(format) ? format : DEFAULT_PRINT_OPTIONS.format,
    includeBack: flag(params.get("back"), DEFAULT_PRINT_OPTIONS.includeBack),
    includeQr: flag(params.get("qr"), DEFAULT_PRINT_OPTIONS.includeQr),
    cropMarks: flag(params.get("marks"), DEFAULT_PRINT_OPTIONS.cropMarks),
    ...(initials ? { initials } : {}),
    ...(params.get("place") !== null ? { place: cleanPlaceInput(params.get("place") ?? "") } : {}),
  };
}

/** Query string de unas opciones (para las URLs de vista previa y descarga). */
export function printOptionsQuery(options: PrintOptions, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({ ...extra, format: options.format, back: options.includeBack ? "1" : "0", qr: options.includeQr ? "1" : "0", marks: options.cropMarks ? "1" : "0" });
  if (options.initials?.length) query.set("initials", options.initials.join(""));
  if (options.place !== undefined) query.set("place", options.place);
  return query.toString();
}
