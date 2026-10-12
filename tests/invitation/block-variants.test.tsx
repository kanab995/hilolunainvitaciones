import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import type { Invitation } from "@/types/invitation";
import type { GalleryLayout, HeroLayout, InvitationTemplate } from "@/types/invitation-template";
import type { Personalization } from "@/types/public-rsvp";
import { NOW, visibleText } from "./helpers";

/**
 * Variantes de bloque que completó D-45 (portada `split`/`editorial`, galería `masonry`/`carousel`),
 * probadas sobre la MISMA invitación y la misma plantilla base (Magnolia) para aislar la variante.
 */
const withLayout = (hero: HeroLayout, gallery: GalleryLayout): InvitationTemplate => ({ ...magnoliaTemplate, layout: { ...magnoliaTemplate.layout, hero, gallery } });
const guest: Personalization = {
  kind: "guest",
  invitationSlug: "andrea-y-fernando",
  token: "T".repeat(32),
  guest: { displayName: "Mariana López", groupName: "Amigos", maxCompanions: 2 },
  questions: [],
};
const render = (template: InvitationTemplate, invitation: Invitation = andreaFernandoInvitation, personalization?: Personalization) =>
  renderToStaticMarkup(<InvitationRenderer invitation={invitation} template={template} now={NOW} personalization={personalization} />);

describe.each<HeroLayout>(["centered", "split", "editorial"])("portada %s", (hero) => {
  const template = withLayout(hero, "grid");

  it("declara su variante y conserva el id de sección, el aria-label y el botón de apertura", () => {
    const html = render(template);
    expect(html).toContain(`data-hero-layout="${hero}"`);
    expect(html).toContain('aria-label="Andrea y Fernando"');
    expect(visibleText(html)).toContain("Abrir invitación");
    expect(html).toContain('id="sec_hero"');
  });

  it("muestra el saludo personalizado solo con un invitado válido", () => {
    expect(render(template, andreaFernandoInvitation, guest)).toContain("data-guest-greeting");
    expect(render(template)).not.toContain("data-guest-greeting");
  });

  it("el nombre es un único h1 con los nombres y el '&' en líneas separadas", () => {
    const html = render(template);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "";
    expect(visibleText(h1)).toBe("Andrea & Fernando");
  });

  it("el velo del usuario (overlay) y la imagen de portada propia siguen funcionando", () => {
    const withOverlay: Invitation = { ...andreaFernandoInvitation, sections: andreaFernandoInvitation.sections.map((s) => (s.type === "hero" ? { ...s, overlay: true } : s)) };
    expect(render(template, withOverlay)).toContain("data-overlay");
    expect(render(template)).not.toContain("data-overlay");
    const ownPhoto: Invitation = { ...andreaFernandoInvitation, cover: { ...andreaFernandoInvitation.cover, photo: { src: "/templates/magnolia/gallery-couple.png", alt: "Foto propia de la pareja", width: 1122, height: 1402 } } };
    expect(render(template, ownPhoto)).toContain(encodeURIComponent("/templates/magnolia/gallery-couple.png"));
  });
});

describe("portada: la alineación del usuario se respeta", () => {
  const alignHero = (align: "left" | "center" | "right"): Invitation => ({ ...andreaFernandoInvitation, sections: andreaFernandoInvitation.sections.map((s) => (s.type === "hero" ? { ...s, align } : s)) });

  it.each(["split", "editorial"] as const)("%s: left/center/right cambian la alineación del bloque de texto", (hero) => {
    const template = withLayout(hero, "grid");
    expect(render(template, alignHero("left"))).toContain("items-start text-left");
    expect(render(template, alignHero("right"))).toContain("items-end text-right");
    expect(render(template, alignHero("center"))).toContain("items-center text-center");
  });

  it("solo la portada editorial lleva el velo de legibilidad (data-scrim); split y centered no cambian", () => {
    expect(render(withLayout("editorial", "grid"))).toContain("data-scrim");
    expect(render(withLayout("split", "grid"))).not.toContain("data-scrim");
    expect(render(withLayout("centered", "grid"))).not.toContain("data-scrim");
  });

  it("editorial sin ajuste del usuario se alinea a la izquierda; split y centered, al centro", () => {
    expect(render(withLayout("editorial", "grid"))).toContain("items-start text-left");
    const split = render(withLayout("split", "grid"));
    expect(split).toContain("items-center text-center");
  });
});

describe("galería carousel", () => {
  const html = render(withLayout("centered", "carousel"));

  it("es una región con foco de teclado y etiqueta accesible, con scroll-snap y sin JavaScript", () => {
    expect(html).toContain('data-gallery-layout="carousel"');
    const tag = /<ul\b[^>]*data-gallery-layout="carousel"[^>]*>/.exec(html)?.[0] ?? "";
    expect(tag).toContain('tabindex="0"');
    expect(tag).toMatch(/aria-label="[^"]*desliza para ver más\)"/);
    expect(tag).toContain("snap-x");
  });

  it("dibuja todas las fotos de la galería, en orden, con su texto alternativo", () => {
    const items = andreaFernandoInvitation.gallery;
    expect(items.length).toBeGreaterThan(1);
    let last = -1;
    for (const image of items) {
      const index = html.indexOf(encodeURIComponent(image.src ?? ""));
      expect(index, image.id).toBeGreaterThan(last);
      last = index;
    }
  });
});

describe("galería masonry", () => {
  const html = render(withLayout("centered", "masonry"));

  it("es una sola lista (orden DOM = orden visual) con las fotos alternando proporción", () => {
    expect(html).toContain('data-gallery-layout="masonry"');
    const list = /<ul\b[^>]*data-gallery-layout="masonry"[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
    expect(list).not.toContain("<ul");
    expect(list.match(/<li\b/g)?.length).toBe(andreaFernandoInvitation.gallery.length);
    expect(list).toMatch(/aspect-\[4\/5\]/);
    expect(list).toMatch(/aspect-square/);
  });
});

describe("galería grid (variante por defecto): marcado intacto", () => {
  it("conserva el mosaico asimétrico de [06]", () => {
    const html = render(withLayout("centered", "grid"));
    expect(html).toContain('data-gallery-layout="grid"');
    expect(html).toContain("row-span-3");
    expect(html).not.toContain("snap-x");
  });
});

describe("la cursiva del titular display", () => {
  it("por defecto es cursiva (utilidad inv-italic, sin variable que la apague)", () => {
    const html = render(magnoliaTemplate);
    expect(html).toContain("inv-italic");
    expect(html).not.toContain("--inv-italic");
  });

  it("con fonts.italic = false el contenedor publica --inv-italic: normal", () => {
    const html = render({ ...magnoliaTemplate, fonts: { ...magnoliaTemplate.fonts, italic: false } });
    expect(html).toContain("--inv-italic:normal");
  });
});
