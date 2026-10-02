import { describe, expect, it } from "vitest";
import { getCountdown } from "@/lib/invitation/countdown";
import { santiagoLevel12Invitation } from "@/lib/invitation/mock/santiago-level-12";
import { level12Template } from "@/lib/invitation/templates/level-12";
import type { Invitation } from "@/types/invitation";
import { NOW, render, visibleText } from "./helpers";

const invitation = santiagoLevel12Invitation;
const encoded = (path: string) => encodeURIComponent(path);

const images = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
/** React escapa `&` como `&amp;` dentro de los atributos. */
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;");

describe("Level 12 (plantilla terminada, D-38)", () => {
  const html = render(invitation, level12Template);

  it("renderiza todas las secciones activas, en el orden de los datos", () => {
    const visible = invitation.sections.filter((section) => section.isVisible);
    expect(visible).toHaveLength(10);
    for (const section of visible) expect(html, section.id).toContain(`id="${section.id}"`);

    const positions = visible.map((section) => html.indexOf(`id="${section.id}"`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("dibuja el contenido de Santiago desde la invitación (no el de Andrea & Fernando)", () => {
    const text = visibleText(html);
    for (const expected of [
      "Santiago",
      "Nivel 12 desbloqueado",
      "Abrir invitación",
      "Un día especial",
      "Prepárate para una tarde llena de juegos",
      "Faltan",
      "Zona Gamer",
      "Av. de los Videojuegos 212",
      "Cómo llegar",
      "Itinerario",
      "Llegada",
      "Comida",
      "Pastel",
      "Nuestros momentos",
      "Cómodo para jugar",
      "Ven cómodo para jugar.",
      "Tu presencia es el mejor regalo",
      "Confirmar asistencia",
      "¡Gracias por ser parte de esta misión!",
    ]) {
      expect(text, expected).toContain(expected);
    }
    // `santiagoLevel12Invitation.slug` es "santiago-level-12" (no "demo-…"): el aviso de modo
    // demostración NO se muestra con este slug (tests/rsvp/ui-and-policy.test.tsx cubre /i/demo-level-12).
    expect(text).not.toContain("Modo demostración");
    expect(text).not.toContain("Andrea");
    expect(text).not.toContain("Fernando");
    expect(text).not.toContain("Nos casamos");
  });

  it("usa las variantes de layout de Level 12 (hero centered, locations stacked, gallery grid, timeline vertical)", () => {
    expect(html).toContain('data-hero-layout="centered"');
    expect(html).toContain('data-locations-layout="stacked"');
    expect(html).toContain('data-gallery-layout="grid"');
    expect(html).toContain('data-timeline-layout="vertical"');
  });

  it("el enlace de la sede y la paleta de dress code salen de la invitación", () => {
    for (const location of invitation.locations) expect(html).toContain(`href="${escapeHtml(location.mapUrl ?? "")}"`);
    for (const swatch of invitation.dressCode?.palette ?? []) expect(html).toContain(`aria-label="${swatch.name}"`);
  });

  it("la mesa de regalos no tiene tiendas (solo el mensaje): no rompe la sección", () => {
    expect(invitation.giftRegistry?.entries).toEqual([]);
    expect(visibleText(html)).toContain("Tu presencia es el mejor regalo");
  });
});

describe("Level 12: cuenta regresiva y fecha", () => {
  const spoken = (html: string) => /role="timer" aria-label="([^"]*)"/.exec(html)?.[1];

  it("muestra los días, horas y minutos que faltan hasta invitation.event.startsAt", () => {
    const parts = getCountdown(invitation.event.startsAt, NOW);
    expect(spoken(render(invitation, level12Template))).toBe(`${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`);
  });
});

describe("Level 12: assets de la plantilla pertenecen solo a Level 12", () => {
  const html = render(invitation, level12Template);

  it("el fondo de portada y las esquinas vienen de /templates/level-12, nunca de magnolia", () => {
    expect(html).toContain(encoded("/templates/level-12/cover-bg.png"));
    expect(html).toContain(encoded("/templates/level-12/decor-corners.png"));
    expect(html).not.toContain(encoded("/templates/magnolia/cover-bg.png"));
    expect(html).not.toContain(encoded("/templates/magnolia/decor-corners.png"));
  });

  it("las fotos de contenido (galería, sede, dress code, regalos) son de /templates/level-12", () => {
    const photos = [
      ...invitation.locations.map((l) => l.photo?.src),
      ...invitation.gallery.map((g) => g.src),
      invitation.dressCode?.illustration?.src,
      invitation.giftRegistry?.photo?.src,
    ].filter((src): src is string => Boolean(src));
    expect(photos.length).toBe(8);
    for (const src of photos) {
      expect(src.startsWith("/templates/level-12/"), src).toBe(true);
      expect(html, src).toContain(encoded(src));
    }
  });
});

describe("Level 12: secciones ocultas e imágenes opcionales", () => {
  it("una sección oculta no se dibuja (ni sus imágenes) y sus datos permanecen", () => {
    const hidden: Invitation = {
      ...invitation,
      sections: invitation.sections.map((section) => (["gallery", "giftRegistry"].includes(section.type) ? { ...section, isVisible: false } : section)),
    };
    const hiddenHtml = render(hidden, level12Template);
    expect(hiddenHtml).not.toContain('data-section="gallery"');
    expect(hiddenHtml).not.toContain('data-section="giftRegistry"');
    expect(hiddenHtml).not.toContain(encoded("/templates/level-12/gallery-1.png"));
    expect(hiddenHtml).not.toContain(encoded("/templates/level-12/gift-registry.png"));
    expect(hiddenHtml).toContain('data-section="timeline"');
    expect(hidden.gallery).toEqual(invitation.gallery);
  });

  it("sin imágenes opcionales no rompe el renderizador", () => {
    const withoutImages: Invitation = {
      ...invitation,
      gallery: invitation.gallery.map(({ src, width, height, ...rest }) => {
        void src;
        void width;
        void height;
        return rest;
      }),
      dressCode: invitation.dressCode && { ...invitation.dressCode, illustration: undefined },
      giftRegistry: invitation.giftRegistry && { ...invitation.giftRegistry, photo: undefined },
      locations: invitation.locations.map((location) => ({ ...location, photo: undefined })),
    };
    expect(() => render(withoutImages, level12Template)).not.toThrow();
    const text = visibleText(render(withoutImages, level12Template));
    expect(text).toContain("Santiago");
    expect(text).toContain("Zona Gamer");
    expect(text).toContain("Confirmar asistencia");
  });
});

describe("Level 12: rendimiento y accesibilidad de las imágenes", () => {
  const html = render(invitation, level12Template);
  const tags = images(html);

  it("todas las imágenes usan next/image con width, height y sizes (sin salto de diseño)", () => {
    expect(tags.length).toBeGreaterThanOrEqual(10);
    for (const tag of tags) {
      expect(tag, tag).toContain("/_next/image?url=");
      expect(attr(tag, "width"), tag).toMatch(/^\d+$/);
      expect(attr(tag, "height"), tag).toMatch(/^\d+$/);
      expect(attr(tag, "sizes"), tag).toBeTruthy();
    }
  });

  it("solo la imagen principal de la portada tiene prioridad; el resto carga de forma diferida", () => {
    const eager = tags.filter((tag) => attr(tag, "loading") !== "lazy");
    expect(eager).toHaveLength(1);
    expect(eager[0]).toContain(encoded("/templates/level-12/cover-bg.png"));
    for (const tag of tags.filter((t) => t !== eager[0])) expect(attr(tag, "loading"), tag).toBe("lazy");
  });

  it("las imágenes de contenido tienen alt descriptivo y las decorativas alt vacío", () => {
    for (const tag of tags) {
      const alt = attr(tag, "alt");
      expect(alt, tag).toBeDefined();
      const decorative = tag.includes(encoded("/templates/level-12/decor-corners.png")) || tag.includes(encoded("/templates/level-12/cover-bg.png"));
      if (decorative) expect(alt).toBe("");
      else expect((alt ?? "").length, tag).toBeGreaterThan(8);
    }
  });

  it("no se usan imágenes en base64 ni recursos externos", () => {
    expect(html).not.toMatch(/src="data:/);
    expect(html).not.toMatch(/src="https?:/);
  });
});
