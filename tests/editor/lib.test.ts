import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaver, type AutosaveState } from "@/lib/editor/autosave";
import { isoToZonedParts, isValidDate, isValidTime, zonedPartsToIso } from "@/lib/editor/datetime";
import { createObjectUrlRegistry, isLocalImageUrl, validateImageFile } from "@/lib/editor/local-images";
import { buildEditorRows, DATE_ROW_ID, MUSIC_ROW_ID } from "@/lib/editor/rows";
import { getTemplateChoices, canSelectTemplate } from "@/lib/editor/template-choice";
import { first, maxLength, required, url, validateInvitation } from "@/lib/editor/validation";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import type { Invitation } from "@/types/invitation";

describe("autoguardado (máquina de estados)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (overrides: { save?: (v: string) => Promise<void>; validate?: (v: string) => string | undefined } = {}) => {
    const states: AutosaveState[] = [];
    const save = vi.fn(overrides.save ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 450))));
    const saver = createAutosaver<string>({ initial: "a", save, validate: overrides.validate, delayMs: 800, onChange: (s) => states.push(s) });
    return { saver, save, states, last: () => states.at(-1)?.status };
  };

  it("cada cambio marca dirty; tras el debounce guarda («Guardando…») y termina en «Guardado»", async () => {
    const { saver, save, last } = setup();
    expect(saver.getState().status).toBe("idle"); // «Sin cambios» hasta el primer guardado
    saver.notify("b");
    expect(last()).toBe("dirty");
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(last()).toBe("saving");
    expect(save).toHaveBeenCalledWith("b");
    await vi.advanceTimersByTimeAsync(450);
    expect(last()).toBe("saved");
  });

  it("no guarda por cada tecla: varios cambios seguidos producen un solo guardado con el último valor", async () => {
    const { saver, save } = setup();
    for (const value of ["b", "bc", "bcd", "bcde"]) {
      saver.notify(value);
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800 + 450);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("bcde");
  });

  it("un cambio durante el guardado programa otro y termina guardado", async () => {
    const { saver, save, last } = setup();
    saver.notify("b");
    await vi.advanceTimersByTimeAsync(800);
    expect(last()).toBe("saving");
    saver.notify("c");
    await vi.advanceTimersByTimeAsync(450);
    await vi.advanceTimersByTimeAsync(800 + 450);
    expect(save).toHaveBeenLastCalledWith("c");
    expect(last()).toBe("saved");
  });

  it("volver al valor guardado deja el estado en «Guardado» sin guardar", async () => {
    const { saver, save, last } = setup();
    saver.notify("b");
    saver.notify("a");
    expect(last()).toBe("saved");
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("si guardar falla muestra «Error al guardar» y otro cambio o «reintentar» lo recupera", async () => {
    let fail = true;
    const { saver, last, states } = setup({ save: async () => { if (fail) throw new Error("Sin conexión"); } });
    saver.notify("b");
    await vi.advanceTimersByTimeAsync(800);
    expect(last()).toBe("error");
    expect(states.at(-1)?.message).toBe("Sin conexión");
    fail = false;
    await saver.flush();
    expect(last()).toBe("saved");
  });

  it("no guarda mientras haya errores de validación", async () => {
    const { saver, save, last, states } = setup({ validate: (v) => (v === "mal" ? "Corrige los campos" : undefined) });
    saver.notify("mal");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).not.toHaveBeenCalled();
    expect(last()).toBe("error");
    expect(states.at(-1)?.message).toBe("Corrige los campos");
    saver.notify("bien");
    await vi.advanceTimersByTimeAsync(800 + 450);
    expect(save).toHaveBeenCalledWith("bien");
    expect(last()).toBe("saved");
  });
});

describe("fecha y hora en la zona del evento", () => {
  it("convierte ISO ↔ fecha y hora locales sin perder información", () => {
    const { startsAt, timezone } = andreaFernandoInvitation.event;
    expect(isoToZonedParts(startsAt, timezone)).toEqual({ date: "2027-05-17", time: "17:00" });
    expect(zonedPartsToIso("2027-05-17", "17:00", timezone)).toBe("2027-05-17T17:00:00-06:00");
  });

  it("respeta el desfase de otras zonas y del horario de verano", () => {
    expect(zonedPartsToIso("2027-07-01", "20:30", "America/New_York")).toBe("2027-07-01T20:30:00-04:00");
    expect(zonedPartsToIso("2027-01-15", "20:30", "America/New_York")).toBe("2027-01-15T20:30:00-05:00");
    expect(zonedPartsToIso("2027-05-17", "17:00", "Asia/Tokyo")).toBe("2027-05-17T17:00:00+09:00");
    // Ida y vuelta: el mismo instante.
    const iso = zonedPartsToIso("2027-10-31", "01:30", "America/Mexico_City") as string;
    expect(isoToZonedParts(iso, "America/Mexico_City")).toEqual({ date: "2027-10-31", time: "01:30" });
  });

  it("rechaza fechas y horas inválidas", () => {
    expect(isValidDate("2027-02-30")).toBe(false);
    expect(isValidDate("2027-13-01")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("7:5")).toBe(false);
    expect(zonedPartsToIso("2027-02-30", "10:00", "America/Mexico_City")).toBeUndefined();
    expect(zonedPartsToIso("2027-02-28", "", "America/Mexico_City")).toBeUndefined();
    expect(isoToZonedParts("no es fecha", "America/Mexico_City")).toBeUndefined();
  });
});

describe("validaciones ligeras (sin Zod)", () => {
  it("campos requeridos, longitudes y URL", () => {
    expect(required("  ", "El nombre")).toMatch(/obligatorio/);
    expect(required("Ana", "El nombre")).toBeUndefined();
    expect(maxLength("abc", 2, "El texto")).toMatch(/hasta 2/);
    expect(url("", "El enlace")).toBeUndefined();
    expect(url("", "El enlace", { required: true })).toMatch(/obligatorio/);
    expect(url("https://ejemplo.com/ruta?x=1", "El enlace")).toBeUndefined();
    expect(url("ejemplo.com", "El enlace")).toMatch(/no es una dirección válida/);
    expect(url("javascript:alert(1)", "El enlace")).toMatch(/http/);
    expect(url("http://ejemplo.com", "El enlace", { httpsOnly: true })).toMatch(/https/);
    expect(first(undefined, "b", "c")).toBe("b");
  });

  it("la invitación de ejemplo es válida y los errores se reportan por campo", () => {
    expect(validateInvitation(andreaFernandoInvitation)).toEqual({});

    const broken: Invitation = {
      ...andreaFernandoInvitation,
      names: ["", "x".repeat(31)],
      timeline: [{ id: "tl_x", time: "25:99", label: "", icon: "other" }],
      giftRegistry: { message: "m", entries: [{ id: "g_x", name: "Tienda", url: "no-url" }] },
      music: { sourceType: "external", externalUrl: "http://inseguro.example", title: "", autoplayAfterInteraction: false, volume: 1, loop: false },
    };
    const errors = validateInvitation(broken);
    expect(errors["names.0"]).toMatch(/obligatorio/);
    expect(errors["names.1"]).toMatch(/hasta 30/);
    expect(errors["timeline.tl_x.time"]).toMatch(/hora válida/);
    expect(errors["timeline.tl_x.label"]).toMatch(/obligatorio/);
    expect(errors["giftRegistry.g_x.url"]).toMatch(/no es una dirección válida/);
    expect(errors["music.externalUrl"]).toMatch(/https/);
    expect(errors["music.title"]).toMatch(/obligatorio/);
  });
});

describe("imágenes locales de la vista previa", () => {
  it("acepta JPG, PNG y WEBP hasta 10 MB (mismas reglas que el servidor)", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeUndefined();
    expect(validateImageFile({ type: "image/jpeg", size: 1000 })).toBeUndefined();
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeUndefined();
    expect(validateImageFile({ type: "image/gif", size: 1000 })).toMatch(/JPG, PNG o WEBP/);
    expect(validateImageFile({ type: "application/pdf", size: 1000 })).toBeDefined();
    expect(validateImageFile({ type: "image/png", size: 9 * 1024 * 1024 })).toBeUndefined();
    expect(validateImageFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toBe("La imagen supera el tamaño máximo permitido.");
  });

  it("revoca cada URL de objeto una sola vez al sustituir o eliminar, y ninguna ajena", () => {
    let n = 0;
    const revoked: string[] = [];
    const registry = createObjectUrlRegistry({ createObjectURL: () => `blob:local/${++n}`, revokeObjectURL: (u) => revoked.push(u) });

    const first = registry.create(new Blob(["a"]));
    const second = registry.create(new Blob(["b"]));
    expect(registry.size).toBe(2);
    expect(isLocalImageUrl(first)).toBe(true);
    expect(isLocalImageUrl("/templates/magnolia/cover-bg.png")).toBe(false);

    registry.revoke(first); // sustituir
    registry.revoke(first); // no se revoca dos veces
    registry.revoke("/templates/magnolia/cover-bg.png"); // asset propio: se ignora
    registry.revoke(undefined);
    expect(revoked).toEqual([first]);

    registry.revokeAll(); // salir del editor
    expect(revoked).toEqual([first, second]);
    expect(registry.size).toBe(0);
  });
});

describe("filas de la lista lateral", () => {
  const rows = buildEditorRows(andreaFernandoInvitation);

  it("Portada · Fecha · secciones en el orden del borrador · Música", () => {
    expect(rows.map((row) => row.type)).toEqual(["hero", "date", "story", "countdown", "locations", "timeline", "gallery", "dressCode", "giftRegistry", "rsvp", "footer", "music"]);
    expect(rows[1]?.id).toBe(DATE_ROW_ID);
    expect(rows.at(-1)?.id).toBe(MUSIC_ROW_ID);
  });

  it("Fecha y Música son datos fijos; la portada y el cierre están fijos; el resto se puede mover", () => {
    const byType = Object.fromEntries(rows.map((row) => [row.type, row]));
    for (const fixed of ["hero", "date", "footer", "music"]) expect(byType[fixed]?.pinned).toBe(true);
    for (const free of ["story", "countdown", "locations", "timeline", "gallery", "giftRegistry", "rsvp", "dressCode"]) expect(byType[free]?.pinned).toBe(false);
    expect(byType.date?.isSection).toBe(false);
    expect(byType.music?.isSection).toBe(false);
  });

  it("refleja la visibilidad del borrador", () => {
    const hidden = { ...andreaFernandoInvitation, sections: andreaFernandoInvitation.sections.map((s) => (s.type === "gallery" ? { ...s, isVisible: false } : s)) };
    expect(buildEditorRows(hidden).find((r) => r.type === "gallery")?.visible).toBe(false);
  });
});

describe("cambio de plantilla en el editor", () => {
  it("Magnolia, Level 12 y Aurora XV son seleccionables; Ivory y Étoile aparecen como próximamente; las comingSoon no se listan", () => {
    const choices = getTemplateChoices();
    expect(choices.map((c) => [c.slug, c.status, c.selectable])).toEqual([
      ["magnolia", "implemented", true],
      ["ivory", "concept", false],
      ["etoile", "concept", false],
      ["level-12", "implemented", true],
      ["aurora-xv", "implemented", true],
    ]);
    expect(canSelectTemplate("magnolia")).toBe(true);
    expect(canSelectTemplate("level-12")).toBe(true);
    expect(canSelectTemplate("aurora-xv")).toBe(true);
    expect(canSelectTemplate("ivory")).toBe(false);
    expect(canSelectTemplate("noir")).toBe(false);
  });
});
