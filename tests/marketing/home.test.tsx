import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/(site)/(marketing)/page";
import { SiteFooter } from "@/components/marketing/site-footer";
import { featureDemo, featuredTemplateSlugs } from "@/lib/content/home";
import { footerNav } from "@/lib/content/navigation";
import { templates } from "@/lib/content/templates";
import { routes } from "@/lib/routes";
import { isTemplateReady } from "@/lib/templates/status";

const encoded = (path: string) => encodeURIComponent(path);
const html = renderToStaticMarkup(<HomePage />);
const NOT_READY = ["ivory", "etoile", "tuscany", "noir", "riviera", "dream", "blossom", "safari"] as const;
const READY = ["magnolia", "level-12", "aurora-xv", "celeste"] as const;

describe("homepage: renderiza y tiene los CTA principales", () => {
  it("renderiza sin lanzar, con el hero y sus textos", () => {
    expect(html).toContain("Invitaciones digitales que se sienten tan");
    expect(html).toContain("especiales");
    expect(html).toContain("como tu evento.");
  });

  it("tiene un CTA a /sign-up (crear invitación) y a /templates (ver plantillas)", () => {
    expect(html).toContain(`href="${routes.signUp}"`);
    expect(html).toContain(`href="${routes.templates}"`);
  });

  it("el CTA final también enlaza a /sign-up y /templates", () => {
    const matches = (pattern: string) => [...html.matchAll(new RegExp(`href="${pattern.replace("/", "\\/")}"`, "g"))];
    expect(matches(routes.signUp).length).toBeGreaterThanOrEqual(2);
    expect(matches(routes.templates).length).toBeGreaterThanOrEqual(2);
  });
});

describe("homepage: copy honesto, sin claims falsos (sección 10)", () => {
  it.each(["cientos de diseños", "miles de", "clientes satisfechos", "líder del mercado", "líderes del mercado"])(
    '"%s" no aparece en ningún lado de la home',
    (phrase) => {
      expect(html.toLowerCase()).not.toContain(phrase.toLowerCase());
    },
  );

  it('el paso "Elige una plantilla" usa el texto honesto sobre diseños listos', () => {
    expect(html).toContain("Explora diseños listos para bodas, XV años, bautizos y cumpleaños.");
  });

  it("la tarjeta de mesa de regalos no usa nombres de tiendas reales (Liverpool/Amazon/Sears)", () => {
    for (const brand of ["Liverpool", "Amazon", "Sears"]) expect(html).not.toContain(brand);
  });

  it("la tarjeta de música no usa una canción ni artista real (Perfect / Ed Sheeran)", () => {
    expect(html).not.toContain("Ed Sheeran");
  });

  it('la tarjeta de ubicación de "Todo lo que necesitas" es genérica, sin una dirección ficticia concreta', () => {
    // El teléfono del hero SÍ muestra una invitación de muestra (Andrea & Fernando, Jardín Los
    // Olivos): eso es contenido de ejemplo esperado, no un claim de ubicación real del producto.
    // Lo que pide la tarea es que la tarjeta de función "Ubicación" no invente una dirección.
    expect(featureDemo.location.address).not.toContain("Valle de Guadalupe");
    expect(html).toContain(featureDemo.location.name);
    expect(html).toContain(featureDemo.location.address);
  });
});

describe("homepage: plantillas destacadas, solo las listas (isTemplateReady)", () => {
  it("featuredTemplateSlugs son exactamente las 4 plantillas implemented", () => {
    expect([...featuredTemplateSlugs].sort()).toEqual(["aurora-xv", "celeste", "level-12", "magnolia"]);
  });

  it.each(NOT_READY)("%s nunca aparece como destacada en la home", (slug) => {
    expect(html).not.toContain(`href="/templates/${slug}"`);
  });

  it.each(READY)("%s aparece destacada con su imagen real", (slug) => {
    expect(html).toContain(`href="/templates/${slug}"`);
    expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
  });
});

describe("homepage: hero con collage de imágenes reales (no un solo teléfono genérico)", () => {
  it("las 4 plantillas listas aparecen como imagen real en el hero", () => {
    for (const slug of READY) expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
  });

  it("ninguna plantilla no lista aparece como imagen en el hero", () => {
    for (const slug of NOT_READY) expect(html).not.toContain(encoded(`/templates/${slug}/cover-bg.png`));
  });
});

describe('homepage: "Así de fácil" usa plantillas reales, no solo degradados', () => {
  it("el paso 1 muestra las 4 portadas reales (abanico de plantillas)", () => {
    for (const slug of READY) expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
  });

  it("el paso 2 (editor) y el paso 3 (compartir) usan una imagen real, no solo UI abstracta", () => {
    // Aurora XV (editor) y Celeste (compartir) se usan específicamente para estos dos pasos.
    expect(html).toContain(encoded("/templates/aurora-xv/cover-bg.png"));
    expect(html).toContain(encoded("/templates/celeste/cover-bg.png"));
  });
});

describe("homepage: tarjeta de Galería con fotos reales", () => {
  it("usa fotos reales de 3 plantillas listas, no un placeholder con degradado", () => {
    expect(html).toContain(encoded("/templates/aurora-xv/gallery-1.png"));
    expect(html).toContain(encoded("/templates/celeste/gallery-1.png"));
    expect(html).toContain(encoded("/templates/level-12/gallery-1.png"));
  });
});

describe("homepage: CTA final con imagen real (no solo degradado)", () => {
  it("usa la portada real de Celeste como fondo", () => {
    expect(html).toContain(encoded("/templates/celeste/cover-bg.png"));
    expect(html).toContain("Elige una plantilla, personaliza tu evento");
  });
});

describe("homepage: categorías de evento no muestran como disponible lo que no está listo", () => {
  it("Bodas, Cumpleaños, XV años y Bautizo usan la foto real de su plantilla lista (sin aviso)", () => {
    expect(html).toContain(encoded("/templates/magnolia/cover-bg.png"));
    expect(html).toContain(encoded("/templates/level-12/cover-bg.png"));
    expect(html).toContain(encoded("/templates/aurora-xv/cover-bg.png"));
    expect(html).toContain(encoded("/templates/celeste/cover-bg.png"));
  });

  it('Baby Shower e Infantiles (sin ninguna plantilla implemented) muestran "Próximamente"', () => {
    const babyShowerReady = templates.some((t) => isTemplateReady(t) && t.eventType === "baby-shower");
    const kidsReady = templates.some((t) => isTemplateReady(t) && t.eventType === "kids");
    expect(babyShowerReady, "si esto falla, hay que quitar el aviso de Baby Shower").toBe(false);
    expect(kidsReady, "si esto falla, hay que quitar el aviso de Infantiles").toBe(false);
    const matches = [...html.matchAll(/Próximamente/g)];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("las 6 categorías siguen enlazando a /templates?category=… (ninguna se oculta, solo se avisa)", () => {
    for (const category of ["wedding", "quinceanera", "baptism", "birthday", "baby-shower", "kids"]) {
      expect(html).toContain(`href="${routes.templatesByCategory(category)}"`);
    }
  });
});

describe("homepage: imágenes locales, sin URLs externas en tiempo de ejecución", () => {
  it("ninguna etiqueta <img> apunta a un host externo (http/https)", () => {
    const srcs = [...html.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1] ?? "");
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) expect(src, src).not.toMatch(/^https?:\/\//);
  });

  it("todas las imágenes referenciadas existen en public/", () => {
    const paths = new Set(
      [...html.matchAll(/url=([^&"]+)/g)].map((m) => decodeURIComponent(m[1] ?? "")).filter((p) => p.startsWith("/templates/")),
    );
    expect(paths.size).toBeGreaterThan(0);
    for (const path of paths) expect(existsSync(join(process.cwd(), "public", path)), path).toBe(true);
  });

  it("las imágenes decorativas (collages, fondos) tienen alt vacío; las interactivas (cards de plantilla) tienen alt descriptivo", () => {
    for (const slug of READY) {
      const template = templates.find((item) => item.slug === slug)!;
      expect(html, slug).toContain(`alt="Vista previa de la plantilla ${template.name}`);
    }
  });
});

describe("homepage: enlaces del pie no rotos", () => {
  // El pie (`SiteFooter`) lo pone el layout de `(marketing)` en toda la sección, no `HomePage`
  // en sí — se renderiza aquí por separado para comprobar su enlace a /contact.
  const footerHtml = renderToStaticMarkup(<SiteFooter />);

  it("el pie enlaza a /contact y la página existe", () => {
    const contactEntry = footerNav.find((item) => item.href === routes.contact);
    expect(contactEntry, "footerNav debe tener una entrada a /contact").toBeDefined();
    expect(footerHtml).toContain(`href="${routes.contact}"`);
    expect(existsSync(join(process.cwd(), "app/(site)/(marketing)/contact/page.tsx"))).toBe(true);
  });
});
