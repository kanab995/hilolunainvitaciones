import { describe, expect, it } from "vitest";
import { changeTemplate, contentFingerprint } from "@/lib/invitation/change-template";
import { getCountdown } from "@/lib/invitation/countdown";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { invitationTemplates } from "@/lib/invitation/templates";
import { ivoryTemplate } from "@/lib/invitation/templates/ivory";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import type { Invitation } from "@/types/invitation";
import { NOW, render, visibleText } from "./helpers";

const invitation = andreaFernandoInvitation;
const encoded = (path: string) => encodeURIComponent(path);
/** React escapa `&` como `&amp;` dentro de los atributos. */
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;");

const images = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];

describe("Magnolia (plantilla terminada)", () => {
  const html = render(invitation, magnoliaTemplate);

  it("renderiza todas las secciones activas, en el orden de los datos", () => {
    const visible = invitation.sections.filter((section) => section.isVisible);
    expect(visible).toHaveLength(10);
    for (const section of visible) expect(html, section.id).toContain(`id="${section.id}"`);

    const positions = visible.map((section) => html.indexOf(`id="${section.id}"`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("dibuja el contenido de cada sección desde la invitación", () => {
    const text = visibleText(html);
    for (const expected of [
      "17 · 05 · 27",
      "Andrea",
      "Fernando",
      "Nos encantaría celebrar contigo",
      "Abrir invitación",
      "Nuestra historia",
      "Faltan",
      "Parroquia de San Miguel Arcángel",
      "Hacienda Los Olivos",
      "Cómo llegar",
      "Itinerario",
      "Un día lleno de momentos especiales",
      "Nuestros momentos",
      "Formal y elegante",
      "Tu presencia es nuestro mejor regalo",
      "Ver más opciones",
      "Confirmar asistencia",
      "Modo demostración",
      "la respuesta no se guarda",
      "Gracias por ser parte de nuestra historia",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("usa las variantes de layout de Magnolia (hero centered, locations split, gallery grid, timeline horizontal)", () => {
    expect(html).toContain('data-hero-layout="centered"');
    expect(html).toContain('data-locations-layout="split"');
    expect(html).toContain('data-gallery-layout="grid"');
    expect(html).toContain('data-timeline-layout="horizontal"');
  });

  it("los enlaces de las sedes y de la mesa de regalos salen de la invitación", () => {
    for (const location of invitation.locations) {
      expect(html).toContain(`href="${escapeHtml(location.mapUrl ?? "")}"`);
    }
    for (const entry of invitation.giftRegistry?.entries ?? []) {
      expect(html).toContain(`href="${escapeHtml(entry.url)}"`);
    }
  });

  it("la mesa de regalos muestra nombres como texto, sin logos de terceros", () => {
    expect(visibleText(html)).toContain("Liverpool");
    expect(html.toLowerCase()).not.toMatch(/liverpool[^"]*\.(png|svg|jpg|webp)|amazon[^"]*\.(png|svg|jpg|webp)|sears[^"]*\.(png|svg|jpg|webp)/);
  });
});

describe("cuenta regresiva: la fecha viene de la invitación", () => {
  const spoken = (html: string) => /role="timer" aria-label="([^"]*)"/.exec(html)?.[1];

  it("muestra los días, horas y minutos que faltan hasta invitation.event.startsAt", () => {
    const parts = getCountdown(invitation.event.startsAt, NOW);
    expect(spoken(render(invitation, magnoliaTemplate))).toBe(`${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`);
  });

  it("al cambiar la fecha de la invitación cambia la cuenta regresiva (no hay fecha en la plantilla)", () => {
    const later: Invitation = { ...invitation, event: { ...invitation.event, startsAt: "2028-01-01T17:00:00-06:00" } };
    const before = spoken(render(invitation, magnoliaTemplate));
    const after = spoken(render(later, magnoliaTemplate));
    expect(after).not.toBe(before);
    expect(after).toBe(`${getCountdown(later.event.startsAt, NOW).days} días, ${getCountdown(later.event.startsAt, NOW).hours} horas y ${getCountdown(later.event.startsAt, NOW).minutes} minutos`);
  });

  it("la fecha compacta de la portada y del cierre también sale de la invitación", () => {
    const moved: Invitation = { ...invitation, event: { ...invitation.event, startsAt: "2028-03-04T17:00:00-06:00" } };
    const text = visibleText(render(moved, magnoliaTemplate));
    expect(text).toContain("04 · 03 · 28");
    expect(text).not.toContain("17 · 05 · 27");
  });
});

describe("Magnolia → Ivory mantiene exactamente los mismos datos", () => {
  const magnolia = render(invitation, magnoliaTemplate);
  const ivory = render(invitation, ivoryTemplate);

  it("la huella del contenido no cambia al cambiar de plantilla", () => {
    const changed = changeTemplate(invitation, "ivory");
    expect(changed.templateSlug).toBe("ivory");
    expect(contentFingerprint(changed)).toBe(contentFingerprint(invitation));
  });

  it("las fotografías de la invitación (contenido) aparecen con ambas plantillas", () => {
    const photos = [
      ...invitation.locations.map((l) => l.photo?.src),
      ...invitation.gallery.map((g) => g.src),
      invitation.dressCode?.illustration?.src,
      invitation.giftRegistry?.photo?.src,
    ].filter((src): src is string => Boolean(src));
    expect(photos.length).toBe(8);
    for (const src of photos) {
      expect(magnolia, src).toContain(encoded(src));
      expect(ivory, src).toContain(encoded(src));
    }
  });

  it("los assets de la plantilla (fondo y esquinas) pertenecen solo a Magnolia", () => {
    expect(magnolia).toContain(encoded("/templates/magnolia/cover-bg.png"));
    expect(magnolia).toContain(encoded("/templates/magnolia/decor-corners.png"));
    expect(ivory).not.toContain(encoded("/templates/magnolia/cover-bg.png"));
    expect(ivory).not.toContain(encoded("/templates/magnolia/decor-corners.png"));
  });

  it("el texto visible es idéntico", () => {
    expect(visibleText(ivory)).toBe(visibleText(magnolia));
  });
});

describe("secciones ocultas", () => {
  it("una sección con isVisible=false no se renderiza (ni sus imágenes) y sus datos permanecen", () => {
    const hidden: Invitation = {
      ...invitation,
      sections: invitation.sections.map((section) => (["gallery", "giftRegistry"].includes(section.type) ? { ...section, isVisible: false } : section)),
    };
    for (const template of invitationTemplates) {
      const html = render(hidden, template);
      expect(html).not.toContain('data-section="gallery"');
      expect(html).not.toContain('data-section="giftRegistry"');
      expect(html).not.toContain(encoded("/templates/magnolia/gallery-couple.png"));
      expect(html).not.toContain(encoded("/templates/magnolia/gift-registry.png"));
      expect(html).toContain('data-section="timeline"');
    }
    expect(hidden.gallery).toHaveLength(4);
    expect(hidden.giftRegistry?.photo?.src).toBe("/templates/magnolia/gift-registry.png");
  });
});

describe("imágenes opcionales ausentes", () => {
  const withoutImages: Invitation = {
    ...invitation,
    cover: { ...invitation.cover, photo: undefined },
    locations: invitation.locations.map((location) => ({ ...location, photo: undefined })),
    gallery: invitation.gallery.map(({ src, width, height, ...rest }) => {
      void src;
      void width;
      void height;
      return rest;
    }),
    dressCode: invitation.dressCode && { ...invitation.dressCode, illustration: undefined },
    giftRegistry: invitation.giftRegistry && { ...invitation.giftRegistry, photo: undefined },
  };

  it.each(invitationTemplates.map((template) => [template.slug, template] as const))("%s: no rompe el renderizador", (_slug, template) => {
    expect(() => render(withoutImages, template)).not.toThrow();
    const html = render(withoutImages, template);
    const text = visibleText(html);
    expect(text).toContain("Andrea");
    expect(text).toContain("Parroquia de San Miguel Arcángel");
    expect(text).toContain("Confirmar asistencia");
    // Ninguna foto del contenido: solo puede quedar la decoración de la propia plantilla.
    expect(html).not.toContain(encoded("/templates/magnolia/gallery-couple.png"));
    expect(html).not.toContain(encoded("/templates/magnolia/ceremony-chapel.png"));
  });

  it("sin datos opcionales completos (dress code, regalos, música) tampoco falla", () => {
    const minimal: Invitation = { ...withoutImages, dressCode: undefined, giftRegistry: undefined, music: undefined, gallery: [], timeline: [] };
    for (const template of invitationTemplates) expect(() => render(minimal, template)).not.toThrow();
  });
});

describe("rendimiento y accesibilidad de las imágenes", () => {
  const html = render(invitation, magnoliaTemplate);
  const tags = images(html);

  it("todas las imágenes usan next/image con width, height y sizes (sin salto de diseño)", () => {
    expect(tags.length).toBeGreaterThanOrEqual(14);
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
    expect(eager[0]).toContain(encoded("/templates/magnolia/cover-bg.png"));
    for (const tag of tags.filter((t) => t !== eager[0])) expect(attr(tag, "loading"), tag).toBe("lazy");
  });

  it("las imágenes de contenido tienen alt descriptivo y las decorativas alt vacío", () => {
    for (const tag of tags) {
      const alt = attr(tag, "alt");
      expect(alt, tag).toBeDefined();
      const decorative = tag.includes(encoded("/templates/magnolia/decor-corners.png")) || tag.includes(encoded("/templates/magnolia/cover-bg.png"));
      if (decorative) expect(alt).toBe("");
      else expect((alt ?? "").length, tag).toBeGreaterThan(8);
    }
  });

  it("la paleta del dress code tiene nombre accesible", () => {
    for (const swatch of invitation.dressCode?.palette ?? []) expect(html).toContain(`aria-label="${swatch.name}"`);
  });

  it("no se usan imágenes en base64 ni recursos externos", () => {
    expect(html).not.toMatch(/src="data:/);
    expect(html).not.toMatch(/src="https?:/);
  });
});

describe("la portada no depende de la plantilla para el contenido", () => {
  it("el fondo lo aporta la plantilla; el usuario puede sustituirlo con su propia foto de portada", () => {
    const own: Invitation = { ...invitation, cover: { ...invitation.cover, photo: { src: "/uploads/mi-foto.png", alt: "Nosotros", width: 800, height: 1000 } } };
    const html = render(own, magnoliaTemplate);
    expect(html).toContain(encoded("/uploads/mi-foto.png"));
    expect(html).not.toContain(encoded("/templates/magnolia/cover-bg.png"));
  });
});
