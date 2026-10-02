import { describe, expect, it } from "vitest";
import { getCountdown } from "@/lib/invitation/countdown";
import { valentinaAuroraXvInvitation } from "@/lib/invitation/mock/valentina-aurora-xv";
import { auroraXvTemplate } from "@/lib/invitation/templates/aurora-xv";
import type { Invitation } from "@/types/invitation";
import { NOW, render, visibleText } from "./helpers";

const invitation = valentinaAuroraXvInvitation;
const encoded = (path: string) => encodeURIComponent(path);
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;");

const images = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];

describe("Aurora XV (plantilla terminada, D-39)", () => {
  const html = render(invitation, auroraXvTemplate);

  it("renderiza todas las secciones activas, en el orden de los datos", () => {
    const visible = invitation.sections.filter((section) => section.isVisible);
    expect(visible).toHaveLength(10);
    for (const section of visible) expect(html, section.id).toContain(`id="${section.id}"`);

    const positions = visible.map((section) => html.indexOf(`id="${section.id}"`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("dibuja el contenido de Valentina desde la invitación (no el de Andrea & Fernando ni el de Santiago)", () => {
    const text = visibleText(html);
    for (const expected of [
      "Valentina",
      "Mis XV años",
      "Abrir invitación",
      "Un sueño hecho realidad",
      "Hay momentos que se sueñan toda la vida",
      "Con mucha ilusión",
      "Faltan",
      "Parroquia de San Jerónimo",
      "Salón Aurora",
      "Cómo llegar",
      "Itinerario",
      "Ceremonia",
      "Entrada de la quinceañera",
      "Vals",
      "Momentos inolvidables",
      "Formal elegante",
      "Nos encantaría que nos acompañes",
      "Tu presencia es el regalo más especial",
      "Confirmar asistencia",
      "Modo demostración",
      "Gracias por formar parte de este sueño",
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(text).not.toContain("Andrea");
    expect(text).not.toContain("Fernando");
    expect(text).not.toContain("Santiago");
    expect(text).not.toContain("Nivel 12");
  });

  it("usa las variantes de layout de Aurora XV (hero centered, locations split, gallery grid, timeline vertical)", () => {
    expect(html).toContain('data-hero-layout="centered"');
    expect(html).toContain('data-locations-layout="split"');
    expect(html).toContain('data-gallery-layout="grid"');
    expect(html).toContain('data-timeline-layout="vertical"');
  });

  it("los enlaces de las sedes y la paleta de dress code salen de la invitación", () => {
    for (const location of invitation.locations) expect(html).toContain(`href="${escapeHtml(location.mapUrl ?? "")}"`);
    for (const swatch of invitation.dressCode?.palette ?? []) expect(html).toContain(`aria-label="${swatch.name}"`);
  });

  it("tiene dos sedes (ceremonia y recepción), como Magnolia", () => {
    expect(invitation.locations.map((l) => l.kind)).toEqual(["ceremony", "reception"]);
  });

  it("la mesa de regalos no tiene tiendas (solo el mensaje): no rompe la sección", () => {
    expect(invitation.giftRegistry?.entries).toEqual([]);
    expect(visibleText(html)).toContain("Tu presencia es el regalo más especial");
  });
});

describe("Aurora XV: cuenta regresiva y fecha", () => {
  const spoken = (html: string) => /role="timer" aria-label="([^"]*)"/.exec(html)?.[1];

  it("muestra los días, horas y minutos que faltan hasta invitation.event.startsAt", () => {
    const parts = getCountdown(invitation.event.startsAt, NOW);
    expect(spoken(render(invitation, auroraXvTemplate))).toBe(`${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`);
  });
});

describe("Aurora XV: assets de la plantilla pertenecen solo a Aurora XV", () => {
  const html = render(invitation, auroraXvTemplate);

  it("el fondo de portada y las esquinas vienen de /templates/aurora-xv, nunca de otra plantilla", () => {
    expect(html).toContain(encoded("/templates/aurora-xv/cover-bg.png"));
    expect(html).toContain(encoded("/templates/aurora-xv/decor-corners.png"));
    for (const other of ["magnolia", "level-12"]) {
      expect(html).not.toContain(encoded(`/templates/${other}/cover-bg.png`));
      expect(html).not.toContain(encoded(`/templates/${other}/decor-corners.png`));
    }
  });

  it("las fotos de contenido (sedes, galería, dress code, regalos) son de /templates/aurora-xv", () => {
    const photos = [
      ...invitation.locations.map((l) => l.photo?.src),
      ...invitation.gallery.map((g) => g.src),
      invitation.dressCode?.illustration?.src,
      invitation.giftRegistry?.photo?.src,
    ].filter((src): src is string => Boolean(src));
    expect(photos.length).toBe(9);
    for (const src of photos) {
      expect(src.startsWith("/templates/aurora-xv/"), src).toBe(true);
      expect(html, src).toContain(encoded(src));
    }
  });
});

describe("Aurora XV: secciones ocultas e imágenes opcionales", () => {
  it("una sección oculta no se dibuja (ni sus imágenes) y sus datos permanecen", () => {
    const hidden: Invitation = {
      ...invitation,
      sections: invitation.sections.map((section) => (["gallery", "giftRegistry"].includes(section.type) ? { ...section, isVisible: false } : section)),
    };
    const hiddenHtml = render(hidden, auroraXvTemplate);
    expect(hiddenHtml).not.toContain('data-section="gallery"');
    expect(hiddenHtml).not.toContain('data-section="giftRegistry"');
    expect(hiddenHtml).not.toContain(encoded("/templates/aurora-xv/gallery-1.png"));
    expect(hiddenHtml).not.toContain(encoded("/templates/aurora-xv/gift-registry.png"));
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
    expect(() => render(withoutImages, auroraXvTemplate)).not.toThrow();
    const text = visibleText(render(withoutImages, auroraXvTemplate));
    expect(text).toContain("Valentina");
    expect(text).toContain("Parroquia de San Jerónimo");
    expect(text).toContain("Confirmar asistencia");
  });
});

describe("Aurora XV: rendimiento y accesibilidad de las imágenes", () => {
  const html = render(invitation, auroraXvTemplate);
  const tags = images(html);

  it("todas las imágenes usan next/image con width, height y sizes (sin salto de diseño)", () => {
    expect(tags.length).toBeGreaterThanOrEqual(11);
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
    expect(eager[0]).toContain(encoded("/templates/aurora-xv/cover-bg.png"));
    for (const tag of tags.filter((t) => t !== eager[0])) expect(attr(tag, "loading"), tag).toBe("lazy");
  });

  it("las imágenes de contenido tienen alt descriptivo y las decorativas alt vacío", () => {
    for (const tag of tags) {
      const alt = attr(tag, "alt");
      expect(alt, tag).toBeDefined();
      const decorative = tag.includes(encoded("/templates/aurora-xv/decor-corners.png")) || tag.includes(encoded("/templates/aurora-xv/cover-bg.png"));
      if (decorative) expect(alt).toBe("");
      else expect((alt ?? "").length, tag).toBeGreaterThan(8);
    }
  });

  it("no se usan imágenes en base64 ni recursos externos", () => {
    expect(html).not.toMatch(/src="data:/);
    expect(html).not.toMatch(/src="https?:/);
  });
});
