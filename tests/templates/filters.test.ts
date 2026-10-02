import { describe, expect, it } from "vitest";
import { categoryFilters, templates } from "@/lib/content/templates";
import { getMockInvitation } from "@/lib/invitation/mock";
import { routes } from "@/lib/routes";
import { filterTemplates, parseTemplateFilters, serializeTemplateFilters } from "@/lib/templates/filter";
import type { Template } from "@/types/templates";

const slugsOf = (list: readonly Template[]) => list.map((t) => t.slug).sort();

describe("filtro de categoría de /templates (lib/templates/filter.ts)", () => {
  it('"Todas" (sin categoría) muestra el catálogo completo', () => {
    expect(filterTemplates(templates, { category: null, style: null })).toHaveLength(templates.length);
  });

  it('Cumpleaños (eventType "birthday"): Level 12 y Spider Friends', () => {
    expect(slugsOf(filterTemplates(templates, { category: "birthday", style: null }))).toEqual(["level-12", "spider-friends"]);
  });

  it('XV años (eventType "quinceanera"): Étoile, Aurora XV y Dream — Aurora XV está incluida', () => {
    const result = slugsOf(filterTemplates(templates, { category: "quinceanera", style: null }));
    expect(result).toEqual(slugsOf(templates.filter((t) => t.eventType === "quinceanera")));
    expect(result).toContain("aurora-xv");
  });

  it('Bautizo (eventType "baptism"): Celeste y Blossom — Celeste está incluida', () => {
    const result = slugsOf(filterTemplates(templates, { category: "baptism", style: null }));
    expect(result).toEqual(["blossom", "celeste"]);
    expect(result).toContain("celeste");
  });

  /**
   * Bodas agrupa TODO lo que tiene `eventType: "wedding"` en el catálogo (Magnolia, Ivory, Tuscany,
   * Noir y Riviera), no solo las plantillas "implemented". Étoile es "quinceanera" en el catálogo
   * (lib/content/templates.ts), no "wedding": el chip de Bodas NO la incluye. Esto difiere de la
   * agrupación "Bodas = Magnolia, Ivory, Étoile" propuesta al pedir esta tarea; se respeta el dato
   * real del catálogo en vez de renombrar/mover Étoile sin una decisión de diseño explícita.
   */
  it('Bodas (eventType "wedding"): Magnolia e Ivory están incluidas; Étoile NO (es "quinceanera" en el catálogo)', () => {
    const result = slugsOf(filterTemplates(templates, { category: "wedding", style: null }));
    expect(result).toEqual(slugsOf(templates.filter((t) => t.eventType === "wedding")));
    expect(result).toContain("magnolia");
    expect(result).toContain("ivory");
    expect(result).not.toContain("etoile");
  });

  it("una categoría sin ninguna plantilla coincidente devuelve una lista vacía (estado sin resultados)", () => {
    // "graduation" es un EventCategoryId válido pero ningún template del catálogo lo usa todavía.
    expect(filterTemplates(templates, { category: "graduation", style: null })).toEqual([]);
  });

  it("categoría + estilo sin ninguna coincidencia en el catálogo real también da una lista vacía", () => {
    expect(filterTemplates(templates, { category: "birthday", style: "floral" })).toEqual([]);
  });
});

describe("parseTemplateFilters / serializeTemplateFilters (?category= y ?style=, docs/ROUTES.md §5)", () => {
  const paramsOf = (query: string) => new URLSearchParams(query);

  it('ignora valores desconocidos, p. ej. "?category=xv" (el id real es "quinceanera", no "xv")', () => {
    expect(parseTemplateFilters(paramsOf("category=xv"), templates).category).toBeNull();
  });

  it('"?category=quinceanera" (el id real de XV años) sí se reconoce', () => {
    expect(parseTemplateFilters(paramsOf("category=quinceanera"), templates).category).toBe("quinceanera");
  });

  it('"?category=baptism" se reconoce', () => {
    expect(parseTemplateFilters(paramsOf("category=baptism"), templates).category).toBe("baptism");
  });

  it('"?category=birthday" se reconoce (ya tiene chip y plantilla, a diferencia de antes)', () => {
    expect(parseTemplateFilters(paramsOf("category=birthday"), templates).category).toBe("birthday");
  });

  it("serializa y vuelve a leer sin perder el filtro", () => {
    const state = { category: "baptism" as const, style: null };
    const query = serializeTemplateFilters(state);
    expect(query).toBe("category=baptism");
    expect(parseTemplateFilters(paramsOf(query), templates)).toEqual(state);
  });

  it("sin filtros, serializa a cadena vacía", () => {
    expect(serializeTemplateFilters({ category: null, style: null })).toBe("");
  });
});

describe("categoryFilters: un chip por categoría del MVP", () => {
  it("incluye Bodas, Cumpleaños, XV años y Bautizo (prioridad del pedido)", () => {
    const ids = categoryFilters.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["wedding", "birthday", "quinceanera", "baptism"]));
  });

  it("cada chip de categoría tiene al menos una plantilla real en el catálogo salvo los explícitamente anunciados sin plantillas todavía", () => {
    for (const filter of categoryFilters) {
      const matches = filterTemplates(templates, { category: filter.id, style: null });
      expect(matches.length, `${filter.id} (${filter.label})`).toBeGreaterThan(0);
    }
  });
});

describe("enlaces de plantillas con categoría (no rotos)", () => {
  it.each(["level-12", "aurora-xv", "celeste", "spider-friends"])("/templates/%s resuelve y tiene demo pública /i/demo-%s", (slug) => {
    expect(routes.template(slug)).toBe(`/templates/${slug}`);
    expect(templates.some((t) => t.slug === slug)).toBe(true);
    expect(routes.templateDemo(slug)).toBe(`/i/demo-${slug}`);
    expect(getMockInvitation(`demo-${slug}`)).toBeDefined();
  });
});
