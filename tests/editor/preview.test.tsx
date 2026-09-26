import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewSurface } from "@/components/editor/preview-surface";
import { createDraftState, draftReducer } from "@/lib/editor/draft-reducer";
import { draftFromMessage, isPreviewDraftMessage, PREVIEW_DRAFT_MESSAGE, PREVIEW_READY_MESSAGE } from "@/lib/editor/preview-channel";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import type { Invitation } from "@/types/invitation";
import { NOW, render, visibleText } from "../invitation/helpers";

/** En el editor «Agregar al calendario» es un botón deshabilitado (no descarga el .ics publicado, que aún no refleja el borrador); es la única diferencia con la página pública. */
const withoutCalendarCta = (html: string) => html.replace(/<a [^>]*data-calendar-cta[^>]*>[\s\S]*?<\/a>/, "").replace(/<span aria-disabled="true"[^>]*>[\s\S]*?<\/span>/, "");

const ORIGIN = "http://localhost:3000";
const message = (invitation: Invitation, origin = ORIGIN) => ({ origin, data: { type: PREVIEW_DRAFT_MESSAGE, invitation } });

describe("la vista previa usa el MISMO InvitationRenderer que la página pública", () => {
  it("con el borrador sin cambios el HTML del editor es idéntico al de la invitación pública", () => {
    const preview = renderToStaticMarkup(<PreviewSurface initial={andreaFernandoInvitation} now={NOW} />);
    expect(withoutCalendarCta(preview)).toBe(withoutCalendarCta(render(andreaFernandoInvitation, magnoliaTemplate)));
  });

  it("mismos datos + misma plantilla = mismo resultado", () => {
    const draft = createDraftState(andreaFernandoInvitation);
    const edited = draftReducer(draft, { type: "updateInvitation", patch: { names: ["Alejandra", "Fernando"] } }).draft;
    const inPreview = renderToStaticMarkup(<PreviewSurface initial={edited} now={NOW} />);
    expect(withoutCalendarCta(inPreview)).toBe(withoutCalendarCta(render(edited, magnoliaTemplate)));
  });
});

describe("2. el preview recibe el draft actualizado", () => {
  it("un mensaje del mismo origen entrega el borrador y la vista lo dibuja", () => {
    const edited = draftReducer(createDraftState(andreaFernandoInvitation), { type: "updateInvitation", patch: { names: ["Alejandra", "Fernando"] } }).draft;
    const received = draftFromMessage(message(edited), ORIGIN);
    expect(received).toBe(edited);
    expect(visibleText(render(received as Invitation, magnoliaTemplate))).toContain("Alejandra");
    expect(visibleText(render(andreaFernandoInvitation, magnoliaTemplate))).not.toContain("Alejandra");
  });

  it("ignora mensajes de otro origen o con otra forma", () => {
    expect(draftFromMessage(message(andreaFernandoInvitation, "https://malo.example"), ORIGIN)).toBeNull();
    expect(draftFromMessage({ origin: ORIGIN, data: { type: "otro" } }, ORIGIN)).toBeNull();
    expect(draftFromMessage({ origin: ORIGIN, data: "hola" }, ORIGIN)).toBeNull();
    expect(draftFromMessage({ origin: ORIGIN, data: null }, ORIGIN)).toBeNull();
    expect(isPreviewDraftMessage({ type: PREVIEW_DRAFT_MESSAGE, invitation: { sections: [], names: [] } })).toBe(false);
    expect(PREVIEW_READY_MESSAGE).not.toBe(PREVIEW_DRAFT_MESSAGE);
  });
});

describe("3. ocultar una sección hace que InvitationRenderer deje de mostrarla", () => {
  it("la sección desaparece del preview y vuelve al mostrarla", () => {
    const initial = createDraftState(andreaFernandoInvitation);
    const hidden = draftReducer(initial, { type: "toggleSection", id: "sec_story" }).draft;
    expect(render(hidden, magnoliaTemplate)).not.toContain('data-section="story"');
    expect(visibleText(render(hidden, magnoliaTemplate))).not.toContain("Hay momentos en la vida");
    expect(render(andreaFernandoInvitation, magnoliaTemplate)).toContain('data-section="story"');

    const shown = draftReducer(createDraftState(hidden), { type: "toggleSection", id: "sec_story" }).draft;
    expect(render(shown, magnoliaTemplate)).toContain('data-section="story"');
  });

  it("reordenar en el borrador cambia el orden dibujado sin cambiar el texto", () => {
    const moved = draftReducer(createDraftState(andreaFernandoInvitation), { type: "moveSection", id: "sec_timeline", direction: "down" }).draft;
    const html = render(moved, magnoliaTemplate);
    expect(html.indexOf('data-section="gallery"')).toBeLessThan(html.indexOf('data-section="timeline"'));
    expect(html.indexOf('data-section="timeline"')).toBeLessThan(html.indexOf('data-section="dressCode"'));
    const sortedWords = (text: string) => text.split(" ").sort().join(" ");
    expect(sortedWords(visibleText(html))).toBe(sortedWords(visibleText(render(andreaFernandoInvitation, magnoliaTemplate))));
  });
});

describe("ajustes de portada del editor", () => {
  const draft = (patch: (d: Invitation) => Invitation) => patch(structuredClone(andreaFernandoInvitation));
  const heroSection = (invitation: Invitation) => invitation.sections.find((section) => section.type === "hero");

  it("si existe cover.photo se usa la foto del usuario; si no, el fondo de la plantilla", () => {
    const withPhoto = draft((d) => ({ ...d, cover: { ...d.cover, photo: { src: "blob:http://localhost:3000/abc", alt: "Nuestra foto" } } }));
    const html = render(withPhoto, magnoliaTemplate);
    expect(html).toContain("blob:http://localhost:3000/abc");
    expect(html).not.toContain(encodeURIComponent("/templates/magnolia/cover-bg.png"));
    expect(render(andreaFernandoInvitation, magnoliaTemplate)).toContain(encodeURIComponent("/templates/magnolia/cover-bg.png"));
  });

  it("la alineación es el ajuste ya existente `section.align` (no un mecanismo paralelo)", () => {
    const left = draft((d) => ({ ...d, sections: d.sections.map((s) => (s.type === "hero" ? { ...s, align: "left" as const } : s)) }));
    expect(heroSection(left)?.align).toBe("left");
    expect(render(left, magnoliaTemplate)).toContain("items-start text-left");
    expect(render(andreaFernandoInvitation, magnoliaTemplate)).toContain("items-center text-center");
  });

  it("el overlay pone un velo sobre la imagen y sin él no hay velo", () => {
    const on = draft((d) => ({ ...d, sections: d.sections.map((s) => (s.type === "hero" ? { ...s, overlay: true } : s)) }));
    expect(render(on, magnoliaTemplate)).toContain("data-overlay");
    expect(render(andreaFernandoInvitation, magnoliaTemplate)).not.toContain("data-overlay");
  });

  it("las fuentes elegidas (solo Cormorant e Inter) se aplican por plantilla como variables del tema", () => {
    const inter = draft((d) => ({ ...d, styleOverrides: { magnolia: { fonts: { names: "inter" as const } } } }));
    const html = render(inter, magnoliaTemplate);
    expect(html).toContain("--inv-font-names:var(--font-inter)");
    expect(render(andreaFernandoInvitation, magnoliaTemplate)).not.toContain("--inv-font-names:");
  });

  it("los nombres vacíos no se dibujan y un nombre borrado no rompe la portada", () => {
    const html = render(draft((d) => ({ ...d, names: ["Andrea", ""] })), magnoliaTemplate);
    expect(visibleText(html)).toContain("Andrea");
    expect(visibleText(html)).not.toContain("Andrea &");
  });

  it("el texto del botón del RSVP sale de rsvp.ctaLabel", () => {
    const html = render(draft((d) => ({ ...d, rsvp: { ...d.rsvp, ctaLabel: "Cuenta conmigo" } })), magnoliaTemplate);
    expect(visibleText(html)).toContain("Cuenta conmigo");
  });

  it("la historia conserva los párrafos y no interpreta HTML", () => {
    const html = render(draft((d) => ({ ...d, story: { paragraphs: ["Primero <b>negrita</b>", "Segundo"] } })), magnoliaTemplate);
    expect(html).toContain("Primero &lt;b&gt;negrita&lt;/b&gt;");
    expect(html).not.toContain("<b>negrita</b>");
  });
});
