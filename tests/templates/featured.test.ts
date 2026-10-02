import { describe, expect, it } from "vitest";
import { templates } from "@/lib/content/templates";
import { getFeaturedTemplates } from "@/lib/templates/featured";
import { isTemplateReady } from "@/lib/templates/status";
import type { Template } from "@/types/templates";

const slugsOf = (list: readonly Template[]) => list.map((t) => t.slug);

/** Catálogo sintético mínimo para probar el algoritmo de forma aislada del catálogo real. */
function fakeTemplate(overrides: Partial<Template> & Pick<Template, "slug" | "eventType" | "status">): Template {
  return {
    id: `tpl_${overrides.slug}`,
    name: overrides.slug,
    style: "elegant",
    thumbnail: { alt: "", tone: "cream" },
    description: "",
    premium: false,
    minimumPlan: "FREE",
    features: [],
    preview: { sample: { eyebrow: "", names: [], date: "", venue: [], button: "" }, screens: [] },
    ...overrides,
  };
}

describe("getFeaturedTemplates: solo listas, nunca una lista fija en código", () => {
  it("nunca incluye concept ni comingSoon", () => {
    const featured = getFeaturedTemplates(templates);
    for (const template of featured) expect(isTemplateReady(template), template.slug).toBe(true);
  });

  it("respeta el límite por defecto (8) y uno explícito", () => {
    expect(getFeaturedTemplates(templates).length).toBeLessThanOrEqual(8);
    expect(getFeaturedTemplates(templates, 2)).toHaveLength(2);
  });

  it("con el catálogo real de hoy, devuelve las 6 listas (caben todas dentro del límite de 8)", () => {
    expect(slugsOf(getFeaturedTemplates(templates)).sort()).toEqual(
      slugsOf(templates.filter(isTemplateReady)).sort(),
    );
  });
});

describe("getFeaturedTemplates: variedad por categoría (catálogo sintético, aislado)", () => {
  const catalog: Template[] = [
    fakeTemplate({ slug: "w1", eventType: "wedding", status: "implemented" }),
    fakeTemplate({ slug: "w2", eventType: "wedding", status: "implemented" }), // misma categoría que w1
    fakeTemplate({ slug: "b1", eventType: "birthday", status: "implemented" }),
    fakeTemplate({ slug: "concept1", eventType: "baptism", status: "concept" }),
    fakeTemplate({ slug: "soon1", eventType: "quinceanera", status: "comingSoon" }),
    fakeTemplate({ slug: "bs1", eventType: "baby-shower", status: "implemented" }),
  ];

  it("una categoría repetida (w2) pasa al final, detrás de una categoría nueva (bs1)", () => {
    // Orden de catálogo: w1, w2, b1, bs1 (concept1 y soon1 quedan fuera por no estar implemented).
    // Primera pasada por categoría nueva: w1 (wedding), b1 (birthday), bs1 (baby-shower).
    // w2 repite "wedding" → va al resto, al final.
    expect(slugsOf(getFeaturedTemplates(catalog))).toEqual(["w1", "b1", "bs1", "w2"]);
  });

  it("un límite que recorta antes de llegar a la plantilla repetida la deja fuera", () => {
    expect(slugsOf(getFeaturedTemplates(catalog, 3))).toEqual(["w1", "b1", "bs1"]);
    expect(slugsOf(getFeaturedTemplates(catalog, 3))).not.toContain("w2");
  });

  it("concept y comingSoon nunca aparecen, aunque el límite sea alto", () => {
    const result = slugsOf(getFeaturedTemplates(catalog, 10));
    expect(result).not.toContain("concept1");
    expect(result).not.toContain("soon1");
    expect(result).toHaveLength(4);
  });

  it("un catálogo vacío de listas da una lista vacía, sin lanzar", () => {
    const onlyNotReady = catalog.filter((t) => t.status !== "implemented");
    expect(getFeaturedTemplates(onlyNotReady)).toEqual([]);
  });
});
