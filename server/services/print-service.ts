import { ADDONS, canDownloadPrintFile, isAddonEligiblePlan } from "@/lib/billing/addons";
import type { PlanId } from "@/lib/billing/plans";
import { buildPrintData, detectedPlace, initialsFromNames, isPrintableEventType, type PrintData } from "@/lib/print/data";
import { PRINT_FORMAT_SPECS } from "@/lib/print/formats";
import { layoutRomanticElegant } from "@/lib/print/layout";
import { DEFAULT_PRINT_OPTIONS, type PreviewSide, type PrintOptions } from "@/lib/print/options";
import type { PrintScene, PrintWarning } from "@/lib/print/scene";
import { getPublicInvitationUrl } from "@/lib/site-url";
import { isCurrentUserAdmin } from "@/server/auth/admin";
import { logger } from "@/server/observability/logger";
import { loadPrintFonts, type PrintFontSet } from "@/server/print/fonts";
import { renderPrintPdf } from "@/server/print/pdf";
import { rasterizeSvg } from "@/server/print/raster";
import { renderPrintSvg } from "@/server/print/svg";
import { loadOwnedPublication, type OwnedPublication } from "@/server/repositories/publishing";
import { getEventPlan } from "@/server/services/entitlement-service";
import type { AppUser } from "@/server/services/user-sync";

/**
 * VERSIÓN PARA IMPRIMIR (D-47, Etapa 2). Reglas:
 *  - Los datos salen de la invitación PUBLICADA del evento del usuario (propiedad en la consulta); un borrador no se imprime.
 *  - El QR solo se incluye si la invitación está publicada y su acceso sigue vigente (un QR impreso hacia una invitación caducada no
 *    sirve), y siempre apunta a la URL pública GENERAL (nunca a un enlace personalizado de invitado).
 *  - La VISTA PREVIA es libre (imagen con marca de agua). El PDF limpio exige `canDownloadPrintFile`: con la compra apagada, solo una
 *    cuenta ADMIN y solo de SUS eventos (prueba interna). Un no autorizado recibe lo mismo que un evento inexistente.
 *  - El diseño aprobado es de boda: otros tipos de evento esperan su texto (`isPrintableEventType`).
 */
export interface PrintDeps {
  loadPublication: (userId: string, eventId: string) => Promise<OwnedPublication | undefined>;
  loadFonts: () => Promise<PrintFontSet>;
  getPlan: (eventId: string) => Promise<PlanId>;
  isAdmin: () => Promise<boolean>;
  publicUrl: (slug: string) => string;
  /** SVG → PNG; `undefined` si no hay rasterizador disponible (entonces NO hay vista previa: nunca se sirve el SVG vectorial). */
  rasterize: (svg: string) => Promise<Uint8Array | undefined>;
}

const defaultDeps: PrintDeps = {
  loadPublication: loadOwnedPublication,
  loadFonts: () => loadPrintFonts(),
  getPlan: (eventId) => getEventPlan(eventId),
  isAdmin: isCurrentUserAdmin,
  publicUrl: getPublicInvitationUrl,
  rasterize: rasterizeSvg,
};

export type PrintPageView =
  | { status: "not_found" }
  | { status: "draft" }
  | { status: "unsupported" }
  | {
      status: "ready";
      /** Versión publicada de la que salen los datos (sin ella: datos anteriores a D-29). */
      publicationVersion?: number;
      qrAvailable: boolean;
      defaultInitials: string;
      /** Ciudad y estado leídos de la dirección de la ceremonia («» si no se pudo leer con seguridad). */
      defaultPlace: string;
      plan: PlanId;
      /** ¿El plan del evento permite el complemento? (Esencial y Premium). */
      eligible: boolean;
      purchasable: boolean;
      canDownload: boolean;
      price: number;
      /** Avisos de composición con las opciones por defecto (texto ajustado, espacios comprimidos…). */
      warnings: readonly PrintWarning[];
    };

export async function getPrintPageView(user: AppUser, eventId: string, deps: PrintDeps = defaultDeps): Promise<PrintPageView> {
  const source = await deps.loadPublication(user.id, eventId);
  if (!source) return { status: "not_found" };
  if (source.state === "draft") return { status: "draft" };
  if (!isPrintableEventType(source.invitation.eventType)) return { status: "unsupported" };
  const plan = await deps.getPlan(eventId);
  const fonts = await deps.loadFonts();
  const data = buildPrintData(source.invitation, source.expired ? {} : { publicUrl: deps.publicUrl(source.slug) });
  const scene = layoutRomanticElegant(data, { format: DEFAULT_PRINT_OPTIONS.format, includeBack: true }, fonts.metrics);
  return {
    status: "ready",
    ...(source.publication ? { publicationVersion: source.publication.version } : {}),
    qrAvailable: !source.expired,
    defaultInitials: initialsFromNames(source.invitation.names).join(""),
    defaultPlace: detectedPlace(source.invitation) ?? "",
    plan,
    eligible: isAddonEligiblePlan("PRINT_FILE", plan),
    purchasable: ADDONS.PRINT_FILE.purchasable,
    canDownload: canDownloadPrintFile({ purchased: false, isAdmin: await deps.isAdmin() }),
    price: ADDONS.PRINT_FILE.displayPrice,
    warnings: scene.warnings,
  };
}

type Built = { ok: true; scene: PrintScene; data: PrintData; source: Extract<OwnedPublication, { state: "published" }>; fonts: PrintFontSet } | { ok: false };

async function build(user: AppUser, eventId: string, options: PrintOptions, deps: PrintDeps): Promise<Built> {
  const source = await deps.loadPublication(user.id, eventId);
  if (!source || source.state !== "published" || !isPrintableEventType(source.invitation.eventType)) return { ok: false };
  const withQr = options.includeQr && options.includeBack && !source.expired;
  const data = buildPrintData(source.invitation, { ...(withQr ? { publicUrl: deps.publicUrl(source.slug) } : {}), ...(options.initials ? { initials: options.initials } : {}), ...(options.place !== undefined ? { place: options.place } : {}) });
  const fonts = await deps.loadFonts();
  const scene = layoutRomanticElegant(data, { format: options.format, includeBack: options.includeBack }, fonts.metrics);
  return { ok: true, scene, data, source, fonts };
}

export type PrintPreviewResult = { ok: true; body: Uint8Array; contentType: "image/png"; warnings: readonly PrintWarning[] } | { ok: false };

/** Píxeles por punto de la vista previa: ≈ 1300 px de ancho para 5×7" (nítida en pantalla, insuficiente para imprimir). */
const PREVIEW_PX_PER_PT = 2.6;

export async function getPrintPreview(user: AppUser, eventId: string, options: PrintOptions, side: PreviewSide, deps: PrintDeps = defaultDeps): Promise<PrintPreviewResult> {
  const built = await build(user, eventId, options, deps);
  if (!built.ok) return { ok: false };
  const page = built.scene.pages.find((candidate) => candidate.kind === side);
  if (!page) return { ok: false };
  const svg = renderPrintSvg(page, built.fonts, { watermark: true, pixelsPerPoint: PREVIEW_PX_PER_PT });
  // Solo una IMAGEN rasterizada con la marca de agua «quemada»: un SVG sería arte vectorial al que basta borrarle la marca de agua
  // para tener el diseño limpio. Sin rasterizador no hay vista previa (404), nunca un atajo hacia el arte.
  const png = await deps.rasterize(svg);
  return png ? { ok: true, body: png, contentType: "image/png", warnings: built.scene.warnings } : { ok: false };
}

export type PrintFileResult = { ok: true; bytes: Uint8Array; filename: string } | { ok: false };

export async function getPrintFile(user: AppUser, eventId: string, options: PrintOptions, deps: PrintDeps = defaultDeps): Promise<PrintFileResult> {
  // Primero la autorización (barata), después la generación.
  if (!canDownloadPrintFile({ purchased: false, isAdmin: await deps.isAdmin() })) return { ok: false };
  const built = await build(user, eventId, options, deps);
  if (!built.ok) return { ok: false };
  const spec = PRINT_FORMAT_SPECS[options.format];
  const names = built.data.names.join(" & ");
  const bytes = await renderPrintPdf(built.scene, built.fonts, {
    cropMarks: options.cropMarks,
    title: `${names || built.source.title} — Invitación ${spec.label}`,
    label: `${names.toLocaleUpperCase("es-MX")} · ${spec.label}`,
  });
  logger.info("print.file.generated", { eventId, format: options.format, back: options.includeBack, marks: options.cropMarks, pages: built.scene.pages.length, bytes: bytes.length, internal: true });
  return { ok: true, bytes, filename: `invitacion-${built.source.slug}-${options.format}${options.cropMarks ? "-marcas" : ""}.pdf` };
}
