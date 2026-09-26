import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QrCodePanel } from "@/components/share/qr-code-panel";
import { isShareCancelled } from "@/components/share/use-web-share";
import { createQrMatrix, QR_COLORS, QR_MARGIN, qrPayload, qrToSvg } from "@/lib/share/qr";
import { icsFilename, qrFilename, resolveGuestShare, resolveShare, safeFilePart, SHARE_TEXT, webSharePayload } from "@/lib/share/target";
import { getGuestInvitationUrl, getPublicInvitationUrl } from "@/lib/site-url";
import { deriveDemoInviteToken } from "@/server/services/invite-token";

const ROOT = process.cwd();
const PROD = { NODE_ENV: "production" } as const;
const TOKEN = deriveDemoInviteToken("gst_demo_1");

describe("Compartir: solo lo PUBLICADO", () => {
  it("(41.1) un borrador no permite compartir públicamente (sin URL, QR ni calendario)", () => {
    expect(resolveShare({ slug: "andrea-y-fernando", title: "Andrea & Fernando", state: "draft" })).toEqual({ available: false, reason: "draft" });
    expect(resolveGuestShare({ slug: "andrea-y-fernando", inviteToken: TOKEN, guestName: "Mariana López", state: "draft" })).toEqual({ available: false, reason: "draft" });
  });

  it("(41.2) publicado: la URL pública es <base>/i/<slug> y el calendario cuelga de la misma ruta", () => {
    const target = resolveShare({ slug: "andrea-y-fernando", title: "Andrea & Fernando", state: "published" }, PROD);
    expect(target).toMatchObject({ available: true, url: "https://hiloluna.com/i/andrea-y-fernando", calendarPath: "/i/andrea-y-fernando/calendar.ics", title: "Andrea & Fernando" });
  });

  it("(2/41.3) con «Cambios sin publicar» se sigue compartiendo la última versión publicada: la URL NO cambia", () => {
    const published = resolveShare({ slug: "andrea-y-fernando", title: "x", state: "published" }, PROD);
    const changes = resolveShare({ slug: "andrea-y-fernando", title: "x", state: "changes" }, PROD);
    expect(changes).toEqual(published);
    expect(changes.available).toBe(true);
  });

  it("(41.4/1) ninguna URL se escribe a mano: la base sale de getSiteUrl() (entorno) y cambia con él", () => {
    expect(getPublicInvitationUrl("s", { NEXT_PUBLIC_SITE_URL: "https://staging.example.com", NODE_ENV: "production" })).toBe("https://staging.example.com/i/s");
    expect(resolveShare({ slug: "s", title: "t", state: "published" }, { NEXT_PUBLIC_SITE_URL: "https://staging.example.com" })).toMatchObject({ url: "https://staging.example.com/i/s" });
    // Ningún componente ni módulo de compartir contiene el dominio de producción.
    const files = ["components/share", "lib/share", "lib/calendar", "server/services/calendar-service.ts", "app/(invitation)/i/[slug]/calendar.ics/route.ts", "components/dashboard/share-dialog.tsx", "components/dashboard/share-action-card.tsx"];
    const walk = (path: string): string[] => (statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => walk(join(path, name))) : [path]);
    for (const file of files.flatMap((entry) => walk(join(ROOT, entry)))) expect(readFileSync(file, "utf8"), relative(ROOT, file)).not.toMatch(/hiloluna\.com/);
  });

  it("(41.5/41.6/8) el enlace de un invitado usa su inviteToken opaco y NUNCA su id", () => {
    const url = getGuestInvitationUrl("andrea-y-fernando", TOKEN, PROD);
    expect(url).toBe(`https://hiloluna.com/i/andrea-y-fernando?guest=${TOKEN}`);
    expect(url).not.toContain("gst_demo_1");
    const target = resolveGuestShare({ slug: "andrea-y-fernando", inviteToken: TOKEN, guestName: "Mariana López", state: "published" }, PROD);
    expect(target).toMatchObject({ available: true, url });
    expect(JSON.stringify(target)).not.toContain("gst_demo_1");
  });

  it("(5) el contenido de Web Share: título, texto y URL pública", () => {
    const target = resolveShare({ slug: "andrea-y-fernando", title: "Andrea & Fernando", state: "published" }, PROD);
    expect(target.available && webSharePayload(target)).toEqual({ title: "Andrea & Fernando", text: "Nos encantará compartir este día contigo.", url: "https://hiloluna.com/i/andrea-y-fernando" });
    expect(SHARE_TEXT).toBe("Nos encantará compartir este día contigo.");
  });

  it("(40) cerrar la hoja de compartir (AbortError) no es un error; cualquier otro sí", () => {
    expect(isShareCancelled(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
    expect(isShareCancelled(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toBe(false);
    expect(isShareCancelled(null)).toBe(false);
  });
});

describe("Nombres de archivo seguros", () => {
  it("(42.5/11) invitacion-<slug>-qr.png con solo a-z, 0-9 y guiones", () => {
    expect(qrFilename("andrea-y-fernando")).toBe("invitacion-andrea-y-fernando-qr.png");
    expect(qrFilename("andrea-y-fernando", "svg")).toBe("invitacion-andrea-y-fernando-qr.svg");
    expect(icsFilename("andrea-y-fernando")).toBe("invitacion-andrea-y-fernando.ics");
  });

  it("(36) nunca se construye con entrada sin sanear: rutas, comillas, saltos de línea y unicode se neutralizan", () => {
    for (const hostile of ['../../etc/passwd', 'a"; filename="x.exe', "a\r\nSet-Cookie: x=1", "<script>", "Mariana López ‮", "", "   "]) {
      for (const name of [qrFilename(hostile), icsFilename(hostile), (resolveGuestShare({ slug: "s", inviteToken: TOKEN, guestName: hostile, state: "published" }) as { qrFilename: string }).qrFilename]) {
        expect(name, hostile).toMatch(/^invitacion-[a-z0-9-]+\.(png|svg|ics)$/);
      }
    }
    expect(safeFilePart("Mariana López", "invitado")).toBe("mariana-lopez");
    expect(safeFilePart("", "invitado")).toBe("invitado");
  });

  it("el nombre del archivo del QR de un invitado no contiene el token ni el id", () => {
    const target = resolveGuestShare({ slug: "andrea-y-fernando", inviteToken: TOKEN, guestName: "Mariana López", state: "published" });
    expect(target.available && target.qrFilename).toBe("invitacion-andrea-y-fernando-mariana-lopez-qr.png");
  });
});

describe("Código QR (local, sin servicios externos)", () => {
  it("(42.1) el QR general codifica EXACTAMENTE la URL pública", () => {
    const target = resolveShare({ slug: "andrea-y-fernando", title: "t", state: "published" }, PROD);
    expect(target.available && qrPayload(target.url)).toBe("https://hiloluna.com/i/andrea-y-fernando");
  });

  it("(42.2/42.3/7) el QR de un invitado codifica su URL personalizada (con el token) y NO el id del invitado", () => {
    const target = resolveGuestShare({ slug: "andrea-y-fernando", inviteToken: TOKEN, guestName: "Mariana López", state: "published" }, PROD);
    const payload = target.available ? qrPayload(target.url) : "";
    expect(payload).toBe(`https://hiloluna.com/i/andrea-y-fernando?guest=${TOKEN}`);
    expect(payload).not.toContain("gst_demo_1");
  });

  it("(42.4) un borrador no genera QR público", () => {
    expect(resolveShare({ slug: "s", title: "t", state: "draft" }).available).toBe(false);
  });

  it("la matriz es determinista, su tamaño corresponde a una versión válida y distintas URL dan matrices distintas", () => {
    const a = createQrMatrix("https://hiloluna.com/i/andrea-y-fernando");
    const b = createQrMatrix("https://hiloluna.com/i/andrea-y-fernando");
    const c = createQrMatrix(`https://hiloluna.com/i/andrea-y-fernando?guest=${TOKEN}`);
    expect(a.rows).toEqual(b.rows);
    expect((a.size - 21) % 4).toBe(0);
    expect(c.size).toBeGreaterThan(a.size - 1);
    expect(JSON.stringify(c.rows)).not.toBe(JSON.stringify(a.rows));
    expect(() => createQrMatrix("")).toThrow();
    // Patrón de posición (esquina superior izquierda): 7×7 con centro oscuro.
    expect(a.rows[0]!.slice(0, 7).every(Boolean)).toBe(true);
    expect(a.rows[3]![3]).toBe(true);
  });

  it("(9/10) el SVG es limpio: tinta oscura sobre blanco, sin degradados ni imágenes, con zona de silencio", () => {
    const matrix = createQrMatrix("https://hiloluna.com/i/x");
    const svg = qrToSvg(matrix);
    expect(svg).toContain(`fill="${QR_COLORS.dark}"`);
    expect(svg).toContain(`fill="${QR_COLORS.light}"`);
    expect(svg).toContain(`viewBox="0 0 ${matrix.size + QR_MARGIN * 2} ${matrix.size + QR_MARGIN * 2}"`);
    for (const forbidden of ["gradient", "<image", "<script", "opacity", "filter"]) expect(svg).not.toContain(forbidden);
    // Contraste alto (tinta muy oscura sobre blanco).
    const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminance = (hex: string) => [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    expect((luminance(QR_COLORS.light) + 0.05) / (luminance(QR_COLORS.dark) + 0.05)).toBeGreaterThan(12);
    // La zona de silencio (margen) queda sin módulos: ninguna ruta empieza antes del margen.
    expect(svg).not.toMatch(new RegExp(`M[0-${QR_MARGIN - 1}] `));
  });

  it("(39) el panel describe la imagen como «Código QR para abrir la invitación», no muestra la URL ni el token y ofrece la descarga", () => {
    const html = renderToStaticMarkup(<QrCodePanel url={`https://hiloluna.com/i/andrea-y-fernando?guest=${TOKEN}`} filename="invitacion-x-qr.png" svgFilename="invitacion-x-qr.svg" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Código QR para abrir la invitación"');
    expect(html).not.toContain(TOKEN);
    expect(html).not.toContain("guest=");
    expect(html).toContain("<svg");
    expect(html).toContain("Descargar QR");
    expect(html).toContain('role="status"'); // feedback anunciado
    expect(html).toMatch(/w-\[min\(68vw,17rem\)\]/); // ≈ 272 px
  });

  it("(40) un fallo al generar el QR se muestra como aviso, no rompe el modal", () => {
    expect(renderToStaticMarkup(<QrCodePanel url="" filename="x.png" />)).toContain("No pudimos generar el código QR");
  });

  it("el QR no guarda nada ni llama a servicios externos (sin fetch, sin URL de terceros, sin almacenamiento)", () => {
    const code = ["lib/share/qr.ts", "components/share/qr-code-panel.tsx"].map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");
    expect(code).not.toMatch(/fetch\(|XMLHttpRequest|https?:\/\/(?!www\.w3\.org)|localStorage|prisma/);
  });
});
