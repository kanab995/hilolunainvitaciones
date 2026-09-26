import { describe, expect, it } from "vitest";
import { createDraftState, draftReducer, type DraftAction, type DraftState, type InvitationPatch } from "@/lib/editor/draft-reducer";
import { canMoveSection, isPinnedSection } from "@/lib/editor/operations";
import { getCountdown } from "@/lib/invitation/countdown";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import type { Invitation } from "@/types/invitation";
import { deepFreeze } from "../invitation/helpers";

const clone = (): Invitation => structuredClone(andreaFernandoInvitation);
const start = (): DraftState => createDraftState(deepFreeze(clone()));
const run = (state: DraftState, ...actions: DraftAction[]) => actions.reduce(draftReducer, state);
const order = (invitation: Invitation) => invitation.sections.map((section) => section.type);

describe("editar contenido actualiza el borrador (no la invitación inicial)", () => {
  it("1. editar Nombre 1 actualiza draftInvitation", () => {
    const initial = start();
    const next = run(initial, { type: "updateInvitation", patch: (d) => ({ names: ["Alejandra", ...d.names.slice(1)] }) });
    expect(next.draft.names).toEqual(["Alejandra", "Fernando"]);
    expect(initial.draft.names).toEqual(["Andrea", "Fernando"]);
  });

  it("6. cambiar contenido no cambia la plantilla (templateSlug) ni la identidad", () => {
    const state = run(
      start(),
      { type: "updateInvitation", patch: { names: ["Zoe", "Ulises"] } },
      { type: "updateInvitation", patch: (d) => ({ cover: { ...d.cover, eyebrow: "Nos casamos hoy" } }) },
      { type: "updateSection", id: "sec_story", patch: { title: "Otro *título*" } },
      { type: "list", list: "timeline", op: { kind: "patch", id: "tl_1", patch: { label: "Misa" } } },
    );
    expect(state.draft.templateSlug).toBe("magnolia");
    expect(state.draft.id).toBe(andreaFernandoInvitation.id);
    expect(state.draft.slug).toBe(andreaFernandoInvitation.slug);
  });

  it("un cambio de contenido no puede tocar plantilla, identidad ni secciones aunque se eluda el tipo", () => {
    const sneaky = { templateSlug: "ivory", id: "otro", slug: "otro", sections: [] } as unknown as InvitationPatch;
    const state = run(start(), { type: "updateInvitation", patch: { ...sneaky, names: ["A", "B"] } });
    expect(state.draft.names).toEqual(["A", "B"]);
    expect(state.draft.templateSlug).toBe("magnolia");
    expect(state.draft.id).toBe(andreaFernandoInvitation.id);
    expect(state.draft.sections).toHaveLength(andreaFernandoInvitation.sections.length);
  });

  it("5. modificar event.startsAt actualiza la única fuente que usa la cuenta regresiva", () => {
    const now = Date.parse("2027-01-01T00:00:00-06:00");
    const before = getCountdown(start().draft.event.startsAt, now);
    const next = run(start(), { type: "updateInvitation", patch: (d) => ({ event: { ...d.event, startsAt: "2028-05-17T17:00:00-06:00" } }) });
    expect(next.draft.event.startsAt).toBe("2028-05-17T17:00:00-06:00");
    expect(getCountdown(next.draft.event.startsAt, now).days).toBe(before.days + 366);
    // No hay otra fecha guardada en ninguna sección.
    expect(JSON.stringify(next.draft.sections)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("no crea un estado nuevo si el cambio no cambia nada (no ensucia el autoguardado)", () => {
    const initial = start();
    expect(run(initial, { type: "updateSection", id: "no-existe", patch: { title: "x" } })).toBe(initial);
    expect(run(initial, { type: "list", list: "gallery", op: { kind: "remove", id: "no-existe" } })).toBe(initial);
  });
});

describe("visibilidad de secciones", () => {
  it("3. ocultar una sección pone isVisible=false (la única fuente de verdad del renderizador)", () => {
    const next = run(start(), { type: "toggleSection", id: "sec_story" });
    expect(next.draft.sections.find((s) => s.id === "sec_story")?.isVisible).toBe(false);
    // El contenido permanece: ocultar no borra.
    expect(next.draft.story).toEqual(andreaFernandoInvitation.story);
    const again = run(next, { type: "toggleSection", id: "sec_story" });
    expect(again.draft.sections.find((s) => s.id === "sec_story")?.isVisible).toBe(true);
  });

  it("no existe un segundo mecanismo de ocultamiento (la sección no gana campos de visibilidad)", () => {
    const before = andreaFernandoInvitation.sections.find((s) => s.id === "sec_gallery");
    const next = run(start(), { type: "toggleSection", id: "sec_gallery" });
    const after = next.draft.sections.find((s) => s.id === "sec_gallery");
    expect(Object.keys(after ?? {}).sort()).toEqual(Object.keys(before ?? {}).sort());
  });
});

describe("reordenar secciones", () => {
  it("4. mover una sección cambia el orden sin cambiar el contenido", () => {
    const initial = start();
    const next = run(initial, { type: "moveSection", id: "sec_story", direction: "down" });
    expect(order(next.draft)).toEqual(["hero", "countdown", "story", "locations", "timeline", "gallery", "dressCode", "giftRegistry", "rsvp", "footer"]);
    const { sections: _a, ...contentBefore } = initial.draft;
    const { sections: _b, ...contentAfter } = next.draft;
    void _a;
    void _b;
    expect(contentAfter).toEqual(contentBefore);
    // Mismas secciones, mismos objetos (nada se pierde ni se reescribe).
    expect(new Set(next.draft.sections)).toEqual(new Set(initial.draft.sections));
  });

  it("arrastrar y soltar lleva la sección a la posición indicada", () => {
    const next = run(start(), { type: "reorderSection", id: "sec_rsvp", toIndex: 2 });
    expect(order(next.draft)).toEqual(["hero", "story", "rsvp", "countdown", "locations", "timeline", "gallery", "dressCode", "giftRegistry", "footer"]);
  });

  it("la portada va siempre primera y el cierre siempre último", () => {
    const initial = start();
    expect(isPinnedSection({ type: "hero" })).toBe(true);
    expect(canMoveSection(initial.draft.sections, "sec_hero", "down")).toBe(false);
    expect(canMoveSection(initial.draft.sections, "sec_footer", "up")).toBe(false);
    expect(canMoveSection(initial.draft.sections, "sec_story", "up")).toBe(false); // ya está justo tras la portada
    expect(canMoveSection(initial.draft.sections, "sec_rsvp", "down")).toBe(false); // justo antes del cierre

    expect(run(initial, { type: "moveSection", id: "sec_hero", direction: "down" })).toBe(initial);
    expect(run(initial, { type: "moveSection", id: "sec_story", direction: "up" })).toBe(initial);
    const dragged = run(initial, { type: "reorderSection", id: "sec_gallery", toIndex: 0 });
    expect(order(dragged.draft)[0]).toBe("hero");
    const dragEnd = run(initial, { type: "reorderSection", id: "sec_gallery", toIndex: 99 });
    expect(order(dragEnd.draft).at(-1)).toBe("footer");
    expect(run(initial, { type: "reorderSection", id: "sec_hero", toIndex: 3 })).toBe(initial);
  });
});

describe("listas con identidad estable", () => {
  it("8. eliminar una imagen de la galería en el borrador no muta la invitación inicial", () => {
    const initial = start(); // congelada en profundidad: cualquier mutación lanzaría
    const next = run(initial, { type: "list", list: "gallery", op: { kind: "remove", id: "gal_rings" } });
    expect(next.draft.gallery.map((g) => g.id)).toEqual(["gal_couple", "gal_bouquet", "gal_table"]);
    expect(initial.draft.gallery).toHaveLength(4);
    expect(andreaFernandoInvitation.gallery).toHaveLength(4);
  });

  it("itinerario: añadir, editar, reordenar y quitar conservando los ids", () => {
    let state = start();
    state = run(state, { type: "list", list: "timeline", op: { kind: "add", item: { id: "tl_new", time: "23:00", label: "Postre", icon: "other" } } });
    expect(state.draft.timeline.at(-1)?.id).toBe("tl_new");
    state = run(state, { type: "list", list: "timeline", op: { kind: "move", id: "tl_new", direction: "up" } });
    expect(state.draft.timeline.map((t) => t.id)).toEqual(["tl_1", "tl_2", "tl_3", "tl_4", "tl_new", "tl_5"]);
    state = run(state, { type: "list", list: "timeline", op: { kind: "patch", id: "tl_new", patch: { time: "23:30" } } });
    expect(state.draft.timeline.find((t) => t.id === "tl_new")?.time).toBe("23:30");
    state = run(state, { type: "list", list: "timeline", op: { kind: "remove", id: "tl_2" } });
    expect(state.draft.timeline.map((t) => t.id)).toEqual(["tl_1", "tl_3", "tl_4", "tl_new", "tl_5"]);
    // Un id repetido no se añade dos veces.
    const same = run(state, { type: "list", list: "timeline", op: { kind: "add", item: { id: "tl_new", time: "01:00", label: "x", icon: "other" } } });
    expect(same).toBe(state);
  });

  it("regalos: edita las tiendas de giftRegistry (singular) sin renombrar el modelo", () => {
    let state = start();
    state = run(state, { type: "list", list: "giftEntries", op: { kind: "patch", id: "gift_1", patch: { url: "https://ejemplo.com/mesa" } } });
    state = run(state, { type: "list", list: "giftEntries", op: { kind: "add", item: { id: "gift_3", name: "Palacio", url: "https://palacio.mx" } } });
    expect(state.draft.giftRegistry?.entries.map((e) => e.name)).toEqual(["Liverpool", "Amazon", "Palacio"]);
    expect(state.draft.giftRegistry?.entries[0]?.url).toBe("https://ejemplo.com/mesa");
    expect("giftRegistries" in state.draft).toBe(false);
  });

  it("ubicaciones: se editan sin tocar el resto", () => {
    const state = run(start(), { type: "list", list: "locations", op: { kind: "patch", id: "loc_ceremony", patch: { addressLines: ["Calle Nueva 1", "León, Gto."] } } });
    expect(state.draft.locations[0]?.addressLines).toEqual(["Calle Nueva 1", "León, Gto."]);
    expect(state.draft.locations[0]?.mapUrl).toBe(andreaFernandoInvitation.locations[0]?.mapUrl);
    expect(state.draft.locations[1]).toEqual(andreaFernandoInvitation.locations[1]);
  });
});

describe("cambiar de plantilla desde el editor", () => {
  it("7. una plantilla `concept` (Ivory, Étoile) no se puede seleccionar: no cambia la plantilla activa", () => {
    const initial = start();
    expect(run(initial, { type: "selectTemplate", slug: "ivory" })).toBe(initial);
    expect(run(initial, { type: "selectTemplate", slug: "etoile" })).toBe(initial);
    expect(run(initial, { type: "selectTemplate", slug: "noir" })).toBe(initial); // comingSoon
    expect(run(initial, { type: "selectTemplate", slug: "inventada" })).toBe(initial);
  });

  it("una plantilla `implemented` (Magnolia) sí se puede elegir y los datos no cambian", () => {
    const other = deepFreeze({ ...clone(), templateSlug: "ivory" });
    const state = run(createDraftState(other), { type: "selectTemplate", slug: "magnolia" });
    expect(state.draft.templateSlug).toBe("magnolia");
    expect({ ...state.draft, templateSlug: "ivory" }).toEqual(other);
  });
});
