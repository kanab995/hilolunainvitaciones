import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTemplateBySlug, getTemplateEventLabel } from "@/lib/content/templates";
import { getCountdown } from "@/lib/invitation/countdown";
import { getInvitationTemplate, invitationTemplates } from "@/lib/invitation/templates";
import { luciaBosqueDeAventurasInvitation } from "@/lib/invitation/mock/lucia-bosque-de-aventuras";
import { bosqueDeAventurasTemplate } from "@/lib/invitation/templates/bosque-de-aventuras";
import { resolveTemplateStyle, templateToCssVars } from "@/lib/invitation/styles";
import type { Invitation } from "@/types/invitation";
import { NOW, render, visibleText } from "./helpers";

const invitation = luciaBosqueDeAventurasInvitation;
const template = bosqueDeAventurasTemplate;
const FOLDER = join(process.cwd(), "public", "templates", "bosque-de-aventuras");
const encoded = (path: string) => encodeURIComponent(path);
/** React escapa `&` como `&amp;` dentro de los atributos. */
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;");

describe("Bosque de Aventuras: registro y catálogo", () => {
  it("está en el registro del motor y en el catálogo con su ficha comercial", () => {
    expect(getInvitationTemplate("bosque-de-aventuras")).toBe(template);
    const entry = getTemplateBySlug("bosque-de-aventuras");
    expect(entry?.name).toBe("Bosque de Aventuras");
    expect(entry?.eventType).toBe("birthday");
    expect(entry?.style).toBe("kids");
    expect(entry?.description).toBe("Una celebración mágica entre flores, animalitos y aventuras en un bosque encantado. Ideal para cumpleaños llenos de ternura y diversión.");
  });

  it("diseño aprobado tras validar el juego final de assets: `implemented`, rotulada «Cumpleaños infantil»", () => {
    const entry = getTemplateBySlug("bosque-de-aventuras");
    expect(entry?.status).toBe("implemented");
    expect(entry && getTemplateEventLabel(entry)).toBe("Cumpleaños infantil");
  });
});

describe("Bosque de Aventuras: la invitación completa", () => {
  const html = render(invitation, template);

  it("renderiza todas las secciones activas, en el orden de los datos", () => {
    const visible = invitation.sections.filter((section) => section.isVisible);
    expect(visible).toHaveLength(9);
    const positions = visible.map((section) => html.indexOf(`id="${section.id}"`));
    for (const [i, section] of visible.entries()) expect(positions[i], section.id).toBeGreaterThanOrEqual(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("dibuja el contenido de Lucía desde la invitación", () => {
    const text = visibleText(html);
    for (const expected of [
      "Lucía",
      "¡Lucía cumple 5!",
      "¡Una aventura mágica está por comenzar!",
      "Abrir invitación",
      "¡Bienvenidos al bosque!",
      "Lucía está lista para celebrar",
      "Falta poquito",
      "Jardín El Bosque Encantado",
      "Camino de los Pinos 128",
      "Cómo llegar",
      "Momentos mágicos",
      "Disfraz de animalito del bosque",
      "Tu presencia es nuestro mejor regalo",
      "Confirmar asistencia",
      "¡Gracias por ser parte de esta aventura mágica!",
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(text).not.toContain("Andrea");
    expect(text).not.toContain("Nico");
  });

  it("usa sus variantes: portada split, sede apilada y galería en carrusel", () => {
    expect(html).toContain('data-hero-layout="split"');
    expect(html).toContain('data-locations-layout="stacked"');
    expect(html).toContain('data-gallery-layout="carousel"');
  });

  it("el botón de mapas abre la ubicación de la sede", () => {
    for (const location of invitation.locations) expect(html).toContain(`href="${escapeHtml(location.mapUrl ?? "")}"`);
  });

  it("la cuenta regresiva va en tarjetas y cuenta hasta la fecha del evento con su zona horaria", () => {
    expect(html).toContain('data-countdown="cards"');
    const parts = getCountdown(invitation.event.startsAt, NOW);
    expect(/role="timer" aria-label="([^"]*)"/.exec(html)?.[1]).toBe(`${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`);
  });

  it("la galería tiene las cinco imágenes de la plantilla", () => {
    for (const image of invitation.gallery) expect(html, image.src).toContain(encoded(image.src ?? ""));
    expect(invitation.gallery).toHaveLength(5);
  });

  it("una sección oculta no se dibuja y sus datos permanecen", () => {
    const hidden: Invitation = { ...invitation, sections: invitation.sections.map((s) => (s.type === "gallery" ? { ...s, isVisible: false } : s)) };
    const hiddenHtml = render(hidden, template);
    expect(hiddenHtml).not.toContain('data-section="gallery"');
    expect(hidden.gallery).toEqual(invitation.gallery);
  });
});

describe("Bosque de Aventuras: opciones de plantilla D-50", () => {
  it("activa tarjetas de madera, respuesta al tocar y vaivén de las decoraciones", () => {
    const style = resolveTemplateStyle(template);
    expect(style.countdown).toBe("cards");
    expect(style.press).toBe("pop");
    expect(style.decorMotion).toBe("sway");
    const html = render(invitation, template);
    expect(html).toContain('data-press="pop"');
    expect(html).toContain('data-decor-motion="sway"');
    expect(html).toContain("inv-open");
  });

  it("publica los colores de las tarjetas como variables CSS", () => {
    const vars = templateToCssVars(template);
    expect(vars["--inv-counter-bg"]).toBe("#78563d");
    expect(vars["--inv-counter-fg"]).toBe("#fff5e7");
  });

  it.each(invitationTemplates.filter((t) => t.slug !== "bosque-de-aventuras").map((t) => [t.slug, t] as const))(
    "opt-in estricto: %s conserva su comportamiento (sin tarjetas, sin pulsación, sin vaivén, sin variables nuevas)",
    (_slug, other) => {
      expect(other.componentStyles.countdown).toBeUndefined();
      expect(other.componentStyles.button.press).toBeUndefined();
      expect(other.animations.decor).toBeUndefined();
      expect(other.colors.counterBg).toBeUndefined();
      const style = resolveTemplateStyle(other);
      expect([style.countdown, style.press, style.decorMotion]).toEqual(["divided", "none", "static"]);
      const vars = templateToCssVars(other);
      expect(vars).not.toHaveProperty("--inv-counter-bg");
      expect(vars).not.toHaveProperty("--inv-counter-fg");
    },
  );
});

describe("Bosque de Aventuras: identidad original (propiedad intelectual)", () => {
  const forbidden = ["masha", "marsha", "mischa", "misha", "animaccord", "disney", "pixar", "dreamworks", "marvel"];
  it("ningún texto visible, nombre, slug ni descripción usa nombres de franquicias", () => {
    const haystack = [
      visibleText(render(invitation, template)),
      template.slug,
      template.name,
      getTemplateBySlug("bosque-de-aventuras")?.description ?? "",
      readFileSync(join(process.cwd(), "lib/invitation/templates/bosque-de-aventuras.ts"), "utf8"),
      readFileSync(join(process.cwd(), "lib/invitation/mock/lucia-bosque-de-aventuras.ts"), "utf8"),
    ]
      .join(" ")
      .toLowerCase();
    for (const word of forbidden) expect(haystack, word).not.toContain(word);
  });
});

/** Medidas reales de un PNG (cabecera IHDR) y si tiene canal alfa o transparencia declarada. */
function pngInfo(path: string): { width: number; height: number; alpha: boolean } {
  const buffer = readFileSync(path);
  expect(buffer.subarray(1, 4).toString("latin1"), `${path} no es un PNG`).toBe("PNG");
  const colorType = buffer[25];
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 || buffer.includes(Buffer.from("tRNS")) };
}

describe("Bosque de Aventuras: assets aportados por el propietario", () => {
  // Sin los archivos, `tests/invitation/assets.test.ts` ya falla («todo asset referenciado existe»); aquí se
  // validan medidas y transparencia en cuanto están en public/templates/bosque-de-aventuras/.
  const images: { file: string; width: number; height: number }[] = [
    ...Object.values(template.decor).flatMap((asset) => (asset?.kind === "image" ? [{ file: asset.src, width: asset.width, height: asset.height }] : [])),
    ...[...invitation.locations.map((l) => l.photo), ...invitation.gallery, invitation.dressCode?.illustration, invitation.giftRegistry?.photo].flatMap((image) =>
      image?.src && image.width && image.height ? [{ file: image.src, width: image.width, height: image.height }] : [],
    ),
  ];

  it.each([...new Map(images.map((image) => [image.file, image])).values()])("$file: medidas declaradas = medidas reales", ({ file, width, height }) => {
    const path = join(FOLDER, file.split("/").at(-1) ?? "");
    if (!existsSync(path)) return; // falta: lo reporta assets.test.ts
    const info = pngInfo(path);
    expect({ width: info.width, height: info.height }, file).toEqual({ width, height });
  });

  it("decor-corners.png tiene canal alfa (transparencia real)", () => {
    const path = join(FOLDER, "decor-corners.png");
    if (!existsSync(path)) return;
    expect(pngInfo(path).alpha).toBe(true);
  });
});

describe("Bosque de Aventuras: migración de catálogo en BORRADOR (no aplicada)", () => {
  const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261030120000_seed_bosque_de_aventuras_template/migration.sql"), "utf8");
  const insert = sql.slice(sql.indexOf("INSERT INTO"));

  it("entra con el diseño aprobado pero SIN publicar (DRAFT) y nunca sobrescribe una fila existente", () => {
    expect(insert).toContain("'IMPLEMENTED', 'DRAFT'");
    expect(insert).not.toContain("PUBLISHED");
    expect(insert).toContain("ON CONFLICT (slug) DO NOTHING");
  });

  it("sus valores son los del catálogo (buildTemplateRows), campo por campo", async () => {
    const { buildTemplateRows } = await import("@/server/seed/demo-data");
    const row = buildTemplateRows().find((r) => r.slug === "bosque-de-aventuras");
    if (!row) throw new Error("sin fila en el seed");
    for (const value of [row.id, row.slug, row.name, row.eventType, row.style, row.description, row.designStatus, row.minimumPlan, row.thumbnailAlt, row.thumbnailTone]) {
      expect(insert, String(value)).toContain(`'${value}'`);
    }
    expect(insert).toContain(`'{${row.secondaryStyles.join(",")}}'`);
    expect(insert).toContain(`'{${row.features.join(",")}}'`);
    expect(insert).toContain(` ${row.sortOrder}, now(), now(), '${row.minimumPlan}')`);
    const jsons = [...insert.matchAll(/'(\{"[^']*\}|\[\{[^']*\])'/g)].map((m) => JSON.parse(m[1] as string));
    expect(jsons).toEqual([row.previewSample, row.previewScreens]);
  });
});
