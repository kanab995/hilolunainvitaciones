import { ADDONS, canDownloadPrintFile } from "@/lib/billing/addons";
import { buildPrintData, detectedPlace, initialsFromNames, isPrintableEventType, type PrintData } from "@/lib/print/data";
import { PRINT_FORMAT_SPECS } from "@/lib/print/formats";
import { layoutRomanticElegant } from "@/lib/print/layout";
import { DEFAULT_PRINT_OPTIONS, type PreviewSide, type PrintOptions } from "@/lib/print/options";
import { printCopy } from "@/lib/print/copy";
import { giftRegistryPublicUrl, isPrintQrTarget, isQrTargetAvailable, printQrAvailability, qrDestination, type PrintQrAvailability, type PrintQrTarget } from "@/lib/print/qr-target";
import type { PrintScene, PrintWarning } from "@/lib/print/scene";
import { getPublicInvitationUrl } from "@/lib/site-url";
import { isCurrentUserAdmin } from "@/server/auth/admin";
import { StoreUnavailableError } from "@/server/db/errors";
import { logger } from "@/server/observability/logger";
import { loadPrintFonts, type PrintFontSet } from "@/server/print/fonts";
import { renderPrintPdf } from "@/server/print/pdf";
import { rasterizeSvg } from "@/server/print/raster";
import { renderPrintSvg } from "@/server/print/svg";
import { findOwnedPrintQrTarget, saveOwnedPrintQrTarget } from "@/server/repositories/print-settings";
import { loadOwnedPublication, type OwnedPublication } from "@/server/repositories/publishing";
import { getPrintAddonState, hasPaidPrintAddon, type PrintAddonState } from "@/server/services/addon-service";
import type { AppUser } from "@/server/services/user-sync";

/**
 * VERSIÓN PARA IMPRIMIR (D-47, Etapa 2). Reglas:
 *  - Los datos salen de la invitación PUBLICADA del evento del usuario (propiedad en la consulta); un borrador no se imprime.
 *  - El QR (D-49) apunta a la invitación pública GENERAL, a su sección de regalos (`#regalos`) o, si la mesa publicada tiene una sola tienda
 *    con un enlace seguro, directamente a ella; o no hay QR. Nunca a una ruta privada ni a un enlace personalizado de invitado. Los dos
 *    primeros exigen la invitación publicada y vigente (un QR impreso hacia una invitación caducada no sirve). Un destino elegido que ya no
 *    está disponible NO se sustituye: ni vista previa del reverso ni PDF hasta que el anfitrión elija otro (`qr_unavailable`). Todo sale de la
 *    publicación de ESE evento del usuario.
 *  - La VISTA PREVIA es libre (imagen con marca de agua). El PDF limpio exige `canDownloadPrintFile`: el complemento PAGADO de ESTE evento
 *    del usuario (D-48; descargas ilimitadas desde la versión publicada vigente; un reembolso la retira) o la prueba interna de una cuenta
 *    ADMIN de SUS eventos. Un no autorizado recibe lo mismo que un evento inexistente.
 *  - El diseño aprobado es de boda: otros tipos de evento esperan su texto (`isPrintableEventType`).
 */
export interface PrintDeps {
  loadPublication: (userId: string, eventId: string) => Promise<OwnedPublication | undefined>;
  loadFonts: () => Promise<PrintFontSet>;
  /** Estado del complemento del evento DEL usuario (plan, elegibilidad, venta abierta, compra, vigencia del QR). */
  getAddonState: (userId: string, eventId: string) => Promise<PrintAddonState | undefined>;
  /** ¿El complemento de este evento DEL usuario está pagado? */
  hasPaidAddon: (userId: string, eventId: string) => Promise<boolean>;
  isAdmin: () => Promise<boolean>;
  publicUrl: (slug: string) => string;
  /** Destino del QR guardado para el evento DEL usuario (`PrintSettings`); `undefined` si no es suyo. */
  getQrTarget: (userId: string, eventId: string) => Promise<PrintQrTarget | undefined>;
  /** Guarda el destino del QR del evento DEL usuario; `false` si no es suyo. */
  saveQrTarget: (userId: string, eventId: string, target: PrintQrTarget) => Promise<boolean>;
  /** SVG → PNG; `undefined` si no hay rasterizador disponible (entonces NO hay vista previa: nunca se sirve el SVG vectorial). */
  rasterize: (svg: string) => Promise<Uint8Array | undefined>;
}

const defaultDeps: PrintDeps = {
  loadPublication: loadOwnedPublication,
  loadFonts: () => loadPrintFonts(),
  getAddonState: (userId, eventId) => getPrintAddonState({ id: userId }, eventId),
  hasPaidAddon: (userId, eventId) => hasPaidPrintAddon(userId, eventId),
  isAdmin: isCurrentUserAdmin,
  publicUrl: getPublicInvitationUrl,
  getQrTarget: findOwnedPrintQrTarget,
  saveQrTarget: saveOwnedPrintQrTarget,
  rasterize: rasterizeSvg,
};

/** Lo que la página necesita para el selector del destino del QR. */
export interface PrintQrView {
  /** Elección guardada (o la predeterminada, invitación). */
  selected: PrintQrTarget;
  /** La elección guardada ya no está disponible (p. ej. se quitó la mesa de regalos): la página lo avisa y no deja descargar hasta elegir otra. */
  needsChoice: boolean;
  availability: PrintQrAvailability;
  /** URL pública de la invitación y de su sección de regalos (para mostrar el destino); `null` sin invitación vigente. */
  invitationUrl: string | null;
  giftsUrl: string | null;
  /** Hasta cuándo funciona un QR que depende de la invitación (fin del acceso del evento). */
  validUntil: Date | null;
}

export type PrintPageView =
  | { status: "not_found" }
  | { status: "draft" }
  | { status: "unsupported" }
  | {
      status: "ready";
      /** Versión publicada de la que salen los datos (sin ella: datos anteriores a D-29). */
      publicationVersion?: number;
      qr: PrintQrView;
      defaultInitials: string;
      /** Ciudad y estado leídos de la dirección de la ceremonia («» si no se pudo leer con seguridad). */
      defaultPlace: string;
      /** Compra del complemento: plan del evento, elegibilidad, si la venta está abierta, si ya se pagó y hasta cuándo funciona el QR. */
      addon: PrintAddonState;
      /** Descarga del PDF limpio: `purchase` (complemento pagado), `internal` (prueba de ADMIN, sin compra) o `none`. */
      download: "purchase" | "internal" | "none";
      price: number;
      /** Avisos de composición con las opciones por defecto (texto ajustado, espacios comprimidos…). */
      warnings: readonly PrintWarning[];
    };

export async function getPrintPageView(user: AppUser, eventId: string, deps: PrintDeps = defaultDeps): Promise<PrintPageView> {
  const source = await deps.loadPublication(user.id, eventId);
  if (!source) return { status: "not_found" };
  if (source.state === "draft") return { status: "draft" };
  if (!isPrintableEventType(source.invitation.eventType)) return { status: "unsupported" };
  const addon = (await deps.getAddonState(user.id, eventId)) ?? { plan: "FREE", eligible: false, saleOpen: false, purchased: false, paidAt: null, pendingPayment: false, qrValidUntil: null };
  const fonts = await deps.loadFonts();
  const availability = printQrAvailability(source.invitation, { expired: source.expired });
  const saved = (await deps.getQrTarget(user.id, eventId)) ?? DEFAULT_PRINT_OPTIONS.qr;
  const needsChoice = !isQrTargetAvailable(saved, availability);
  const invitationUrl = availability.invitation ? deps.publicUrl(source.slug) : null;
  const qr = qrDestination(saved, availability, deps.publicUrl(source.slug));
  const data = buildPrintData(source.invitation, qr ? { qr } : {});
  const scene = layoutRomanticElegant(data, { format: DEFAULT_PRINT_OPTIONS.format, includeBack: true }, fonts.metrics);
  return {
    status: "ready",
    ...(source.publication ? { publicationVersion: source.publication.version } : {}),
    qr: { selected: saved, needsChoice, availability, invitationUrl, giftsUrl: invitationUrl && availability.gifts ? giftRegistryPublicUrl(invitationUrl) : null, validUntil: addon.qrValidUntil },
    defaultInitials: initialsFromNames(source.invitation.names).join(""),
    defaultPlace: detectedPlace(source.invitation) ?? "",
    addon,
    download: addon.purchased ? "purchase" : (await deps.isAdmin()) ? "internal" : "none",
    price: ADDONS.PRINT_FILE.displayPrice,
    warnings: scene.warnings,
  };
}

/** `qr_unavailable`: el destino del QR pedido ya no existe en la invitación publicada; hay que elegir otro (nunca se cambia en silencio). */
export type PrintFailure = { ok: false; reason: "not_found" | "qr_unavailable" };

type Built = { ok: true; scene: PrintScene; data: PrintData; source: Extract<OwnedPublication, { state: "published" }>; fonts: PrintFontSet } | PrintFailure;

async function build(user: AppUser, eventId: string, options: PrintOptions, deps: PrintDeps): Promise<Built> {
  const source = await deps.loadPublication(user.id, eventId);
  if (!source || source.state !== "published" || !isPrintableEventType(source.invitation.eventType)) return { ok: false, reason: "not_found" };
  // Sin reverso no hay QR. Con reverso, el destino pedido debe existir en la invitación PUBLICADA de este evento: si no, no se genera nada.
  const availability = printQrAvailability(source.invitation, { expired: source.expired });
  if (options.includeBack && !isQrTargetAvailable(options.qr, availability)) return { ok: false, reason: "qr_unavailable" };
  const qr = options.includeBack ? qrDestination(options.qr, availability, deps.publicUrl(source.slug)) : undefined;
  const data = buildPrintData(source.invitation, { ...(qr ? { qr } : {}), ...(options.initials ? { initials: options.initials } : {}), ...(options.place !== undefined ? { place: options.place } : {}) });
  const fonts = await deps.loadFonts();
  const scene = layoutRomanticElegant(data, { format: options.format, includeBack: options.includeBack }, fonts.metrics);
  return { ok: true, scene, data, source, fonts };
}

export type PrintPreviewResult = { ok: true; body: Uint8Array; contentType: "image/png"; warnings: readonly PrintWarning[] } | PrintFailure;

/** Píxeles por punto de la vista previa: ≈ 1300 px de ancho para 5×7" (nítida en pantalla, insuficiente para imprimir). */
const PREVIEW_PX_PER_PT = 2.6;

export async function getPrintPreview(user: AppUser, eventId: string, options: PrintOptions, side: PreviewSide, deps: PrintDeps = defaultDeps): Promise<PrintPreviewResult> {
  const built = await build(user, eventId, options, deps);
  if (!built.ok) return built;
  const page = built.scene.pages.find((candidate) => candidate.kind === side);
  if (!page) return { ok: false, reason: "not_found" };
  const svg = renderPrintSvg(page, built.fonts, { watermark: true, pixelsPerPoint: PREVIEW_PX_PER_PT });
  // Solo una IMAGEN rasterizada con la marca de agua «quemada»: un SVG sería arte vectorial al que basta borrarle la marca de agua
  // para tener el diseño limpio. Sin rasterizador no hay vista previa (404), nunca un atajo hacia el arte.
  const png = await deps.rasterize(svg);
  return png ? { ok: true, body: png, contentType: "image/png", warnings: built.scene.warnings } : { ok: false, reason: "not_found" };
}

export type PrintFileResult = { ok: true; bytes: Uint8Array; filename: string } | PrintFailure;

export async function getPrintFile(user: AppUser, eventId: string, options: PrintOptions, deps: PrintDeps = defaultDeps): Promise<PrintFileResult> {
  // Primero la autorización (barata), después la generación. La compra se busca con el usuario en la consulta (evento propio).
  const purchased = await deps.hasPaidAddon(user.id, eventId);
  if (!canDownloadPrintFile({ purchased, isAdmin: purchased ? false : await deps.isAdmin() })) return { ok: false, reason: "not_found" };
  const built = await build(user, eventId, options, deps);
  if (!built.ok) {
    if (built.reason === "qr_unavailable") logger.warn("print.qr_target_unavailable", { eventId, target: options.qr });
    return built;
  }
  const spec = PRINT_FORMAT_SPECS[options.format];
  const names = built.data.names.join(" & ");
  const bytes = await renderPrintPdf(built.scene, built.fonts, {
    cropMarks: options.cropMarks,
    title: `${names || built.source.title} — Invitación ${spec.label}`,
    label: `${names.toLocaleUpperCase("es-MX")} · ${spec.label}`,
  });
  logger.info("print.file.generated", { eventId, format: options.format, back: options.includeBack, qr: built.data.qr?.kind ?? "none", marks: options.cropMarks, pages: built.scene.pages.length, bytes: bytes.length, internal: !purchased });
  return { ok: true, bytes, filename: `invitacion-${built.source.slug}-${options.format}${options.cropMarks ? "-marcas" : ""}.pdf` };
}

export type SaveQrTargetCode = "invalid" | "not_found" | "unavailable" | "store";
export type SaveQrTargetResult = { ok: true; target: PrintQrTarget } | { ok: false; code: SaveQrTargetCode; message: string };

const EVENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Guarda el destino del QR elegido en «Versión para imprimir» (`PrintSettings`). El navegador solo envía el id del evento y el destino; el
 * servidor comprueba que el evento es del usuario y que ESE destino está disponible en su invitación publicada (no se guarda «Mesa de regalos»
 * sin mesa publicada). No cambia la invitación, la compra ni el precio.
 */
export async function savePrintQrTarget(user: AppUser, rawEventId: unknown, rawTarget: unknown, deps: PrintDeps = defaultDeps): Promise<SaveQrTargetResult> {
  const messages = printCopy.page.qr.save;
  if (typeof rawEventId !== "string" || !EVENT_ID.test(rawEventId) || !isPrintQrTarget(rawTarget)) return { ok: false, code: "invalid", message: messages.invalid };
  try {
    const source = await deps.loadPublication(user.id, rawEventId);
    if (!source) return { ok: false, code: "not_found", message: messages.notFound };
    if (source.state !== "published") return { ok: false, code: "unavailable", message: messages.unavailable[rawTarget] };
    if (!isQrTargetAvailable(rawTarget, printQrAvailability(source.invitation, { expired: source.expired }))) return { ok: false, code: "unavailable", message: messages.unavailable[rawTarget] };
    if (!(await deps.saveQrTarget(user.id, rawEventId, rawTarget))) return { ok: false, code: "not_found", message: messages.notFound };
    logger.info("print.qr_target_saved", { eventId: rawEventId, target: rawTarget });
    return { ok: true, target: rawTarget };
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { ok: false, code: "store", message: messages.store };
    logger.error("print.qr_target_save_failed", error, { eventId: rawEventId });
    return { ok: false, code: "store", message: messages.store };
  }
}
