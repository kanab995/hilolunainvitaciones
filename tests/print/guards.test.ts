import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PRINT_EVENT_TYPES } from "@/lib/print/data";
import { DEFAULT_PRINT_OPTIONS, parsePrintOptions } from "@/lib/print/options";
import { PRINT_COLORS } from "@/lib/print/scene";
import { loadPrintFonts, type PrintFontSet } from "@/server/print/fonts";
import type { OwnedPublication } from "@/server/repositories/publishing";
import type { PrintAddonState } from "@/server/services/addon-service";
import { getPrintFile, getPrintPreview, type PrintDeps } from "@/server/services/print-service";
import { demo } from "./fixtures";

/**
 * GARANTÍAS de la versión impresa (D-47) pedidas por el propietario al cerrar la Etapa 2: la vista previa gratuita no lleva al PDF
 * limpio por ninguna ruta, la descarga de administración es solo de prueba y con propiedad, se conserva el diseño B aprobado y solo hay
 * bodas.
 */
const ROOT = process.cwd();
const owner = { id: "usr_owner", email: "owner@example.com", name: "Owner" };
const intruder = { id: "usr_other", email: "other@example.com", name: "Other" };
const published: OwnedPublication = { state: "published", invitation: demo, slug: "andrea-y-fernando", title: "Boda", expired: false };

let fonts: PrintFontSet;
beforeAll(async () => {
  fonts = await loadPrintFonts();
});

/** Publicación solo para su dueño: cualquier otro usuario no la encuentra (como la consulta real, con `ownerId` en el WHERE). */
const ownedBy = (userId: string) => vi.fn(async (requester: string) => (requester === userId ? published : undefined));

function deps(overrides: Partial<PrintDeps> = {}): PrintDeps {
  return {
    loadPublication: ownedBy(owner.id),
    loadFonts: async () => fonts,
    getAddonState: async (): Promise<PrintAddonState> => ({ plan: "PREMIUM", eligible: true, saleOpen: false, purchased: false, paidAt: null, pendingPayment: false, qrValidUntil: null }),
    hasPaidAddon: async () => false,
    isAdmin: async () => false,
    publicUrl: (slug) => `https://hiloluna.com/i/${slug}`,
    getQrTarget: vi.fn(async () => "invitation" as const),
    saveQrTarget: vi.fn(async () => true),
    rasterize: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    ...overrides,
  };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (["node_modules", ".next"].includes(entry)) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}
const rel = (file: string) => relative(ROOT, file).replaceAll("\\", "/");
const code = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("la vista previa gratuita nunca entrega el PDF limpio", () => {
  it("solo el servicio de impresión y el script local de demostración generan PDF; solo la ruta `file` lo sirve", () => {
    const files = ["app", "components", "lib", "server", "scripts"].flatMap((dir) => sourceFiles(join(ROOT, dir)));
    const pdfPainters = files.filter((file) => /renderPrintPdf\(/.test(code(file))).map(rel).filter((file) => file !== "server/print/pdf.ts");
    expect(pdfPainters.sort()).toEqual(["scripts/print-sample.ts", "server/services/print-service.ts"]);
    const fileServers = files.filter((file) => /getPrintFile\(/.test(code(file))).map(rel).filter((file) => file !== "server/services/print-service.ts");
    expect(fileServers).toEqual(["app/(site)/dashboard/(workspace)/events/[id]/print/file/route.ts"]);
  });

  it("el script de muestra solo usa la boda de DEMOSTRACIÓN (no lee la base de datos)", () => {
    const script = code(join(ROOT, "scripts/print-sample.ts"));
    expect(script).toContain("@/lib/invitation/mock/andrea-fernando");
    expect(script).not.toMatch(/repositories|prisma|getPrintFile|loadOwnedPublication/);
  });

  it("la ruta de vista previa no conoce el PDF ni sirve otra cosa que una imagen", () => {
    const route = code(join(ROOT, "app/(site)/dashboard/(workspace)/events/[id]/print/preview/route.ts"));
    expect(route).not.toMatch(/getPrintFile|renderPrintPdf|application\/pdf|renderPrintSvg/);
    expect(route).toContain("getPrintPreview(");
  });

  it("toda cara de la vista previa (también el sobre) lleva la marca de agua y sale como PNG", async () => {
    for (const side of ["front", "back", "envelope"] as const) {
      const d = deps();
      const result = await getPrintPreview(owner, "evt", DEFAULT_PRINT_OPTIONS, side, d);
      expect(result.ok && result.contentType, side).toBe("image/png");
      const svg = vi.mocked(d.rasterize).mock.calls[0]?.[0] ?? "";
      expect(svg, side).toContain('fill-opacity="0.16"');
    }
  });

  it("ningún parámetro de la URL quita la marca de agua ni pide el PDF", () => {
    const options = parsePrintOptions(new URLSearchParams("watermark=0&clean=1&format=pdf&side=file&admin=1"));
    expect(options).toEqual(DEFAULT_PRINT_OPTIONS);
  });

  it("sin rasterizador no hay vista previa (nunca el SVG vectorial)", async () => {
    expect(await getPrintPreview(owner, "evt", DEFAULT_PRINT_OPTIONS, "front", deps({ rasterize: async () => undefined }))).toEqual({ ok: false });
  });
});

describe("descarga: con compra o como prueba interna de administración, siempre con propiedad", () => {
  it("la compra pagada se busca con el usuario que pide (un comprador no descarga eventos ajenos)", async () => {
    const paidBy = (owner: string) => vi.fn(async (userId: string) => userId === owner);
    const d = deps({ hasPaidAddon: paidBy(owner.id) });
    expect((await getPrintFile(owner, "evt", DEFAULT_PRINT_OPTIONS, d)).ok).toBe(true);
    expect(await getPrintFile(intruder, "evt", DEFAULT_PRINT_OPTIONS, deps({ hasPaidAddon: paidBy(owner.id) }))).toEqual({ ok: false });
  });

  it("un ADMIN no descarga el PDF de un evento AJENO (la consulta lleva su propio id)", async () => {
    const d = deps({ isAdmin: async () => true });
    expect(await getPrintFile(intruder, "evt", DEFAULT_PRINT_OPTIONS, d)).toEqual({ ok: false });
    expect(d.loadPublication).toHaveBeenCalledWith("usr_other", "evt");
  });

  it("un dueño sin rol ADMIN y sin compra no descarga nada", async () => {
    expect(await getPrintFile(owner, "evt", DEFAULT_PRINT_OPTIONS, deps())).toEqual({ ok: false });
  });

  it("un ADMIN dueño del evento sí, y la generación queda marcada como prueba interna en el registro", async () => {
    expect((await getPrintFile(owner, "evt", DEFAULT_PRINT_OPTIONS, deps({ isAdmin: async () => true }))).ok).toBe(true);
    expect(code(join(ROOT, "server/services/print-service.ts"))).toMatch(/print\.file\.generated[\s\S]{0,200}internal: !purchased/);
  });

  it("el rol sale de la base de datos (isCurrentUserAdmin), nunca de la petición", () => {
    const service = code(join(ROOT, "server/services/print-service.ts"));
    expect(service).toContain("isAdmin: isCurrentUserAdmin");
    for (const route of ["preview", "file"]) expect(code(join(ROOT, `app/(site)/dashboard/(workspace)/events/[id]/print/${route}/route.ts`))).not.toMatch(/admin|role/i);
  });
});

describe("decisiones del propietario que se conservan", () => {
  it("diseño B «Romántica elegante»: colores aprobados", () => {
    expect(PRINT_COLORS).toEqual({ paper: "#FBF8F1", ink: "#3B352F", muted: "#5F564C", gold: "#8E7244", line: "#A68C5E", qr: "#24201C" });
  });

  it("al inicio, solo bodas", () => {
    expect(PRINT_EVENT_TYPES).toEqual(["wedding"]);
  });
});
