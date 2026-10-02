import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RelatedTemplates } from "@/components/templates/related-templates";
import { templates } from "@/lib/content/templates";
import { getRelatedTemplates } from "@/lib/templates/related";
import { isTemplateReady } from "@/lib/templates/status";

const slugsOf = (list: readonly { slug: string }[]) => list.map((t) => t.slug);
const NOT_READY = ["ivory", "etoile", "tuscany", "noir", "riviera", "dream", "blossom", "safari"] as const;

describe("getRelatedTemplates: solo sugiere plantillas listas (isTemplateReady)", () => {
  it("para CUALQUIER plantilla del catálogo (lista o no), las relacionadas son siempre implemented", () => {
    for (const template of templates) {
      const related = getRelatedTemplates(template, templates);
      for (const candidate of related) expect(isTemplateReady(candidate), `${template.slug} → ${candidate.slug}`).toBe(true);
    }
  });

  it.each(NOT_READY)("%s nunca aparece como relacionada de ninguna plantilla", (notReadySlug) => {
    for (const template of templates) {
      expect(slugsOf(getRelatedTemplates(template, templates)), template.slug).not.toContain(notReadySlug);
    }
  });

  it("nunca se recomienda a sí misma", () => {
    for (const template of templates) {
      expect(slugsOf(getRelatedTemplates(template, templates))).not.toContain(template.slug);
    }
  });

  it("mantiene el orden por categoría y estilo (D-44): Magnolia prioriza Aurora XV y Celeste (estilo romántico compartido) sobre Level 12", () => {
    const magnolia = templates.find((t) => t.slug === "magnolia")!;
    expect(slugsOf(getRelatedTemplates(magnolia, templates))).toEqual(["aurora-xv", "celeste", "level-12"]);
  });

  it("solo quedan 4 plantillas listas en total (sin contarse a sí misma): un límite mayor no rellena con plantillas no listas", () => {
    const level12 = templates.find((t) => t.slug === "level-12")!;
    const related = getRelatedTemplates(level12, templates, 6);
    expect(related).toHaveLength(4);
    expect(slugsOf(related).sort()).toEqual(["aurora-xv", "celeste", "magnolia", "spider-friends"]);
  });

  it("si la propia plantilla es de las 5 listas, el límite por defecto (3) sigue aplicando", () => {
    for (const template of templates.filter(isTemplateReady)) {
      expect(getRelatedTemplates(template, templates).length).toBeLessThanOrEqual(3);
    }
  });
});

describe("RelatedTemplates: sin tarjetas, sin sección", () => {
  it("con una lista vacía de relacionadas no dibuja la sección «Otros diseños»", () => {
    const html = renderToStaticMarkup(RelatedTemplates({ templates: [] }));
    expect(html).toBe("");
  });

  it("con relacionadas sí dibuja la sección y solo esas tarjetas", () => {
    const magnolia = templates.find((t) => t.slug === "magnolia")!;
    const related = getRelatedTemplates(magnolia, templates);
    const html = renderToStaticMarkup(RelatedTemplates({ templates: related }));
    expect(html).toContain("Otros diseños");
    for (const candidate of related) expect(html).toContain(`href="/templates/${candidate.slug}"`);
    for (const slug of NOT_READY) expect(html).not.toContain(`href="/templates/${slug}"`);
  });
});
