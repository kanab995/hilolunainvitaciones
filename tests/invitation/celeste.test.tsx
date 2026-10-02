import { describe, expect, it } from "vitest";
import { getCountdown } from "@/lib/invitation/countdown";
import { mateoCelesteInvitation } from "@/lib/invitation/mock/mateo-celeste";
import { celesteTemplate } from "@/lib/invitation/templates/celeste";
import type { Invitation } from "@/types/invitation";
import { NOW, render, visibleText } from "./helpers";

const invitation = mateoCelesteInvitation;
const encoded = (path: string) => encodeURIComponent(path);
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;");

const images = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];

describe("Celeste (plantilla terminada, D-43)", () => {
  const html = render(invitation, celesteTemplate);

  it("renderiza todas las secciones activas, en el orden de los datos", () => {
    const visible = invitation.sections.filter((section) => section.isVisible);
    expect(visible).toHaveLength(10);
    for (const section of visible) expect(html, section.id).toContain(`id="${section.id}"`);

    const positions = visible.map((section) => html.indexOf(`id="${section.id}"`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("dibuja el contenido de Mateo desde la invitación (no el de otras demos)", () => {
    const text = visibleText(html);
    for (const expected of [
      "Mateo",
      "Mi Bautizo",
      "Abrir invitación",
      "Un momento de fe",
      "Hoy recibo la luz de Dios",
      "Con mucha alegría",
      "Faltan",
      "Parroquia de San Jerónimo",
      "Jardín Los Olivos",
      "Cómo llegar",
      "Itinerario",
      "Ceremonia religiosa",
      "Comida familiar",
      "Momentos de bendición",
      "Tonos claros",
      "Tu presencia es el regalo más especial",
      "Confirmar asistencia",
      "Gracias por ser parte de esta bendición",
    ]) {
      expect(text, expected).toContain(expected);
    }
    // `mateoCelesteInvitation.slug` es "mateo-celeste" (no "demo-…"): el aviso de modo demostración NO se
    // muestra con este slug (tests/rsvp/ui-and-policy.test.tsx cubre /i/demo-celeste).
    expect(text).not.toContain("Modo demostración");
    expect(text).not.toContain("Andrea");
    expect(text).not.toContain("Valentina");
    expect(text).not.toContain("Santiago");
  });

  it("usa las variantes de layout de Celeste (hero centered, locations split, gallery grid, timeline vertical)", () => {
    expect(html).toContain('data-hero-layout="centered"');
    expect(html).toContain('data-locations-layout="split"');
    expect(html).toContain('data-gallery-layout="grid"');
    expect(html).toContain('data-timeline-layout="vertical"');
  });

  it("los enlaces de las sedes y la paleta de dress code salen de la invitación", () => {
    for (const location of invitation.locations) expect(html).toContain(`href="${escapeHtml(location.mapUrl ?? "")}"`);
    for (const swatch of invitation.dressCode?.palette ?? []) expect(html).toContain(`aria-label="${swatch.name}"`);
  });

  it("tiene dos sedes (ceremonia y recepción)", () => {
    expect(invitation.locations.map((l) => l.kind)).toEqual(["ceremony", "reception"]);
  });

  it("la mesa de regalos no tiene tiendas (solo el mensaje): no rompe la sección", () => {
    expect(invitation.giftRegistry?.entries).toEqual([]);
    expect(visibleText(html)).toContain("Tu presencia es el regalo más especial");
  });
});

describe("Celeste: cuenta regresiva y fecha", () => {
  const spoken = (html: string) => /role="timer" aria-label="([^"]*)"/.exec(html)?.[1];

  it("muestra los días, horas y minutos que faltan hasta invitation.event.startsAt", () => {
    const parts = getCountdown(invitation.event.startsAt, NOW);
    expect(spoken(render(invitation, celesteTemplate))).toBe(`${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`);
  });
});

describe("Celeste: assets de la plantilla pertenecen solo a Celeste", () => {
  const html = render(invitation, celesteTemplate);

  it("el fondo de portada y las esquinas vienen de /templates/celeste, nunca de otra plantilla", () => {
    expect(html).toContain(encoded("/templates/celeste/cover-bg.png"));
    expect(html).toContain(encoded("/templates/celeste/decor-corners.png"));
    for (const other of ["magnolia", "level-12", "aurora-xv"]) {
      expect(html).not.toContain(encoded(`/templates/${other}/cover-bg.png`));
      expect(html).not.toContain(encoded(`/templates/${other}/decor-corners.png`));
    }
  });

  it("las fotos de contenido (sedes, galería, dress code, regalos) son de /templates/celeste", () => {
    const photos = [
      ...invitation.locations.map((l) => l.photo?.src),
      ...invitation.gallery.map((g) => g.src),
      invitation.dressCode?.illustration?.src,
      invitation.giftRegistry?.photo?.src,
    ].filter((src): src is string => Boolean(src));
    expect(photos.length).toBe(9);
    for (const src of photos) {
      expect(src.startsWith("/templates/celeste/"), src).toBe(true);
      expect(html, src).toContain(encoded(src));
    }
  });
});

describe("Celeste: secciones ocultas e imágenes opcionales", () => {
  it("una sección oculta no se dibuja (ni sus imágenes) y sus datos permanecen", () => {
    const hidden: Invitation = {
      ...invitation,
      sections: invitation.sections.map((section) => (["gallery", "giftRegistry"].includes(section.type) ? { ...section, isVisible: false } : section)),
    };
    const hiddenHtml = render(hidden, celesteTemplate);
    expect(hiddenHtml).not.toContain('data-section="gallery"');
    expect(hiddenHtml).not.toContain('data-section="giftRegistry"');
    expect(hiddenHtml).not.toContain(encoded("/templates/celeste/gallery-1.png"));
    expect(hiddenHtml).not.toContain(encoded("/templates/celeste/gift-registry.png"));
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
    expect(() => render(withoutImages, celesteTemplate)).not.toThrow();
    const text = visibleText(render(withoutImages, celesteTemplate));
    expect(text).toContain("Mateo");
    expect(text).toContain("Parroquia de San Jerónimo");
    expect(text).toContain("Confirmar asistencia");
  });
});

describe("Celeste: rendimiento y accesibilidad de las imágenes", () => {
  const html = render(invitation, celesteTemplate);
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
    expect(eager[0]).toContain(encoded("/templates/celeste/cover-bg.png"));
    for (const tag of tags.filter((t) => t !== eager[0])) expect(attr(tag, "loading"), tag).toBe("lazy");
  });

  it("las imágenes de contenido tienen alt descriptivo y las decorativas alt vacío", () => {
    for (const tag of tags) {
      const alt = attr(tag, "alt");
      expect(alt, tag).toBeDefined();
      const decorative = tag.includes(encoded("/templates/celeste/decor-corners.png")) || tag.includes(encoded("/templates/celeste/cover-bg.png"));
      if (decorative) expect(alt).toBe("");
      else expect((alt ?? "").length, tag).toBeGreaterThan(8);
    }
  });

  it("no se usan imágenes en base64 ni recursos externos", () => {
    expect(html).not.toMatch(/src="data:/);
    expect(html).not.toMatch(/src="https?:/);
  });
});
