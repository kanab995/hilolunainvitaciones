import { describe, expect, it } from "vitest";
import { contentFingerprint } from "@/lib/invitation/change-template";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { etoileTemplate } from "@/lib/invitation/templates/etoile";
import { invitationTemplates } from "@/lib/invitation/templates";
import { ivoryTemplate } from "@/lib/invitation/templates/ivory";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import { collectStrings, deepFreeze, render, visibleText } from "./helpers";

const invitation = andreaFernandoInvitation;

/** Textos de contenido que deben aparecer en TODA plantilla. */
const contentTexts = [
  "Andrea",
  "Fernando",
  "Nos encantaría celebrar contigo",
  "Hay momentos en la vida",
  "Parroquia de San Miguel Arcángel",
  "Calle de la Paz 123",
  "Hacienda Los Olivos",
  "Carretera San Miguel a Dolores Km 4",
  "17:00 hrs",
  "Cóctel de bienvenida",
  "Cena",
  "Brindis",
  "Nuestros momentos",
  "Formal y elegante",
  "Nos encantaría que te sientas increíble",
  "Liverpool",
  "Amazon",
  "¡Nos encantaría contar contigo!",
  "Por favor, confirma tu asistencia",
  "Confirmar asistencia",
  "17 · 05 · 27",
  "Gracias por ser parte de nuestra historia",
];

describe("InvitationRenderer: mismos datos, cualquier plantilla", () => {
  it.each(invitationTemplates.map((template) => [template.slug, template] as const))("%s dibuja todo el contenido", (_slug, template) => {
    const text = visibleText(render(invitation, template));
    for (const expected of contentTexts) expect(text).toContain(expected);
  });

  it("el texto visible es IDÉNTICO en todas las plantillas (solo cambia la presentación)", () => {
    const texts = invitationTemplates.map((template) => visibleText(render(invitation, template)));
    expect(texts[0]).toBeTruthy();
    for (const text of texts) expect(text).toBe(texts[0]);
  });

  it("el HTML SÍ cambia entre plantillas (data-template, tema y variantes)", () => {
    const magnolia = render(invitation, magnoliaTemplate);
    const ivory = render(invitation, ivoryTemplate);
    const etoile = render(invitation, etoileTemplate);

    expect(magnolia).toContain('data-template="magnolia"');
    expect(ivory).toContain('data-template="ivory"');
    expect(etoile).toContain('data-template="etoile"');

    expect(magnolia).toContain(magnoliaTemplate.colors.accent);
    expect(ivory).toContain(ivoryTemplate.colors.accent);
    expect(magnolia).not.toContain(ivoryTemplate.colors.accent);

    expect(magnolia).toContain('data-timeline-layout="horizontal"');
    expect(ivory).toContain('data-timeline-layout="vertical"');
    expect(magnolia).toContain('data-locations-layout="split"');
    expect(ivory).toContain('data-locations-layout="stacked"');
  });

  it("usa el mismo conjunto de secciones, en el mismo orden, con cualquier plantilla", () => {
    const sectionsOf = (html: string) => [...html.matchAll(/data-section="([a-zA-Z]+)"/g)].map((match) => match[1]);
    const expected = sectionsOf(render(invitation, magnoliaTemplate));
    // Las sedes son un bloque con una banda por sede (2), de ahí las tres apariciones de "locations".
    expect(expected).toEqual(["hero", "story", "countdown", "locations", "locations", "locations", "timeline", "gallery", "dressCode", "giftRegistry", "rsvp", "footer"]);
    for (const template of [ivoryTemplate, etoileTemplate]) expect(sectionsOf(render(invitation, template))).toEqual(expected);
  });

  it("no muta la invitación al renderizar (congelada en profundidad)", () => {
    const frozen = deepFreeze(structuredClone(invitation));
    const before = contentFingerprint(frozen);
    for (const template of invitationTemplates) expect(() => render(frozen, template)).not.toThrow();
    expect(contentFingerprint(frozen)).toBe(before);
  });

  it("renderizar dos veces con distintas plantillas no altera lo renderizado con la primera", () => {
    const first = render(invitation, magnoliaTemplate);
    render(invitation, ivoryTemplate);
    render(invitation, etoileTemplate);
    expect(render(invitation, magnoliaTemplate)).toBe(first);
  });

  it("no filtra ningún texto del usuario dentro de las plantillas al renderizar", () => {
    const edited: Invitation = { ...invitation, names: ["Zoe", "Ulises"] };
    for (const template of invitationTemplates) {
      expect(JSON.stringify(template)).not.toContain("Zoe");
      const text = visibleText(render(edited, template));
      expect(text).toContain("Zoe");
      expect(text).toContain("Ulises");
      expect(text).not.toContain("Andrea");
    }
  });
});

describe("visibilidad y contenido opcional", () => {
  it("una sección oculta no se dibuja pero sus datos permanecen", () => {
    const hidden: Invitation = {
      ...invitation,
      sections: invitation.sections.map((section) => (section.type === "gallery" ? { ...section, isVisible: false } : section)),
    };
    for (const template of invitationTemplates) {
      const html = render(hidden, template);
      expect(html).not.toContain('data-section="gallery"');
      expect(html).toContain('data-section="timeline"');
    }
    expect(hidden.gallery).toEqual(invitation.gallery);
  });

  it("sin dress code ni mesa de regalos las secciones no rompen la invitación", () => {
    const sparse: Invitation = { ...invitation, dressCode: undefined, giftRegistry: undefined };
    for (const template of invitationTemplates) {
      const html = render(sparse, template);
      expect(html).not.toContain('data-section="dressCode"');
      expect(html).not.toContain('data-section="giftRegistry"');
      expect(html).toContain('data-section="rsvp"');
    }
  });

  it("los titulares de sección salen de los datos, con la cursiva que decide la plantilla", () => {
    const withoutItalics: InvitationTemplate = {
      ...magnoliaTemplate,
      componentStyles: { ...magnoliaTemplate.componentStyles, heading: { emphasis: "none", eyebrowCase: "normal" } },
    };
    expect(render(invitation, magnoliaTemplate)).toContain("<em");
    const plain = render(invitation, withoutItalics);
    expect(plain).not.toContain("<em");
    expect(visibleText(plain)).toBe(visibleText(render(invitation, magnoliaTemplate)));
  });

  it("la personalización de acento solo afecta a SU plantilla", () => {
    const customised: Invitation = { ...invitation, styleOverrides: { ivory: { accent: "#112233" } } };
    expect(render(customised, ivoryTemplate)).toContain("--inv-accent:#112233");
    expect(render(customised, magnoliaTemplate)).not.toContain("#112233");
  });

  it("un acento inválido se ignora en vez de romper el tema", () => {
    const broken: Invitation = { ...invitation, styleOverrides: { magnolia: { accent: "red; background:url(x)" } } };
    const html = render(broken, magnoliaTemplate);
    expect(html).toContain(`--inv-accent:${magnoliaTemplate.colors.accent}`);
    expect(html).not.toContain("url(x)");
  });
});

describe("la invitación de ejemplo (Andrea & Fernando)", () => {
  it("guarda todos los datos que pide el modelo", () => {
    const i = invitation;
    expect(i.names).toEqual(["Andrea", "Fernando"]);
    expect(i.event.startsAt).toMatch(/^2027-05-17T17:00/);
    expect(i.story.paragraphs.length).toBeGreaterThan(0);
    expect(i.locations.map((l) => l.kind)).toEqual(["ceremony", "reception"]);
    expect(i.timeline).toHaveLength(5);
    expect(i.gallery.length).toBeGreaterThan(0);
    expect(i.dressCode?.palette.length).toBe(4);
    expect(i.giftRegistry?.entries.map((e) => e.name)).toEqual(["Liverpool", "Amazon"]);
    expect(i.music?.sourceType).toBe("external");
    expect(i.rsvp.enabled).toBe(true);
  });

  it("no contiene ningún texto de plantilla y ninguna cadena está vacía", () => {
    for (const text of collectStrings(invitation)) expect(text.trim().length).toBeGreaterThan(0);
  });
});
