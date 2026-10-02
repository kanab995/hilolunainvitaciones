import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogTemplateCard } from "@/components/templates/catalog-template-card";
import { TemplateGrid } from "@/components/templates/template-grid";
import { categoryFilters, templates } from "@/lib/content/templates";
import { filterTemplates } from "@/lib/templates/filter";
import { getTemplateCoverImage, isTemplateReady } from "@/lib/templates/status";

const encoded = (path: string) => encodeURIComponent(path);
const slugsOf = (list: readonly { slug: string }[]) => list.map((t) => t.slug).sort();

describe("isTemplateReady: qué entra al catálogo público", () => {
  it("solo las plantillas implemented están listas", () => {
    expect(slugsOf(templates.filter(isTemplateReady))).toEqual(["aurora-xv", "celeste", "level-12", "magnolia", "spider-friends"]);
  });

  it("concept y comingSoon NO están listas (pero siguen en el catálogo interno, sin borrarse)", () => {
    for (const template of templates.filter((t) => t.status !== "implemented")) {
      expect(isTemplateReady(template), template.slug).toBe(false);
    }
    // Siguen existiendo en `templates`: no se borró ninguna fila de metadata.
    expect(templates.some((t) => t.slug === "ivory")).toBe(true);
    expect(templates.some((t) => t.slug === "tuscany")).toBe(true);
  });
});

describe("getTemplateCoverImage: imagen real de portada por plantilla", () => {
  it.each(["magnolia", "level-12", "aurora-xv", "celeste", "spider-friends"])("%s (implemented) tiene una imagen real aprobada", (slug) => {
    const cover = getTemplateCoverImage(slug);
    expect(cover, slug).toBeDefined();
    expect(cover?.src, slug).toMatch(new RegExp(`^/templates/${slug}/`));
  });

  it.each(["ivory", "etoile", "tuscany", "noir", "blossom", "riviera", "dream", "safari"])(
    "%s (sin diseño aprobado) no tiene portada real: la tarjeta cae al placeholder",
    (slug) => {
      expect(getTemplateCoverImage(slug)).toBeUndefined();
    },
  );

  it("Level 12 usa un punto focal distinto (el festejado queda fuera de cuadro con el recorte centrado)", () => {
    expect(getTemplateCoverImage("level-12")?.position).toBe("top");
  });

  it("el resto de las plantillas implementadas usa el recorte centrado por defecto", () => {
    expect(getTemplateCoverImage("magnolia")?.position).toBe("center");
    expect(getTemplateCoverImage("aurora-xv")?.position).toBe("center");
    expect(getTemplateCoverImage("celeste")?.position).toBe("center");
    expect(getTemplateCoverImage("spider-friends")?.position).toBe("center");
  });
});

describe("filtros de categoría sobre el catálogo listo (solo plantillas implemented)", () => {
  const ready = templates.filter(isTemplateReady);

  it("Bodas, XV años y Bautizo tienen exactamente una plantilla lista cada una; Cumpleaños tiene dos", () => {
    expect(slugsOf(filterTemplates(ready, { category: "wedding", style: null }))).toEqual(["magnolia"]);
    expect(slugsOf(filterTemplates(ready, { category: "birthday", style: null }))).toEqual(["level-12", "spider-friends"]);
    expect(slugsOf(filterTemplates(ready, { category: "quinceanera", style: null }))).toEqual(["aurora-xv"]);
    expect(slugsOf(filterTemplates(ready, { category: "baptism", style: null }))).toEqual(["celeste"]);
  });

  it("Infantil ya tiene una plantilla lista (Spider Friends, estilo kids); Baby Shower sigue vacío (Safari es comingSoon)", () => {
    expect(slugsOf(filterTemplates(ready, { category: "kids", style: null }))).toEqual(["spider-friends"]);
    expect(filterTemplates(ready, { category: "baby-shower", style: null })).toEqual([]);
  });

  it("cada chip de categoryFilters sigue existiendo aunque hoy uno de ellos (Baby Shower) dé el catálogo vacío", () => {
    expect(categoryFilters.map((c) => c.id)).toEqual(
      expect.arrayContaining(["wedding", "birthday", "quinceanera", "baptism", "kids", "baby-shower"]),
    );
  });
});

describe("tarjeta del catálogo: imagen real en vez de degradado para plantillas listas", () => {
  const renderCard = (slug: string) => {
    const template = templates.find((t) => t.slug === slug)!;
    return renderToStaticMarkup(CatalogTemplateCard({ template }));
  };

  it.each(["magnolia", "level-12", "aurora-xv", "celeste", "spider-friends"])("%s: la tarjeta usa next/image con la portada real, no el placeholder", (slug) => {
    const html = renderCard(slug);
    expect(html).toContain("/_next/image?url=");
    expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
    expect(html, "sin el marcador de placeholder cuando hay imagen real").not.toContain("data-asset-placeholder");
  });

  it("la tarjeta de Magnolia incluye un alt descriptivo (no vacío) con el nombre y la categoría", () => {
    const html = renderCard("magnolia");
    expect(html).toContain('alt="Vista previa de la plantilla Magnolia para invitación de Boda"');
  });

  it.each(["ivory", "etoile"])("%s (concept, sin portada real) sigue mostrando el placeholder con degradado", (slug) => {
    const html = renderCard(slug);
    expect(html).not.toContain("/_next/image?url=");
  });
});

describe("TemplateGrid del catálogo público: enlaces y demos de las plantillas listas no se rompen", () => {
  const ready = templates.filter(isTemplateReady);
  const html = renderToStaticMarkup(TemplateGrid({ items: ready }));

  it("ninguna plantilla comingSoon/concept aparece en el grid público", () => {
    for (const template of templates.filter((t) => !isTemplateReady(t))) {
      expect(html, template.slug).not.toContain(`/templates/${template.slug}"`);
    }
  });

  it.each(["level-12", "aurora-xv", "celeste", "magnolia", "spider-friends"])("el grid enlaza a /templates/%s", (slug) => {
    expect(html).toContain(`href="/templates/${slug}"`);
  });
});
