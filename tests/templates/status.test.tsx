import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TemplateDetail } from "@/components/templates/template-detail";
import { getTemplateBySlug, templates } from "@/lib/content/templates";
import { getMockInvitation } from "@/lib/invitation/mock";
import { invitationTemplates, getInvitationTemplate } from "@/lib/invitation/templates";
import { routes } from "@/lib/routes";
import { getTemplateCapabilities } from "@/lib/templates/status";
import { getRelatedTemplates } from "@/lib/templates/related";
import type { Template, TemplateStatus } from "@/types/templates";

const expectedStatus: Record<string, TemplateStatus> = {
  magnolia: "implemented",
  ivory: "concept",
  etoile: "concept",
  tuscany: "comingSoon",
  noir: "comingSoon",
  blossom: "comingSoon",
  riviera: "comingSoon",
  dream: "comingSoon",
  safari: "comingSoon",
};

const renderDetail = (template: Template) =>
  renderToStaticMarkup(<TemplateDetail template={template} related={getRelatedTemplates(template, templates)} />);

/** Solo el HTML de la sección principal (sin "Otros diseños", que enlaza a otras plantillas). */
const heroOf = (html: string) => html.slice(0, html.indexOf('aria-labelledby="related-templates-title"') >>> 0 || undefined);

describe("estado de las plantillas", () => {
  it("cada plantilla del catálogo tiene el estado acordado", () => {
    expect(templates.map((t) => t.slug).sort()).toEqual(Object.keys(expectedStatus).sort());
    for (const template of templates) expect(template.status, template.slug).toBe(expectedStatus[template.slug]);
  });

  it("solo hay una plantilla implementada (Magnolia)", () => {
    expect(templates.filter((t) => t.status === "implemented").map((t) => t.slug)).toEqual(["magnolia"]);
  });
});

describe("coherencia entre el catálogo y el motor de invitaciones", () => {
  it("las plantillas comingSoon NO tienen tema en el motor ni demo", () => {
    for (const template of templates.filter((t) => t.status === "comingSoon")) {
      expect(getInvitationTemplate(template.slug), template.slug).toBeUndefined();
      expect(getMockInvitation(`demo-${template.slug}`), template.slug).toBeUndefined();
    }
  });

  it("las plantillas implemented tienen tema y demo", () => {
    for (const template of templates.filter((t) => t.status === "implemented")) {
      expect(getInvitationTemplate(template.slug)).toBeDefined();
      expect(getMockInvitation(`demo-${template.slug}`)).toBeDefined();
    }
  });

  it("todo tema del motor pertenece a una plantilla del catálogo que no es comingSoon", () => {
    for (const engine of invitationTemplates) {
      const entry = getTemplateBySlug(engine.slug);
      expect(entry, engine.slug).toBeDefined();
      expect(entry?.status).not.toBe("comingSoon");
    }
  });
});

describe("getTemplateCapabilities", () => {
  it("implemented: vista completa, funciones, uso y demo", () => {
    expect(getTemplateCapabilities({ slug: "magnolia", status: "implemented" })).toEqual({
      preview: "full",
      showFeatures: true,
      canUse: true,
      demoHref: "/i/demo-magnolia",
      notice: undefined,
    });
  });

  it("concept: vista básica, sin funciones, sin demo y NO se puede usar (crear un evento exige diseño aprobado, D-28)", () => {
    const caps = getTemplateCapabilities({ slug: "ivory", status: "concept" });
    expect(caps).toMatchObject({ preview: "basic", showFeatures: false, canUse: false, demoHref: undefined, notice: "concept" });
  });

  it("comingSoon: sin vista previa, sin demo y no se puede usar", () => {
    expect(getTemplateCapabilities({ slug: "noir", status: "comingSoon" })).toEqual({
      preview: "none",
      showFeatures: false,
      canUse: false,
      demoHref: undefined,
      notice: "comingSoon",
    });
  });
});

describe("/templates/[slug]: toda plantilla del catálogo tiene página válida", () => {
  it("el slug de cada tarjeta resuelve a una plantilla (nunca 404)", () => {
    for (const template of templates) {
      expect(routes.template(template.slug)).toBe(`/templates/${template.slug}`);
      expect(getTemplateBySlug(template.slug), template.slug).toBe(template);
    }
  });

  it.each(templates.map((t) => [t.slug, t] as const))("%s se renderiza con su nombre, categoría, estilo y descripción", (_slug, template) => {
    const html = renderDetail(template);
    expect(html).toContain(template.name);
    expect(html).toContain(template.description);
    expect(html).toContain(`data-template-status="${template.status}"`);
  });

  it("comingSoon: muestra «Próximamente», el CTA está deshabilitado y no hay invitación", () => {
    for (const template of templates.filter((t) => t.status === "comingSoon")) {
      const hero = heroOf(renderDetail(template));
      expect(hero, template.slug).toContain("Próximamente");
      expect(hero).toMatch(/<button[^>]*disabled[^>]*>[^<]*Usar esta plantilla/);
      expect(hero).not.toContain(routes.newEventFromTemplate(template.slug));
      expect(hero).not.toContain("Ver invitación completa");
      expect(hero).not.toContain("/i/");
      expect(hero).not.toContain("Incluye en tu invitación");
      expect(hero, "sin teléfono ni miniaturas de secciones").not.toContain("Secciones de la invitación");
      expect(hero).not.toContain("Vista previa de la invitación");
    }
  });

  it("concept: preview básico solo con la portada, sin funciones, sin demo y con aviso", () => {
    for (const template of templates.filter((t) => t.status === "concept")) {
      const hero = heroOf(renderDetail(template));
      expect(hero, template.slug).toContain("Vista previa de la invitación");
      expect(hero, "solo la portada: sin miniaturas").not.toContain("Secciones de la invitación");
      expect(hero).not.toContain("Incluye en tu invitación");
      expect(hero).not.toContain("Ver invitación completa");
      expect(hero).not.toContain("/i/demo-");
      expect(hero).toContain('data-status-notice="concept"');
      expect(hero).not.toContain("Próximamente");
    }
  });

  it("implemented: preview completo, funciones, CTA activo y demo", () => {
    const magnolia = getTemplateBySlug("magnolia")!;
    const hero = heroOf(renderDetail(magnolia));
    expect(hero).toContain("Secciones de la invitación");
    expect(hero).toContain("Incluye en tu invitación");
    expect(hero).toContain(`href="${routes.newEventFromTemplate("magnolia")}"`);
    expect(hero).toContain('href="/i/demo-magnolia"');
    expect(hero).not.toContain("Próximamente");
    expect(hero).not.toMatch(/<button[^>]*disabled/);
  });
});

describe("las demos no se enlazan desde la interfaz", () => {
  const ROOT = process.cwd();
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });

  it("ningún detalle de plantilla enlaza a demo-ivory ni demo-etoile (ni a ninguna demo salvo Magnolia)", () => {
    for (const template of templates) {
      const html = renderDetail(template);
      const demos = [...html.matchAll(/href="(\/i\/[^"]*)"/g)].map((m) => m[1]);
      expect(demos, template.slug).toEqual(template.slug === "magnolia" ? ["/i/demo-magnolia"] : []);
    }
  });

  it("solo lib/templates/status.ts construye enlaces de demo (`templateDemo`)", () => {
    const users = ["app", "components", "lib"]
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /templateDemo\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).replaceAll("\\", "/"))
      .sort();
    expect(users).toEqual(["lib/templates/status.ts"]);
  });
});
