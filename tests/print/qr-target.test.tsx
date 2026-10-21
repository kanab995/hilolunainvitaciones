import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, PDFRef } from "pdf-lib";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PrintStudio } from "@/components/print/print-studio";
import { QrTargetPicker } from "@/components/print/qr-target-picker";
import { GIFT_REGISTRY_ANCHOR } from "@/lib/invitation/anchors";
import { printCopy } from "@/lib/print/copy";
import { buildPrintData } from "@/lib/print/data";
import { layoutRomanticElegant } from "@/lib/print/layout";
import { DEFAULT_PRINT_OPTIONS, parsePrintOptions, printOptionsQuery, type PrintOptions } from "@/lib/print/options";
import { isQrTargetAvailable, MAX_STORE_QR_URL_LENGTH, printQrAvailability, qrDestination, safeStoreUrl, type PrintQrTarget } from "@/lib/print/qr-target";
import type { PrintScene, SceneQr, SceneText } from "@/lib/print/scene";
import { createQrMatrix } from "@/lib/share/qr";
import { loadPrintFonts, type PrintFontSet } from "@/server/print/fonts";
import { renderPrintSvg } from "@/server/print/svg";
import type { OwnedPublication } from "@/server/repositories/publishing";
import type { PrintAddonState } from "@/server/services/addon-service";
import { getPrintFile, getPrintPageView, getPrintPreview, savePrintQrTarget, type PrintDeps } from "@/server/services/print-service";
import type { Invitation } from "@/types/invitation";
import { demo } from "./fixtures";

/**
 * DESTINO DEL QR de la versión impresa (D-49): invitación, mesa de regalos, enlace directo a la única tienda o sin QR. Se comprueba que cada
 * QR codifica el destino correcto (en la escena, en la vista previa y reconstruyendo la matriz desde el PDF), que los datos de la mesa salen
 * solo de la invitación publicada de ESE evento y que la elección se guarda solo si el destino existe.
 */
vi.mock("@/app/(site)/dashboard/(workspace)/events/[id]/print/actions", () => ({ savePrintQrTargetAction: vi.fn() }));

const ROOT = process.cwd();
const URL_A = "https://hiloluna.com/i/andrea-y-fernando";

let fonts: PrintFontSet;
beforeAll(async () => {
  fonts = await loadPrintFonts();
});

/** La boda de demostración con otra mesa de regalos (o sin ella). */
function withGifts(gifts: Invitation["giftRegistry"], visible = true): Invitation {
  return { ...demo, giftRegistry: gifts, sections: demo.sections.map((section) => (section.type === "giftRegistry" ? { ...section, isVisible: visible } : section)) };
}
const oneStore = (url: string, name = "Liverpool") => withGifts({ message: "", entries: [{ id: "g1", name, url }] });

/** Escena con un destino DISPONIBLE (los no disponibles no se generan: ver «sin cambios silenciosos»). */
const sceneFor = (invitation: Invitation, target: PrintQrTarget, expired = false): PrintScene => {
  const availability = printQrAvailability(invitation, { expired });
  const qr = qrDestination(target, availability, URL_A);
  return layoutRomanticElegant(buildPrintData(invitation, qr ? { qr } : {}), { format: "5x7", includeBack: true }, fonts.metrics);
};
const backItems = (scene: PrintScene) => scene.pages.find((page) => page.kind === "back")?.items ?? [];
const qrOf = (scene: PrintScene) => backItems(scene).find((item): item is SceneQr => item.kind === "qr");
const backTexts = (scene: PrintScene) => backItems(scene).filter((item): item is SceneText => item.kind === "text").map((item) => item.text);

/** Reconstruye la matriz del QR desde los rectángulos vectoriales del reverso del PDF (los dibuja `server/print/pdf.ts`). */
async function qrRowsFromPdf(bytes: Uint8Array): Promise<boolean[][] | undefined> {
  const doc = await PDFDocument.load(bytes);
  const back = doc.getPages()[1];
  if (!back) return undefined;
  const contents = back.node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  let ops = "";
  for (const ref of refs) {
    const stream = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
    if (stream instanceof PDFRawStream) ops += new TextDecoder().decode(decodePDFRawStream(stream).decode());
  }
  // Color del QR (#24201C) → rectángulo trasladado con `cm` y su ancho/alto en los `l`.
  const runs = [...ops.matchAll(/0\.1411764705882353 0\.12549019607843137 0\.10980392156862745 rg\n[\s\S]*?1 0 0 1 ([\d.]+) ([\d.]+) cm\n[\s\S]*?0 ([\d.]+) l\n([\d.]+) [\d.]+ l/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]), h: Number(match[3]), w: Number(match[4]) }));
  if (runs.length === 0) return undefined;
  const m = (runs[0]?.h ?? 0) - 0.02;
  const minX = Math.min(...runs.map((run) => run.x)), minY = Math.min(...runs.map((run) => run.y));
  const n = Math.round((Math.max(...runs.map((run) => run.x + run.w - 0.02)) - minX) / m);
  const rows = Array.from({ length: n }, () => Array.from({ length: n }, () => false));
  for (const run of runs) {
    const col = Math.round((run.x - minX) / m), row = n - 1 - Math.round((run.y - minY) / m), length = Math.round((run.w - 0.02) / m);
    for (let index = 0; index < length; index++) (rows[row] as boolean[])[col + index] = true;
  }
  return rows;
}

describe("enlaces externos de tienda (validación segura)", () => {
  it("solo https, sin credenciales ni puerto, con dominio público y longitud acotada", () => {
    expect(safeStoreUrl(" https://mesaderegalos.liverpool.com.mx/milistaderegalo/51234567 ")).toMatchObject({ ok: true, host: "mesaderegalos.liverpool.com.mx" });
    expect(safeStoreUrl("https://www.amazon.com.mx/wedding/share/abc")).toMatchObject({ ok: true, host: "amazon.com.mx" });
    expect(safeStoreUrl("http://tienda.com/lista")).toEqual({ ok: false, reason: "insecure" });
    for (const bad of ["javascript:alert(1)", "data:text/html,hola", "https://user:pass@tienda.com/", "https://tienda.com:8443/x", "https://127.0.0.1/x", "https://[::1]/x", "https://localhost/x", "https://router.local/x", "https://intranet/x", "https://tienda .com/x", "ftp://tienda.com/x", "no es un enlace", ""])
      expect(safeStoreUrl(bad).ok, bad).toBe(false);
    expect(safeStoreUrl(`https://tienda.com/${"a".repeat(MAX_STORE_QR_URL_LENGTH)}`)).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("destinos disponibles según la invitación PUBLICADA", () => {
  it("la boda de demostración (dos tiendas): invitación y mesa de regalos; sin enlace directo (hay varias)", () => {
    const availability = printQrAvailability(demo, { expired: false });
    expect(availability).toMatchObject({ invitation: true, gifts: true, giftsConfigured: true, giftLink: { ok: false, reason: "several" } });
  });

  it("una sola tienda con enlace seguro ofrece el enlace directo; http o una IP no", () => {
    expect(printQrAvailability(oneStore("https://mesaderegalos.liverpool.com.mx/lista/123"), { expired: false }).giftLink).toEqual({ ok: true, name: "Liverpool", url: "https://mesaderegalos.liverpool.com.mx/lista/123", host: "mesaderegalos.liverpool.com.mx" });
    expect(printQrAvailability(oneStore("http://tienda.com/lista"), { expired: false }).giftLink).toEqual({ ok: false, reason: "insecure" });
    expect(printQrAvailability(oneStore("https://10.0.0.5/lista"), { expired: false }).giftLink).toEqual({ ok: false, reason: "invalid" });
  });

  it("sin mesa, con la sección oculta o sin enlaces: no hay «Mesa de regalos» (la página pide configurarla y publicarla)", () => {
    for (const invitation of [withGifts(undefined), withGifts(demo.giftRegistry, false), withGifts({ message: "Gracias", entries: [] })]) {
      expect(printQrAvailability(invitation, { expired: false })).toMatchObject({ invitation: true, gifts: false, giftsConfigured: false, giftLink: { ok: false, reason: "no_registry" } });
    }
  });

  it("con el acceso vencido no hay QR hacia la invitación ni su sección; el enlace directo no depende de la vigencia", () => {
    const store = oneStore("https://tienda.com/lista");
    expect(printQrAvailability(store, { expired: true })).toMatchObject({ invitation: false, gifts: false, giftLink: { ok: true } });
  });

  it("un destino que ya no existe NO se resuelve hacia otro: no hay destino (el servicio pide elegir de nuevo)", () => {
    const noGifts = printQrAvailability(withGifts(undefined), { expired: false });
    expect(isQrTargetAvailable("gifts", noGifts)).toBe(false);
    expect(qrDestination("gifts", noGifts, URL_A)).toBeUndefined();
    expect(qrDestination("gift-link", noGifts, URL_A)).toBeUndefined();
    expect(isQrTargetAvailable("invitation", printQrAvailability(demo, { expired: true }))).toBe(false);
    expect(isQrTargetAvailable("none", noGifts)).toBe(true);
  });
});

describe("cada QR abre el destino correcto (escena = vista previa = PDF)", () => {
  it("invitación: la URL pública general y los textos de la invitación", () => {
    const scene = sceneFor(demo, "invitation");
    expect(qrOf(scene)?.rows).toEqual(createQrMatrix(URL_A).rows);
    expect(backTexts(scene)).toEqual(expect.arrayContaining([printCopy.card.qr.invitation.title, "Escanea para ver nuestra invitación digital", "hiloluna.com/i/andrea-y-fernando"]));
  });

  it("mesa de regalos: la MISMA invitación abierta en #regalos (nunca el panel), con su propio texto", () => {
    const scene = sceneFor(demo, "gifts");
    const url = `${URL_A}#${GIFT_REGISTRY_ANCHOR}`;
    expect(url).toBe("https://hiloluna.com/i/andrea-y-fernando#regalos");
    expect(qrOf(scene)?.rows).toEqual(createQrMatrix(url).rows);
    expect(backTexts(scene)).toEqual(expect.arrayContaining(["Mesa de regalos", "Escanea para ver nuestra mesa de regalos", "hiloluna.com/i/andrea-y-fernando"]));
    expect(backTexts(scene).join(" ")).not.toMatch(/dashboard|#regalos/);
  });

  it("enlace directo: codifica la tienda y no escribe una dirección", () => {
    const store = oneStore("https://mesaderegalos.liverpool.com.mx/lista/123");
    const scene = sceneFor(store, "gift-link");
    expect(qrOf(scene)?.rows).toEqual(createQrMatrix("https://mesaderegalos.liverpool.com.mx/lista/123").rows);
    expect(backTexts(scene)).toEqual(expect.arrayContaining(["Mesa de regalos", "Escanea para ver nuestra mesa de regalos"]));
    expect(backTexts(scene).some((text) => /hiloluna|liverpool/i.test(text))).toBe(false);
  });

  it("sin QR: no hay código y las columnas se recentran (el reverso se reorganiza)", () => {
    const withQr = sceneFor(demo, "invitation"), without = sceneFor(demo, "none");
    expect(qrOf(without)).toBeUndefined();
    expect(backTexts(without)).not.toContain(printCopy.card.qr.invitation.title);
    const labelY = (scene: PrintScene) => backItems(scene).find((item): item is SceneText => item.kind === "text" && item.text === "CEREMONIA")?.y ?? 0;
    expect(labelY(without)).toBeLessThan(labelY(withQr));
  });

  it("el QR conserva ≥ 1\" y módulo ≥ 0,75 mm con el ancla #regalos", () => {
    const qr = qrOf(sceneFor(demo, "gifts"));
    expect(qr && qr.size).toBeGreaterThanOrEqual(72 - 0.01);
    expect(qr && qr.size / qr.rows.length / (72 / 25.4)).toBeGreaterThanOrEqual(0.75);
  });
});

describe("opciones de la URL", () => {
  it("acepta los destinos, los enlaces anteriores (qr=1 / qr=0) y descarta lo desconocido", () => {
    expect(parsePrintOptions(new URLSearchParams("qr=gifts")).qr).toBe("gifts");
    expect(parsePrintOptions(new URLSearchParams("qr=gift-link")).qr).toBe("gift-link");
    expect(parsePrintOptions(new URLSearchParams("qr=1")).qr).toBe("invitation");
    expect(parsePrintOptions(new URLSearchParams("qr=0")).qr).toBe("none");
    expect(parsePrintOptions(new URLSearchParams("qr=https://evil.example")).qr).toBe("invitation");
    const options: PrintOptions = { ...DEFAULT_PRINT_OPTIONS, qr: "none" };
    expect(parsePrintOptions(new URLSearchParams(printOptionsQuery(options)))).toEqual(options);
  });
});

/** Dos eventos de dos dueños: la publicación solo la ve su dueño (como la consulta real, con `ownerId` en el WHERE). */
const owner = { id: "usr_A", email: "a@example.com", name: "A" };
const other = { id: "usr_B", email: "b@example.com", name: "B" };
const publicationOf: Record<string, { ownerId: string; source: OwnedPublication }> = {
  evt_A: { ownerId: "usr_A", source: { state: "published", invitation: demo, slug: "andrea-y-fernando", title: "Boda A", expired: false } },
  evt_B: { ownerId: "usr_B", source: { state: "published", invitation: oneStore("https://otra-tienda.com.mx/lista-de-b", "Tienda de Bea"), slug: "bea-y-beto", title: "Boda B", expired: false } },
};

function deps(over: Partial<PrintDeps> = {}): PrintDeps {
  const saved = new Map<string, PrintQrTarget>();
  return {
    loadPublication: async (userId, eventId) => (publicationOf[eventId]?.ownerId === userId ? publicationOf[eventId]?.source : undefined),
    loadFonts: async () => fonts,
    getAddonState: async (): Promise<PrintAddonState> => ({ plan: "PREMIUM", eligible: true, saleOpen: false, purchased: true, paidAt: null, pendingPayment: false, qrValidUntil: new Date("2027-06-16T23:00:00Z") }),
    hasPaidAddon: async () => true,
    isAdmin: async () => false,
    publicUrl: (slug) => `https://hiloluna.com/i/${slug}`,
    getQrTarget: async (userId, eventId) => (publicationOf[eventId]?.ownerId === userId ? (saved.get(eventId) ?? "invitation") : undefined),
    saveQrTarget: vi.fn(async (userId, eventId, target) => {
      if (publicationOf[eventId]?.ownerId !== userId) return false;
      saved.set(eventId, target);
      return true;
    }),
    rasterize: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    ...over,
  };
}

describe("servicio: guardar la elección, vista previa y PDF", () => {
  it("guarda «Mesa de regalos» solo si existe en la invitación publicada; nunca en un evento ajeno", async () => {
    const d = deps();
    expect(await savePrintQrTarget(owner, "evt_A", "gifts", d)).toEqual({ ok: true, target: "gifts" });
    expect((await getPrintPageView(owner, "evt_A", d)).status === "ready" && (await getPrintPageView(owner, "evt_A", d))).toMatchObject({ qr: { selected: "gifts", giftsUrl: "https://hiloluna.com/i/andrea-y-fernando#regalos" } });
    // Dos tiendas: no hay enlace directo.
    expect(await savePrintQrTarget(owner, "evt_A", "gift-link", d)).toMatchObject({ ok: false, code: "unavailable" });
    // Evento ajeno: igual que inexistente, y no se escribe nada.
    expect(await savePrintQrTarget(other, "evt_A", "none", d)).toMatchObject({ ok: false, code: "not_found" });
    expect(await savePrintQrTarget(owner, "evt_B", "gift-link", d)).toMatchObject({ ok: false, code: "not_found" });
    expect(d.saveQrTarget).toHaveBeenCalledTimes(1);
    // Datos que no llegan validados.
    expect(await savePrintQrTarget(owner, "evt_A", "https://evil.example", d)).toMatchObject({ ok: false, code: "invalid" });
    expect(await savePrintQrTarget(owner, "../evt_A", "none", d)).toMatchObject({ ok: false, code: "invalid" });
  });

  it("la mesa de un evento nunca aparece en otro: cada uno resuelve SU publicación", async () => {
    const d = deps();
    const viewA = await getPrintPageView(owner, "evt_A", d);
    const viewB = await getPrintPageView(other, "evt_B", d);
    expect(viewA.status === "ready" && viewA.qr.availability.giftLink).toEqual({ ok: false, reason: "several" });
    expect(viewB.status === "ready" && viewB.qr.availability.giftLink).toMatchObject({ ok: true, url: "https://otra-tienda.com.mx/lista-de-b" });
    expect(JSON.stringify(viewA)).not.toContain("otra-tienda");
    expect(JSON.stringify(viewB)).not.toMatch(/liverpool|amazon|andrea-y-fernando/i);
  });

  it("la vista previa refleja la selección: el reverso enviado al rasterizador es el del destino elegido", async () => {
    const d = deps();
    for (const target of ["invitation", "gifts", "none"] as const) {
      await getPrintPreview(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: target }, "back", d);
      const expectedPage = sceneFor(demo, target).pages.find((page) => page.kind === "back");
      expect(vi.mocked(d.rasterize).mock.lastCall?.[0], target).toBe(renderPrintSvg(expectedPage!, fonts, { watermark: true, pixelsPerPoint: 2.6 }));
    }
  });

  it("el PDF descargado lleva el QR del destino elegido (matriz reconstruida desde el PDF)", async () => {
    const d = deps();
    const rowsFor = async (userId: typeof owner, eventId: string, qr: PrintQrTarget) => {
      const file = await getPrintFile(userId, eventId, { ...DEFAULT_PRINT_OPTIONS, qr }, d);
      if (!file.ok) throw new Error("sin PDF");
      return qrRowsFromPdf(file.bytes);
    };
    expect(await rowsFor(owner, "evt_A", "invitation")).toEqual(createQrMatrix("https://hiloluna.com/i/andrea-y-fernando").rows);
    expect(await rowsFor(owner, "evt_A", "gifts")).toEqual(createQrMatrix("https://hiloluna.com/i/andrea-y-fernando#regalos").rows);
    expect(await rowsFor(other, "evt_B", "gift-link")).toEqual(createQrMatrix("https://otra-tienda.com.mx/lista-de-b").rows);
    expect(await rowsFor(owner, "evt_A", "none")).toBeUndefined();
  });

  it("sin cambios silenciosos: un destino que ya no existe no genera ni vista previa del reverso ni PDF (pide elegir de nuevo)", async () => {
    // La mesa de regalos se retiró y se volvió a publicar después de elegir «Mesa de regalos».
    const removed: OwnedPublication = { state: "published", invitation: withGifts(undefined), slug: "andrea-y-fernando", title: "Boda A", expired: false };
    const d = deps({ loadPublication: async (userId) => (userId === owner.id ? removed : undefined), getQrTarget: async () => "gifts" });
    expect(await getPrintFile(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: "gifts" }, d)).toEqual({ ok: false, reason: "qr_unavailable" });
    expect(await getPrintPreview(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: "gifts" }, "back", d)).toEqual({ ok: false, reason: "qr_unavailable" });
    // Dos tiendas: pedir el enlace directo tampoco cae a la invitación.
    expect(await getPrintFile(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: "gift-link" }, deps())).toEqual({ ok: false, reason: "qr_unavailable" });
    // La página conserva la elección guardada y avisa que hay que elegir otra.
    expect(await getPrintPageView(owner, "evt_A", d)).toMatchObject({ status: "ready", qr: { selected: "gifts", needsChoice: true } });
    // Elegir otra opción disponible (o quitar el reverso) vuelve a permitir generar.
    expect((await getPrintFile(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: "invitation" }, d)).ok).toBe(true);
    expect((await getPrintFile(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: "gifts", includeBack: false }, d)).ok).toBe(true);
    // Invitación vencida con el destino «invitación»: tampoco se omite el QR en silencio.
    const expired = deps({ loadPublication: async (userId) => (userId === owner.id ? { ...removed, expired: true } : undefined) });
    expect(await getPrintFile(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: "invitation" }, expired)).toEqual({ ok: false, reason: "qr_unavailable" });
    expect((await getPrintFile(owner, "evt_A", { ...DEFAULT_PRINT_OPTIONS, qr: "none" }, expired)).ok).toBe(true);
  });

  it("las rutas responden 409 con un mensaje claro (nunca un PDF con otro destino)", () => {
    for (const route of ["preview", "file"]) {
      const code = readFileSync(join(ROOT, `app/(site)/dashboard/(workspace)/events/[id]/print/${route}/route.ts`), "utf8");
      expect(code, route).toMatch(/reason === "qr_unavailable" \? qrUnavailable\(\)/);
      expect(code, route).toMatch(/status: 409/);
    }
  });

  it("sin elección guardada (eventos existentes) el QR sigue apuntando a la invitación", async () => {
    const view = await getPrintPageView(owner, "evt_A", deps({ getQrTarget: async () => "invitation" }));
    expect(view).toMatchObject({ status: "ready", qr: { selected: "invitation", needsChoice: false } });
    expect(DEFAULT_PRINT_OPTIONS.qr).toBe("invitation");
  });
});

describe("selector en «Versión para imprimir»", () => {
  const view = (invitation: Invitation) => ({ selected: "invitation" as const, needsChoice: false, availability: printQrAvailability(invitation, { expired: false }), invitationUrl: URL_A, giftsUrl: `${URL_A}#regalos`, validUntil: new Date("2027-06-16T23:00:00Z") });

  it("ofrece invitación, mesa de regalos y sin QR; muestra el texto que se imprimirá, a dónde abre y su vigencia", () => {
    const html = renderToStaticMarkup(<QrTargetPicker eventId="evt_A" qr={view(demo)} value="gifts" includeBack onChange={() => undefined} />);
    expect(html.match(/data-qr-target="/g)).toHaveLength(3);
    expect(html).toContain("Escanea para ver nuestra mesa de regalos");
    expect(html).toContain("hiloluna.com/i/andrea-y-fernando#regalos");
    expect(html).toContain("funcionará hasta el 16 de junio de 2027");
    expect(html).not.toContain("data-gifts-missing");
  });

  it("sin mesa publicada: la opción está desactivada y pide configurarla y publicarla, con enlace al editor", () => {
    const html = renderToStaticMarkup(<QrTargetPicker eventId="evt_A" qr={view(withGifts(undefined))} value="invitation" includeBack onChange={() => undefined} />);
    expect(html).toMatch(/data-qr-target="gifts" data-available="false"/);
    expect(html).toContain("data-gifts-missing");
    expect(html).toContain('href="/dashboard/events/evt_A/edit"');
  });

  it("con una sola tienda segura aparece el enlace directo, avisando que no depende de la invitación", () => {
    const html = renderToStaticMarkup(<QrTargetPicker eventId="evt_A" qr={view(oneStore("https://tienda.com.mx/lista"))} value="gift-link" includeBack onChange={() => undefined} />);
    expect(html).toMatch(/data-qr-target="gift-link" data-available="true"/);
    expect(html).toContain("Abre Liverpool sin pasar por la invitación.");
    expect(html).toContain(printCopy.page.qr.directValidity);
  });

  it("destino elegido que ya no existe: aviso, sin texto de vista previa, sin reverso ni botón de descarga hasta elegir otro", () => {
    const qr = { ...view(withGifts(undefined)), selected: "gifts" as const, needsChoice: true };
    const picker = renderToStaticMarkup(<QrTargetPicker eventId="evt_A" qr={qr} value="gifts" includeBack onChange={() => undefined} />);
    expect(picker).toContain('role="alert"');
    expect(picker).toContain("La mesa de regalos que elegiste ya no está en tu invitación publicada.");
    expect(picker).not.toContain("data-qr-preview");
    const studio = renderToStaticMarkup(<PrintStudio eventId="evt_A" qr={qr} defaultInitials="AF" defaultPlace="" download="purchase" product={null} />);
    expect(studio).toContain("data-back-blocked");
    expect(studio).toContain("data-download-blocked");
    expect(studio).not.toContain("/print/file?");
    expect(studio).not.toMatch(/print\/preview\?side=back/);
    // Con un destino disponible vuelven el reverso y la descarga.
    const ok = renderToStaticMarkup(<PrintStudio eventId="evt_A" qr={view(demo)} defaultInitials="AF" defaultPlace="" download="purchase" product={null} />);
    expect(ok).toContain("/print/file?format=5x7&amp;back=1&amp;qr=invitation");
    expect(ok).not.toContain("data-download-blocked");
  });

  it("la invitación pública tiene el ancla estable #regalos en la sección de la mesa", () => {
    expect(readFileSync(join(ROOT, "components/invitation/sections/gift-registry-section.tsx"), "utf8")).toMatch(/anchorId=\{GIFT_REGISTRY_ANCHOR\}/);
    expect(GIFT_REGISTRY_ANCHOR).toBe("regalos");
  });
});
