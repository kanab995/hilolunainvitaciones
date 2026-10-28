/**
 * PDF de PRUEBA de la versión impresa (D-47) con la boda de demostración (Andrea & Fernando), usando EXACTAMENTE el generador de la
 * aplicación (`lib/print` + `server/print`). No lee la base de datos ni ningún servicio: sirve para revisar el arte y para llevar la
 * prueba física a la imprenta.
 *
 *   npm run print:sample -- <carpeta-de-salida>
 *
 * Escribe, por formato (5x7 y a5): `<formato>.pdf` (sangrado), `<formato>-marcas.pdf` (con marcas de corte) y la vista previa PNG de
 * cada cara (con marca de agua); y `prueba-impresa-carta.pdf`: frente y reverso 5×7" a tamaño real en hojas carta, el QR en cuatro
 * tamaños e instrucciones (para imprimir en casa y escanear con teléfonos reales). El QR apunta a la demostración pública
 * (`/i/demo-magnolia`), que existe en producción.
 *
 * Comparación del destino del QR (D-49), en `comparacion-qr/`: el mismo 5×7" con QR hacia la invitación, hacia la mesa de regalos
 * (`/i/demo-magnolia#regalos`) y sin QR, con la vista previa del reverso de cada uno.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { buildPrintData } from "@/lib/print/data";
import { PRINT_FORMATS, PT_PER_MM } from "@/lib/print/formats";
import { layoutRomanticElegant } from "@/lib/print/layout";
import { printQrAvailability, qrDestination, type PrintQrTarget } from "@/lib/print/qr-target";
import { PRINT_COLORS } from "@/lib/print/scene";
import { createQrMatrix } from "@/lib/share/qr";
import { fontkit } from "@/server/print/fontkit";
import { loadPrintFonts } from "@/server/print/fonts";
import { renderPrintPdf } from "@/server/print/pdf";
import { rasterizeSvg } from "@/server/print/raster";
import { renderPrintSvg } from "@/server/print/svg";

const DEMO_URL = "https://hiloluna.com/i/demo-magnolia";
const out = resolve(process.argv[2] ?? "print-sample");
mkdirSync(out, { recursive: true });
const fonts = await loadPrintFonts();
const availability = printQrAvailability(andreaFernandoInvitation, { expired: false });
const dataFor = (target: PrintQrTarget) => {
  const qr = qrDestination(target, availability, DEMO_URL);
  return buildPrintData(andreaFernandoInvitation, qr ? { qr } : {});
};
const data = dataFor("invitation");

for (const format of PRINT_FORMATS) {
  const scene = layoutRomanticElegant(data, { format, includeBack: true }, fonts.metrics);
  const options = { title: `Andrea & Fernando — Invitación ${format} (prueba, datos de demostración)`, label: `ANDREA & FERNANDO · ${format.toUpperCase()} · DEMOSTRACIÓN` };
  writeFileSync(join(out, `${format}.pdf`), await renderPrintPdf(scene, fonts, { ...options, cropMarks: false }));
  writeFileSync(join(out, `${format}-marcas.pdf`), await renderPrintPdf(scene, fonts, { ...options, cropMarks: true }));
  for (const page of scene.pages) {
    const png = await rasterizeSvg(renderPrintSvg(page, fonts, { watermark: true, pixelsPerPoint: 2.6 }));
    if (png) writeFileSync(join(out, `${format}-vista-previa-${page.kind}.png`), png);
  }
  console.log(`${format}: ${scene.pages.length} páginas${scene.warnings.length ? ` · avisos: ${scene.warnings.join(", ")}` : ""}`);
}

/* ───────── hoja de prueba carta (las tarjetas se incrustan como VECTORES desde el PDF final, no como imagen) ───────── */
const card = await PDFDocument.load(await renderPrintPdf(layoutRomanticElegant(data, { format: "5x7", includeBack: true }, fonts.metrics), fonts, { cropMarks: false, title: "prueba", label: "PRUEBA" }));
const sheet = await PDFDocument.create();
sheet.registerFontkit(fontkit);
sheet.setTitle("Hilo Luna — prueba impresa de QR y legibilidad (datos de demostración)");
const regular = await sheet.embedFont(fonts.bytes.serif, { subset: true, features: { lnum: true } });
const medium = await sheet.embedFont(fonts.bytes.caps, { subset: true, features: { lnum: true } });
const trimOf = (page: PDFPage) => {
  const box = page.getTrimBox();
  return { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height };
};
const [cardFront, cardBack] = card.getPages();
if (!cardFront || !cardBack) throw new Error("La tarjeta no tiene frente y reverso.");
const [front, back] = await sheet.embedPages([cardFront, cardBack], [trimOf(cardFront), trimOf(cardBack)]);
if (!front || !back) throw new Error("No se pudieron incrustar las tarjetas.");
const ink = rgb(0.2, 0.2, 0.2), grey = rgb(0.55, 0.55, 0.55);

function letter(embedded: NonNullable<typeof front>, title: string, steps: string[]) {
  const page = sheet.addPage([612, 792]);
  const x = 54, y = 792 - 64 - 360;
  page.drawText(title, { x, y: 792 - 44, size: 14, font: medium, color: ink });
  page.drawPage(embedded, { x, y, width: 504, height: 360 });
  for (const [x1, y1, x2, y2] of [[x - 14, y, x - 4, y], [x - 14, y + 360, x - 4, y + 360], [x + 508, y, x + 518, y], [x + 508, y + 360, x + 518, y + 360], [x, y - 14, x, y - 4], [x + 504, y - 14, x + 504, y - 4], [x, y + 364, x, y + 374], [x + 504, y + 364, x + 504, y + 374]] as const)
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, color: grey });
  let ty = y - 34;
  for (const line of steps) {
    const font: PDFFont = line.startsWith("·") ? regular : medium;
    if (x + font.widthOfTextAtSize(line, 10.5) > 558) throw new Error(`Línea demasiado larga: ${line}`);
    page.drawText(line, { x, y: ty, size: 10.5, font, color: ink });
    ty -= 15;
  }
  return { page, ty };
}

const first = letter(back, "Prueba impresa 1/2 · Reverso 5×7\" a tamaño real · datos de demostración", [
  "Cómo imprimir",
  "· Al 100 % («Tamaño real»), sin «Ajustar a la página». Con una regla: el corte mide 177,8 × 127 mm.",
  "Cómo probar el QR (cámara normal del teléfono, sin app)",
  "· iPhone y Android, a 15, 25 y 40 cm; de frente y con la hoja inclinada; con luz de interior cálida.",
  "· Debe abrir hiloluna.com/i/demo-magnolia. Anota cualquier tamaño de abajo que tarde o no se lea.",
]);
const matrix = createQrMatrix(DEMO_URL);
let qx = 54;
for (const mm of [25.4, 20, 16, 12]) {
  const size = mm * PT_PER_MM, m = size / matrix.size, qy = first.ty - 14 - size;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(PRINT_COLORS.qr.slice(i, i + 2), 16) / 255) as [number, number, number];
  matrix.rows.forEach((row, ri) => row.forEach((dark, ci) => dark && first.page.drawRectangle({ x: qx + ci * m, y: qy + (matrix.size - 1 - ri) * m, width: m + 0.02, height: m + 0.02, color: rgb(r, g, b) })));
  first.page.drawText(`${String(mm).replace(".", ",")} mm${mm === 25.4 ? " (el de la invitación)" : ""}`, { x: qx, y: qy - 13, size: 9, font: regular, color: ink });
  qx += size + 54;
}
letter(front, "Prueba impresa 2/2 · Frente 5×7\" a tamaño real · datos de demostración", [
  "Qué revisar a tamaño real",
  "· Que se lean sin esfuerzo la ciudad (8 pt) y «17:00 horas» (8,5 pt).",
  "· Que la frase dorada y el monograma pequeño no se vean cortados ni demasiado claros.",
  "· Una impresora de casa NO reproduce el color de la imprenta: aquí se validan tamaños y QR,",
  "· no el tono exacto del dorado (eso se valida con el PDF 5x7 en la imprenta).",
]);
writeFileSync(join(out, "prueba-impresa-carta.pdf"), await sheet.save());

/* ───────── comparación del destino del QR (D-49) ───────── */
const compare = join(out, "comparacion-qr");
mkdirSync(compare, { recursive: true });
const variants: Array<[PrintQrTarget, string, string]> = [
  ["invitation", "qr-invitacion-digital", "QR A LA INVITACIÓN"],
  ["gifts", "qr-mesa-de-regalos", "QR A LA MESA DE REGALOS"],
  ["none", "sin-qr", "SIN QR"],
];
for (const [target, slug, label] of variants) {
  const variant = dataFor(target);
  const scene = layoutRomanticElegant(variant, { format: "5x7", includeBack: true }, fonts.metrics);
  writeFileSync(join(compare, `5x7-${slug}.pdf`), await renderPrintPdf(scene, fonts, { cropMarks: false, title: `Andrea & Fernando — Invitación 5x7 · ${label.toLowerCase()} (demostración)`, label: `ANDREA & FERNANDO · 5×7 · ${label}` }));
  const backPage = scene.pages.find((page) => page.kind === "back");
  const png = backPage ? await rasterizeSvg(renderPrintSvg(backPage, fonts, { watermark: true, pixelsPerPoint: 2.6 })) : undefined;
  if (png) writeFileSync(join(compare, `5x7-${slug}-reverso.png`), png);
  console.log(`${slug}: ${variant.qr ? variant.qr.url : "sin QR"}${scene.warnings.length ? ` · avisos: ${scene.warnings.join(", ")}` : ""}`);
}
console.log(`listo → ${out}`);
