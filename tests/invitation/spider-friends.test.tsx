import { describe, expect, it } from "vitest";
import { getCountdown } from "@/lib/invitation/countdown";
import { nicoSpiderFriendsInvitation } from "@/lib/invitation/mock/nico-spider-friends";
import { spiderFriendsTemplate } from "@/lib/invitation/templates/spider-friends";
import type { Invitation } from "@/types/invitation";
import { NOW, render, visibleText } from "./helpers";

const invitation = nicoSpiderFriendsInvitation;
const encoded = (path: string) => encodeURIComponent(path);

const images = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
/** React escapa `&` como `&amp;` dentro de los atributos. */
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;");

describe("Spider Friends (plantilla terminada)", () => {
  const html = render(invitation, spiderFriendsTemplate);

  it("renderiza todas las secciones activas, en el orden de los datos", () => {
    const visible = invitation.sections.filter((section) => section.isVisible);
    expect(visible).toHaveLength(10);
    for (const section of visible) expect(html, section.id).toContain(`id="${section.id}"`);

    const positions = visible.map((section) => html.indexOf(`id="${section.id}"`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("dibuja el contenido de Nico desde la invitación (no el de otras demos)", () => {
    const text = visibleText(html);
    for (const expected of [
      "Nico",
      "¡Nico cumple 6!",
      "Una aventura de superhéroes",
      "Abrir invitación",
      "Una misión especial",
      "Prepara tu antifaz",
      "Nuestro pequeño héroe",
      "Faltan",
      "Salón Ciudad Aventura",
      "Av. de los Héroes 456",
      "Cómo llegar",
      "Itinerario",
      "Llegada de pequeños héroes",
      "Juegos y misiones",
      "Pastel",
      "Piñata",
      "Momentos de aventura",
      "Viste como héroe",
      "Ven con tu outfit de héroe favorito",
      "Tu presencia es el mejor regalo",
      "Confirmar asistencia",
      "Confirma si vienes a esta misión especial",
      "¡Gracias por ser parte de esta aventura!",
    ]) {
      expect(text, expected).toContain(expected);
    }
    // `nicoSpiderFriendsInvitation.slug` es "nico-spider-friends" (no "demo-…"): el aviso de modo
    // demostración NO se muestra con este slug (tests/rsvp/ui-and-policy.test.tsx cubre /i/demo-spider-friends).
    expect(text).not.toContain("Modo demostración");
    expect(text).not.toContain("Andrea");
    expect(text).not.toContain("Santiago");
    expect(text).not.toContain("Valentina");
    expect(text).not.toContain("Mateo");
  });

  it("usa las variantes de layout de Spider Friends (hero centered, locations stacked, gallery grid, timeline vertical)", () => {
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

describe("Spider Friends: cuenta regresiva y fecha", () => {
  const spoken = (html: string) => /role="timer" aria-label="([^"]*)"/.exec(html)?.[1];

  it("muestra los días, horas y minutos que faltan hasta invitation.event.startsAt", () => {
    const parts = getCountdown(invitation.event.startsAt, NOW);
    expect(spoken(render(invitation, spiderFriendsTemplate))).toBe(`${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`);
  });
});

describe("Spider Friends: assets de la plantilla pertenecen solo a Spider Friends", () => {
  const html = render(invitation, spiderFriendsTemplate);

  it("el fondo de portada y las esquinas vienen de /templates/spider-friends, nunca de otra plantilla", () => {
    expect(html).toContain(encoded("/templates/spider-friends/cover-bg.png"));
    expect(html).toContain(encoded("/templates/spider-friends/decor-corners.png"));
    for (const other of ["magnolia", "level-12", "aurora-xv", "celeste"]) {
      expect(html).not.toContain(encoded(`/templates/${other}/cover-bg.png`));
      expect(html).not.toContain(encoded(`/templates/${other}/decor-corners.png`));
    }
  });

  it("las fotos de contenido (sede, galería, dress code, regalos) son de /templates/spider-friends", () => {
    const photos = [
      ...invitation.locations.map((l) => l.photo?.src),
      ...invitation.gallery.map((g) => g.src),
      invitation.dressCode?.illustration?.src,
      invitation.giftRegistry?.photo?.src,
    ].filter((src): src is string => Boolean(src));
    expect(photos.length).toBe(8);
    for (const src of photos) {
      expect(src.startsWith("/templates/spider-friends/"), src).toBe(true);
      expect(html, src).toContain(encoded(src));
    }
  });
});

describe("Spider Friends: sin personajes registrados en ningún texto público", () => {
  it("ningún texto visible menciona Spidey, Spider-Man, Marvel ni Disney", () => {
    const text = visibleText(render(invitation, spiderFriendsTemplate));
    for (const forbidden of ["Spidey", "Spider-Man", "Spiderman", "Marvel", "Disney"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it("ni el slug, el nombre ni la descripción de la plantilla usan esas palabras", () => {
    const haystack = [spiderFriendsTemplate.slug, spiderFriendsTemplate.name].join(" ").toLowerCase();
    for (const forbidden of ["spidey", "spider-man", "spiderman", "marvel", "disney"]) {
      expect(haystack, forbidden).not.toContain(forbidden);
    }
  });
});

describe("Spider Friends: secciones ocultas e imágenes opcionales", () => {
  it("una sección oculta no se dibuja (ni sus imágenes) y sus datos permanecen", () => {
    const hidden: Invitation = {
      ...invitation,
      sections: invitation.sections.map((section) => (["gallery", "giftRegistry"].includes(section.type) ? { ...section, isVisible: false } : section)),
    };
    const hiddenHtml = render(hidden, spiderFriendsTemplate);
    expect(hiddenHtml).not.toContain('data-section="gallery"');
    expect(hiddenHtml).not.toContain('data-section="giftRegistry"');
    expect(hiddenHtml).not.toContain(encoded("/templates/spider-friends/gallery-1.png"));
    expect(hiddenHtml).not.toContain(encoded("/templates/spider-friends/gift-registry.png"));
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
    expect(() => render(withoutImages, spiderFriendsTemplate)).not.toThrow();
    const text = visibleText(render(withoutImages, spiderFriendsTemplate));
    expect(text).toContain("Nico");
    expect(text).toContain("Salón Ciudad Aventura");
    expect(text).toContain("Confirmar asistencia");
  });
});

describe("Spider Friends: rendimiento y accesibilidad de las imágenes", () => {
  const html = render(invitation, spiderFriendsTemplate);
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
    expect(eager[0]).toContain(encoded("/templates/spider-friends/cover-bg.png"));
    for (const tag of tags.filter((t) => t !== eager[0])) expect(attr(tag, "loading"), tag).toBe("lazy");
  });

  it("las imágenes de contenido tienen alt descriptivo y las decorativas alt vacío", () => {
    for (const tag of tags) {
      const alt = attr(tag, "alt");
      expect(alt, tag).toBeDefined();
      const decorative = tag.includes(encoded("/templates/spider-friends/decor-corners.png")) || tag.includes(encoded("/templates/spider-friends/cover-bg.png"));
      if (decorative) expect(alt).toBe("");
      else expect((alt ?? "").length, tag).toBeGreaterThan(8);
    }
  });

  it("no se usan imágenes en base64 ni recursos externos", () => {
    expect(html).not.toMatch(/src="data:/);
    expect(html).not.toMatch(/src="https?:/);
  });
});
