import { describe, expect, it } from "vitest";
import { getTemplateEventLabel, templates } from "@/lib/content/templates";
import { withAssetVersion } from "@/lib/images/asset-version";
import { getCountdown } from "@/lib/invitation/countdown";
import { camilaNovaGradInvitation } from "@/lib/invitation/mock/camila-nova-grad";
import { getMockInvitation, STANDALONE_DEMO_BASES } from "@/lib/invitation/mock";
import { sofiaLuzDeFeInvitation } from "@/lib/invitation/mock/sofia-luz-de-fe";
import { valeriaMateoMarDeAmorInvitation } from "@/lib/invitation/mock/valeria-mateo-mar-de-amor";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { getInvitationTemplate, invitationTemplates } from "@/lib/invitation/templates";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { cormorantInter } from "@/lib/invitation/templates/fonts";
import { luzDeFeTemplate } from "@/lib/invitation/templates/luz-de-fe";
import { marDeAmorTemplate } from "@/lib/invitation/templates/mar-de-amor";
import { novaGradTemplate } from "@/lib/invitation/templates/nova-grad";
import { templateToCssVars } from "@/lib/invitation/styles";
import { getTemplateCoverImage, isTemplateReady } from "@/lib/templates/status";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import { NOW, render, visibleText } from "./helpers";

/**
 * Luz de Fe, Mar de Amor y Nova Grad (D-45): las tres comparten esta batería porque se construyeron
 * con el mismo contrato (tema + demo + 11 ilustraciones propias + variantes de bloque nuevas).
 */
interface Case {
  slug: string;
  template: InvitationTemplate;
  invitation: Invitation;
  /** Textos de la demo que DEBEN verse. */
  texts: readonly string[];
  /** Nombres de OTRAS demos que nunca deben aparecer. */
  foreign: readonly string[];
  eventType: Invitation["eventType"];
  layout: { hero: string; locations: string; gallery: string; timeline: string };
  /** Cuántas fotos de contenido (sedes + galería + código de vestimenta + regalos visibles) lleva la demo. */
  photos: number;
  /** Nombre de archivo del asset de cada sede (para comprobar que viene de su carpeta). */
  hiddenSections?: readonly string[];
}

const CASES: readonly Case[] = [
  {
    slug: "luz-de-fe",
    template: luzDeFeTemplate,
    invitation: sofiaLuzDeFeInvitation,
    texts: ["Sofía", "Mi Primera Comunión", "Con alegría recibimos este día de fe y amor.", "Parroquia de San Miguel Arcángel", "Jardín Los Lirios", "Misa de Primera Comunión", "Momentos de luz", "Tonos claros", "Confirmar asistencia", "Gracias por acompañarme en este día de fe y amor"],
    foreign: ["Andrea", "Santiago", "Valentina", "Nico", "Baby Mateo", "Valeria", "Camila"],
    eventType: "baptism",
    layout: { hero: "split", locations: "stacked", gallery: "carousel", timeline: "horizontal" },
    photos: 9,
  },
  {
    slug: "mar-de-amor",
    template: marDeAmorTemplate,
    invitation: valeriaMateoMarDeAmorInvitation,
    texts: ["Valeria", "Mateo", "Nuestra boda", "Nos encontramos frente al mar para celebrar nuestro amor.", "Playa Palmar del Sol", "Terraza Brisa Marina", "Ceremonia en la playa", "Postales del mar", "Lino y arena", "Playa elegante: lino ligero", "Confirmar asistencia", "Gracias por ser parte de nuestra historia"],
    foreign: ["Andrea", "Fernando", "Santiago", "Valentina", "Nico", "Sofía", "Camila"],
    eventType: "wedding",
    layout: { hero: "split", locations: "split", gallery: "masonry", timeline: "vertical" },
    photos: 9,
  },
  {
    slug: "nova-grad",
    template: novaGradTemplate,
    invitation: camilaNovaGradInvitation,
    texts: ["Camila", "Graduación", "Una nueva etapa comienza.", "Auditorio Universitario Nova", "Terraza Skyline", "Ceremonia de graduación", "Momentos", "Negro y oro", "Elegante y con brillo", "Confirmar asistencia", "Gracias por ser parte de este logro"],
    foreign: ["Andrea", "Fernando", "Santiago", "Valentina", "Nico", "Sofía", "Valeria"],
    eventType: "graduation",
    layout: { hero: "editorial", locations: "stacked", gallery: "grid", timeline: "horizontal" },
    // La mesa de regalos de esta demo va oculta (el brief no la incluye): 2 sedes + 5 fotos + código de vestimenta.
    photos: 8,
    hiddenSections: ["giftRegistry"],
  },
];

const encoded = (path: string) => encodeURIComponent(path);
const images = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;");

describe.each(CASES)("$slug (plantilla terminada)", ({ slug, template, invitation, texts, foreign, eventType, layout, photos, hiddenSections = [] }) => {
  const html = render(invitation, template);
  const shown = invitation.sections.filter((section) => section.isVisible);

  it("está registrada en el motor y en el catálogo como implemented, con su tipo de evento", () => {
    expect(getInvitationTemplate(slug)).toBe(template);
    expect(invitationTemplates.filter((t) => t.slug === slug)).toHaveLength(1);
    const entry = templates.find((t) => t.slug === slug);
    expect(entry?.status).toBe("implemented");
    expect(isTemplateReady(entry!)).toBe(true);
    expect(invitation.eventType).toBe(eventType);
    expect(entry?.eventType).toBe(eventType);
    expect(invitation.templateSlug).toBe(slug);
  });

  it("renderiza todas las secciones visibles, en el orden de los datos, y no dibuja las ocultas", () => {
    for (const section of shown) expect(html, section.id).toContain(`id="${section.id}"`);
    const positions = shown.map((section) => html.indexOf(`id="${section.id}"`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const type of hiddenSections) expect(html).not.toContain(`data-section="${type}"`);
  });

  it("dibuja el contenido de su propia demo (no el de otras)", () => {
    const text = visibleText(html);
    for (const expected of texts) expect(text, expected).toContain(expected);
    for (const other of foreign) expect(text, other).not.toContain(other);
    // El slug de la demo base no empieza con "demo-": el aviso de modo demostración no sale aquí (lo cubre ui-and-policy).
    expect(text).not.toContain("Modo demostración");
  });

  it(`usa sus variantes de bloque propias (hero ${layout.hero}, locations ${layout.locations}, gallery ${layout.gallery}, timeline ${layout.timeline})`, () => {
    expect(template.layout).toEqual(layout);
    expect(html).toContain(`data-hero-layout="${layout.hero}"`);
    expect(html).toContain(`data-locations-layout="${layout.locations}"`);
    expect(html).toContain(`data-gallery-layout="${layout.gallery}"`);
    expect(html).toContain(`data-timeline-layout="${layout.timeline}"`);
  });

  it("el enlace de cada sede y la paleta de código de vestimenta salen de la invitación", () => {
    for (const location of invitation.locations) expect(html).toContain(`href="${escapeHtml(location.mapUrl ?? "")}"`);
    for (const swatch of invitation.dressCode?.palette ?? []) expect(html).toContain(`aria-label="${swatch.name}"`);
  });

  it("la cuenta regresiva cuenta hasta invitation.event.startsAt", () => {
    const parts = getCountdown(invitation.event.startsAt, NOW);
    expect(/role="timer" aria-label="([^"]*)"/.exec(html)?.[1]).toBe(`${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`);
  });

  it("las demos públicas /i/demo-<slug> usan su contenido propio, no el de Andrea & Fernando", () => {
    expect(STANDALONE_DEMO_BASES[slug]).toBe(invitation);
    const demo = getMockInvitation(`demo-${slug}`);
    expect(demo?.slug).toBe(`demo-${slug}`);
    expect(demo?.templateSlug).toBe(slug);
    expect(demo?.names).toEqual(invitation.names);
  });

  it("su portada real viene de /templates/<slug>/cover-bg.png (getTemplateCoverImage)", () => {
    // La URL lleva la huella de versión de la carpeta (anti caché vieja, D-45): `tests/images/asset-versions.test.ts`.
    expect(getTemplateCoverImage(slug)).toEqual({ src: withAssetVersion(`/templates/${slug}/cover-bg.png`), position: "center" });
    expect(getTemplateCoverImage(slug)?.src).toContain(`/templates/${slug}/cover-bg.png?v=`);
    expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
    expect(html).toContain(encoded(`/templates/${slug}/decor-corners.png`));
    for (const other of ["magnolia", "level-12", "aurora-xv", "celeste", "spider-friends", "baby-bloom", "luz-de-fe", "mar-de-amor", "nova-grad"].filter((s) => s !== slug)) {
      expect(html).not.toContain(encoded(`/templates/${other}/cover-bg.png`));
    }
  });

  it("las fotos de contenido son de su carpeta y llevan alt descriptivo", () => {
    const sources = [
      ...invitation.locations.map((l) => l.photo),
      ...invitation.gallery,
      invitation.dressCode?.illustration,
      invitation.giftRegistry?.photo,
    ].filter((image): image is NonNullable<typeof image> => Boolean(image?.src));
    expect(sources).toHaveLength(9);
    for (const image of sources) {
      expect(image.src?.startsWith(`/templates/${slug}/`), image.src).toBe(true);
      expect((image.alt ?? "").length, image.src).toBeGreaterThan(12);
    }
    const inHtml = sources.filter((image) => html.includes(encoded(image.src ?? "")));
    expect(inHtml).toHaveLength(photos);
  });

  it("todas las imágenes usan next/image con width, height y sizes; solo la portada tiene prioridad", () => {
    const tags = images(html);
    for (const tag of tags) {
      expect(tag, tag).toContain("/_next/image?url=");
      expect(attr(tag, "width"), tag).toMatch(/^\d+$/);
      expect(attr(tag, "height"), tag).toMatch(/^\d+$/);
      expect(attr(tag, "sizes"), tag).toBeTruthy();
    }
    const eager = tags.filter((tag) => attr(tag, "loading") !== "lazy");
    expect(eager).toHaveLength(1);
    expect(eager[0]).toContain(encoded(`/templates/${slug}/cover-bg.png`));
    expect(html).not.toMatch(/src="data:/);
    expect(html).not.toMatch(/src="https?:/);
  });

  it("los textos de las imágenes decorativas están vacíos (alt='') y no hay texto incrustado que declarar", () => {
    for (const tag of images(html)) {
      if (tag.includes(encoded(`/templates/${slug}/cover-bg.png`)) || tag.includes(encoded(`/templates/${slug}/decor-corners.png`))) expect(attr(tag, "alt")).toBe("");
    }
  });

  it("sin imágenes opcionales no rompe el renderizador (las imágenes son contenido opcional)", () => {
    const bare: Invitation = {
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
    expect(() => render(bare, template)).not.toThrow();
    expect(visibleText(render(bare, template))).toContain(invitation.locations[0]?.name);
  });

  it("no usa nombres de marcas ni de personajes de terceros", () => {
    const text = visibleText(html);
    for (const forbidden of ["Liverpool", "Amazon", "Sears", "Spotify", "Marvel", "Disney", "Spider-Man", "Hogwarts"]) expect(text, forbidden).not.toContain(forbidden);
  });
});

describe("las plantillas nuevas se distinguen de verdad (no solo por color)", () => {
  const NEW = [luzDeFeTemplate, marDeAmorTemplate, novaGradTemplate];
  const readySlugs = new Set(templates.filter(isTemplateReady).map((t) => t.slug));
  const OLD = invitationTemplates.filter((t) => !NEW.includes(t) && readySlugs.has(t.slug));

  it("ninguna usa la pareja de fuentes Cormorant + Inter de las demás, y las tres tienen pareja propia", () => {
    for (const template of NEW) expect(template.fonts.display).not.toBe(cormorantInter.display);
    expect(new Set(NEW.map((t) => `${t.fonts.display}|${t.fonts.body}`)).size).toBe(3);
  });

  it("las variantes de portada de las tres plantillas nuevas no son la `centered` de las anteriores (Luz de Fe usa `split` para no tapar su cruz)", () => {
    expect(OLD.length).toBeGreaterThanOrEqual(6);
    expect(OLD.every((t) => t.layout.hero === "centered")).toBe(true);
    expect(luzDeFeTemplate.layout.hero).toBe("split");
    expect(marDeAmorTemplate.layout.hero).toBe("split");
    expect(novaGradTemplate.layout.hero).toBe("editorial");
  });

  it("las tres difieren entre sí en portada o galería y de CADA plantilla anterior en al menos dos variantes de bloque", () => {
    const keys = ["hero", "locations", "gallery", "timeline"] as const;
    for (const template of NEW) {
      for (const other of OLD) {
        const different = keys.filter((key) => template.layout[key] !== other.layout[key]).length;
        expect(different, `${template.slug} vs ${other.slug}`).toBeGreaterThanOrEqual(2);
      }
    }
    const galleries = NEW.map((t) => t.layout.gallery);
    expect(new Set(galleries).size).toBe(3);
  });

  it("cada una tiene su propia paleta (fondo) y su propia forma de botón o tarjeta", () => {
    expect(new Set(NEW.map((t) => t.colors.bg)).size).toBe(3);
    expect(novaGradTemplate.componentStyles.button.shape).toBe("square");
    expect(novaGradTemplate.componentStyles.card.radius).toBe("none");
    expect(luzDeFeTemplate.componentStyles.button.variant).toBe("outline");
  });

  it("la cursiva sintética se apaga solo en las fuentes sin cursiva (Cinzel, Bebas Neue); Playfair conserva la suya", () => {
    expect(templateToCssVars(luzDeFeTemplate)["--inv-italic"]).toBe("normal");
    expect(templateToCssVars(novaGradTemplate)["--inv-italic"]).toBe("normal");
    expect(templateToCssVars(marDeAmorTemplate)["--inv-italic"]).toBeUndefined();
    for (const template of OLD) expect(templateToCssVars(template)["--inv-italic"], template.slug).toBeUndefined();
  });

  it("el código de vestimenta de las tres es una fotografía a todo color: sin mezcla (ni multiply ni screen), que oscurecería o lavaría sus colores", () => {
    for (const [template, invitation] of [
      [luzDeFeTemplate, sofiaLuzDeFeInvitation],
      [marDeAmorTemplate, valeriaMateoMarDeAmorInvitation],
      [novaGradTemplate, camilaNovaGradInvitation],
    ] as const) {
      expect(template.effects.illustrationBlend, template.slug).toBe("none");
      const html = render(invitation, template);
      expect(html, template.slug).not.toContain("mix-blend-screen");
      expect(html, template.slug).not.toContain("mix-blend-multiply");
    }
  });

  it("las plantillas anteriores (sin illustrationBlend) conservan multiply; screen y none siguen disponibles en el motor", () => {
    const multiplied = render(andreaFernandoInvitation, magnoliaTemplate);
    expect(multiplied).toContain("mix-blend-multiply");
    const screened = render(andreaFernandoInvitation, { ...magnoliaTemplate, effects: { ...magnoliaTemplate.effects, illustrationBlend: "screen" } });
    expect(screened).toContain("mix-blend-screen");
    expect(screened).not.toContain("mix-blend-multiply");
    expect(render(andreaFernandoInvitation, { ...magnoliaTemplate, effects: { ...magnoliaTemplate.effects, illustrationBlend: "none" } })).not.toContain("mix-blend");
  });
});

describe("contraste de las plantillas nuevas (WCAG AA, 4.5:1)", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = (hex.slice(1).match(/../g) ?? []).map((part) => parseInt(part, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
  };

  it.each([luzDeFeTemplate, marDeAmorTemplate, novaGradTemplate])("$slug: texto, texto atenuado, acento y botón cumplen AA sobre sus fondos", (template) => {
    const { colors } = template;
    for (const bg of [colors.bg, colors.bgAlt]) {
      expect(ratio(colors.ink, bg), "ink").toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.inkMuted, bg), "inkMuted").toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.accent, bg), "accent").toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(colors.buttonFg, colors.buttonBg), "botón").toBeGreaterThanOrEqual(4.5);
  });
});

describe("getTemplateEventLabel: Primera Comunión no se rotula 'Bautizo'", () => {
  it("Luz de Fe se muestra como Primera Comunión (su tipo guardado sigue siendo baptism); el resto usa el rótulo del tipo", () => {
    const luz = templates.find((t) => t.slug === "luz-de-fe")!;
    expect(luz.eventType).toBe("baptism");
    expect(getTemplateEventLabel(luz)).toBe("Primera Comunión");
    expect(getTemplateEventLabel(templates.find((t) => t.slug === "celeste")!)).toBe("Bautizo");
    expect(getTemplateEventLabel(templates.find((t) => t.slug === "nova-grad")!)).toBe("Graduación");
    expect(getTemplateEventLabel(templates.find((t) => t.slug === "mar-de-amor")!)).toBe("Boda");
  });
});
