import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { getImplicitTags } from "next/dist/server/lib/implicit-tags";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTemplates = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const requireAdmin = vi.hoisted(() => vi.fn());
const updateAdminTemplate = vi.hoisted(() => vi.fn());

vi.mock("@/server/repositories/templates", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/repositories/templates")>();
  getTemplates.mockImplementation(original.getTemplates);
  return { ...original, getTemplates };
});
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));
vi.mock("@/server/admin/templates", () => ({ updateAdminTemplate }));

import { updateTemplateAction } from "@/app/(site)/admin/templates/actions";
import HomePage, { revalidate } from "@/app/(site)/(marketing)/page";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { SiteFooter } from "@/components/marketing/site-footer";
import { featureDemo } from "@/lib/content/home";
import { footerNav } from "@/lib/content/navigation";
import { templates } from "@/lib/content/templates";
import { routes } from "@/lib/routes";
import { getFeaturedTemplates } from "@/lib/templates/featured";

const encoded = (path: string) => encodeURIComponent(path);
/** Sin `DATABASE_URL` (`vitest.config.mts`): `getTemplates` lee el catálogo de demostración, con todas publicadas. */
const html = renderToStaticMarkup(await HomePage());
/** La home tal como se ve si el catálogo publicado NO incluye estas plantillas (`publicationStatus` distinto de PUBLISHED). */
async function homeWithout(...hidden: string[]) {
  getTemplates.mockResolvedValueOnce(templates.filter((template) => !hidden.includes(template.slug)));
  return renderToStaticMarkup(await HomePage());
}
const NOT_READY = ["ivory", "etoile", "tuscany", "noir", "riviera", "dream", "blossom", "safari"] as const;
const READY = ["magnolia", "level-12", "aurora-xv", "celeste", "spider-friends", "baby-bloom", "luz-de-fe", "mar-de-amor", "nova-grad", "bosque-de-aventuras"] as const;
/** Las 4 que caben en el abanico fijo del hero (ver `components/marketing/hero-visual.tsx`). */
const HERO_SLOTS = ["magnolia", "level-12", "aurora-xv", "celeste"] as const;

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

describe("homepage: plantillas destacadas calculadas dinámicamente (getFeaturedTemplates, sin lista fija)", () => {
  it("getFeaturedTemplates(templates) son exactamente las 10 plantillas implemented, en orden de variedad por categoría", () => {
    // magnolia/level-12/aurora-xv/celeste/baby-bloom/nova-grad: primera aparición de su categoría, en
    // orden de catálogo. spider-friends (birthday), luz-de-fe (baptism), mar-de-amor (wedding) y
    // bosque-de-aventuras (birthday) repiten categoría → van al final, también en orden de catálogo.
    expect(getFeaturedTemplates(templates).map((t) => t.slug)).toEqual(["magnolia", "level-12", "aurora-xv", "celeste", "baby-bloom", "nova-grad", "spider-friends", "luz-de-fe", "mar-de-amor", "bosque-de-aventuras"]);
  });

  it("un límite menor recorta por el mismo orden (variedad primero)", () => {
    expect(getFeaturedTemplates(templates, 3).map((t) => t.slug)).toEqual(["magnolia", "level-12", "aurora-xv"]);
  });

  it.each(NOT_READY)("%s nunca aparece como destacada en la home", (slug) => {
    expect(html).not.toContain(`href="/templates/${slug}"`);
  });

  it.each(READY)("%s aparece destacada con su imagen real", (slug) => {
    expect(html).toContain(`href="/templates/${slug}"`);
    expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
  });

  it("agregar una plantilla nueva (Baby Bloom) no requirió tocar lib/content/home.ts: no existe ninguna lista fija de slugs destacados", () => {
    const homeContentSource = readFileSync(join(process.cwd(), "lib/content/home.ts"), "utf8");
    expect(homeContentSource).not.toMatch(/featuredTemplateSlugs/);
  });
});

describe("homepage: hero con collage de imágenes reales (abanico fijo de 4, elegido dinámicamente)", () => {
  it("las 4 plantillas del abanico del hero aparecen como imagen real", () => {
    for (const slug of HERO_SLOTS) expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
  });

  it("ninguna plantilla no lista aparece como imagen en el hero", () => {
    for (const slug of NOT_READY) expect(html).not.toContain(encoded(`/templates/${slug}/cover-bg.png`));
  });

  it("Spider Friends y Baby Bloom NO entran en el abanico del hero: solo hay 4 huecos fijos y 4 categorías (boda/cumpleaños/XV años/bautizo) ya los ocupan antes de que les toque turno a Infantil/Baby Shower", () => {
    expect(getFeaturedTemplates(templates, 4).map((t) => t.slug)).not.toContain("spider-friends");
    expect(getFeaturedTemplates(templates, 4).map((t) => t.slug)).not.toContain("baby-bloom");
  });
});

describe("homepage: respeta la visibilidad del catálogo (Template.publicationStatus)", () => {
  it("una plantilla oculta o en borrador no se enlaza desde ninguna sección", async () => {
    const hidden = await homeWithout("magnolia", "bosque-de-aventuras");
    expect(hidden).not.toContain(`href="/templates/magnolia"`);
    expect(hidden).not.toContain(`href="/templates/bosque-de-aventuras"`);
    expect(hidden).toContain(`href="/templates/mar-de-amor"`);
  });

  it("el hero no muestra la portada de una plantilla oculta (Magnolia sigue siendo decorativa en otras secciones)", () => {
    const cover = encoded("/templates/magnolia/cover-bg.png");
    expect(renderToStaticMarkup(<HeroVisual catalog={templates} />)).toContain(cover);
    expect(renderToStaticMarkup(<HeroVisual catalog={templates.filter((t) => t.slug !== "magnolia")} />)).not.toContain(cover);
  });

  it('una categoría cuya única plantilla se oculta pasa a "Próximamente"; ninguna se presenta como disponible sin plantillas', async () => {
    const comingSoon = (markup: string) => [...markup.matchAll(/Próximamente/g)].length;
    expect(comingSoon(await homeWithout("baby-bloom"))).toBe(comingSoon(html) + 1);
  });

  it("con un catálogo vacío renderiza sin lanzar y sin tarjetas de plantilla", async () => {
    getTemplates.mockResolvedValueOnce([]);
    const empty = renderToStaticMarkup(await HomePage());
    expect(empty).toContain("Invitaciones digitales que se sienten tan");
    expect(empty).not.toMatch(/href="\/templates\/[a-z]/);
  });
});

describe("homepage: sigue en caché (ISR) y publicar u ocultar una plantilla la invalida", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declara `revalidate` en vez de renderizarse en cada petición", () => {
    expect(revalidate).toBeGreaterThan(0);
    const source = readFileSync(join(process.cwd(), "app/(site)/(marketing)/page.tsx"), "utf8");
    expect(source).not.toMatch(/force-dynamic/);
  });

  it("updateTemplateAction invalida una etiqueta que la home tiene (comprobado con `getImplicitTags` de Next)", async () => {
    requireAdmin.mockResolvedValue({ id: "usr_1", email: "admin@example.com", name: "Admin", role: "ADMIN" });
    updateAdminTemplate.mockResolvedValue({ ok: true, template: { name: "Magnolia" } });
    const data = new FormData();
    data.set("templateId", "tpl_1");
    data.set("publicationStatus", "DRAFT");
    expect((await updateTemplateAction({ status: "idle" }, data)).status).toBe("saved");

    expect(existsSync(join(process.cwd(), "app/(site)/(marketing)/page.tsx"))).toBe(true);
    const { tags } = await getImplicitTags("/(site)/(marketing)/page", "/", null);
    const invalidated = (revalidatePath.mock.calls as [string, string?][]).map(([path, type]) => `_N_T_${path}${type ? `/${type}` : ""}`);
    expect(invalidated.filter((tag) => tags.includes(tag))).toEqual(["_N_T_/"]);
  });

  it("si no se guarda, no invalida la home", async () => {
    requireAdmin.mockResolvedValue({ id: "usr_1", email: "admin@example.com", name: "Admin", role: "ADMIN" });
    updateAdminTemplate.mockResolvedValue({ ok: false, code: "invalid" });
    expect((await updateTemplateAction({ status: "idle" }, new FormData())).status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('homepage: "Así de fácil" usa plantillas reales, no solo degradados', () => {
  it("el paso 1 muestra las 4 portadas reales (abanico de plantillas)", () => {
    for (const slug of HERO_SLOTS) expect(html).toContain(encoded(`/templates/${slug}/cover-bg.png`));
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
  it("Bodas, Cumpleaños, XV años, Bautizo y Baby Shower usan la foto real de su plantilla lista (sin aviso)", () => {
    expect(html).toContain(encoded("/templates/magnolia/cover-bg.png"));
    expect(html).toContain(encoded("/templates/level-12/cover-bg.png"));
    expect(html).toContain(encoded("/templates/aurora-xv/cover-bg.png"));
    expect(html).toContain(encoded("/templates/celeste/cover-bg.png"));
    // Baby Bloom: antes del catálogo de esta tarea, "Baby Shower" no tenía ninguna plantilla lista
    // y mostraba "Próximamente" en la home; ahora lo pierde automáticamente (sin tocar la home).
    expect(html).toContain(encoded("/templates/baby-bloom/cover-bg.png"));
  });

  it('Infantiles usa el mismo filtro que su enlace: con plantillas de estilo infantil no muestra "Próximamente", y sin ninguna lista vuelve el aviso', async () => {
    // Spider Friends y Bosque de Aventuras son `eventType: "birthday"` con estilo infantil: /templates?category=kids las muestra.
    const comingSoon = (markup: string) => [...markup.matchAll(/Próximamente/g)].length;
    expect(comingSoon(html)).toBe(0);
    expect(comingSoon(await homeWithout("spider-friends"))).toBe(0);
    expect(comingSoon(await homeWithout("spider-friends", "bosque-de-aventuras"))).toBe(1);
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

  it("todas las imágenes referenciadas existen en public/ y llevan su huella de versión (?v=, D-45)", () => {
    const paths = new Set(
      [...html.matchAll(/url=([^&"]+)/g)].map((m) => decodeURIComponent(m[1] ?? "")).filter((p) => p.startsWith("/templates/")),
    );
    expect(paths.size).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path, path).toMatch(/[?]v=[0-9a-f]{10}$/);
      expect(existsSync(join(process.cwd(), "public", path.split("?")[0] ?? "")), path).toBe(true);
    }
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
