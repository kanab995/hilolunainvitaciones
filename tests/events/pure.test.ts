import { describe, expect, it } from "vitest";
import { validateCreateEventInput } from "@/lib/events/create-event-input";
import { createDefaultInvitationData, defaultSectionOrder } from "@/lib/events/default-invitation";
import { eventTypeConfigs, eventTypeLabel, onboardingEventTypes } from "@/lib/events/event-types";
import { eventSlugBase, invitationSlugBase, isValidSlug, pickUniqueSlug, slugify } from "@/lib/events/slug";
import { checkTemplateForEvent, templatesFor } from "@/lib/events/template-compat";
import { dbInvitationToDomain, domainInvitationToDb, type InvitationAggregateRow } from "@/server/mappers/invitation";
import { eventTypeToDb } from "@/server/mappers/enums";
import { templates } from "@/lib/content/templates";

const good = { templateSlug: "magnolia", eventType: "wedding", name1: "Andrea", name2: "Fernando", date: "2027-05-17", time: "17:00", timezone: "America/Mexico_City" };

describe("Slugs", () => {
  it("normalizan: minúsculas, sin acentos ni caracteres inseguros", () => {
    expect(slugify("Andrea & Fernando")).toBe("andrea-fernando");
    expect(slugify("  María José Núñez!! ")).toBe("maria-jose-nunez");
    expect(slugify("<script>alert(1)</script>")).toBe("script-alert-1-script");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  });

  it("evento e invitación se generan por separado (no son siempre iguales)", () => {
    expect(eventSlugBase("Andrea & Fernando")).toBe("andrea-fernando");
    expect(invitationSlugBase(["Andrea", "Fernando"])).toBe("andrea-y-fernando");
    expect(invitationSlugBase(["Sofía"])).toBe("sofia");
  });

  it("respetan las reglas de ROUTES §2 (3–60, sin guiones dobles) y evitan el prefijo demo-", () => {
    for (const text of ["A", "!!", "x".repeat(200), "Demo Andrea", "  -- "]) {
      for (const slug of [eventSlugBase(text), invitationSlugBase([text])]) {
        expect(isValidSlug(slug), `${text} → ${slug}`).toBe(true);
        expect(slug.startsWith("demo-")).toBe(false);
      }
    }
  });

  it("11. son únicos: si existe se usa -2, -3… y respeta el largo máximo", () => {
    expect(pickUniqueSlug("andrea-fernando", new Set())).toBe("andrea-fernando");
    expect(pickUniqueSlug("andrea-fernando", new Set(["andrea-fernando"]))).toBe("andrea-fernando-2");
    expect(pickUniqueSlug("andrea-fernando", new Set(["andrea-fernando", "andrea-fernando-2"]))).toBe("andrea-fernando-3");
    const long = "a".repeat(60);
    const next = pickUniqueSlug(long, new Set([long]));
    expect(next.length).toBeLessThanOrEqual(60);
    expect(isValidSlug(next)).toBe(true);
  });
});

describe("Validación del alta (lista blanca, servidor autoritativo)", () => {
  it("acepta una boda válida y calcula el instante con la zona IANA", () => {
    const result = validateCreateEventInput(good);
    expect(result).toMatchObject({ ok: true, value: { eventType: "wedding", names: ["Andrea", "Fernando"], title: "Andrea & Fernando", timezone: "America/Mexico_City", startsAtIso: "2027-05-17T17:00:00-06:00" } });
  });

  it("un evento de un solo nombre usa ese nombre como título", () => {
    expect(validateCreateEventInput({ ...good, eventType: "birthday", name1: "  Laura  ", name2: "ignorado" })).toMatchObject({ ok: true, value: { names: ["Laura"], title: "Laura" } });
  });

  it("rechaza datos inválidos con mensajes por campo", () => {
    const result = validateCreateEventInput({ templateSlug: "../x", eventType: "boda", name1: "", name2: "", date: "2027-02-30", time: "25:00", timezone: "Mordor/Isengard" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["date", "eventType", "name1", "templateSlug", "time", "timezone"].sort());
    const long = validateCreateEventInput({ ...good, name1: "x".repeat(31) });
    expect(long).toMatchObject({ ok: false, errors: { name1: expect.stringContaining("30") } });
    expect(validateCreateEventInput({ ...good, name2: "" })).toMatchObject({ ok: false, errors: { name2: "Escribe el nombre 2." } });
  });

  it("limpia los nombres (texto plano) y NO permite fechas pasadas bloqueadas: una fecha histórica es válida", () => {
    expect(validateCreateEventInput({ ...good, name1: "  An\u0000drea\n  ", date: "2001-01-01" })).toMatchObject({ ok: true, value: { names: ["An drea", "Fernando"] } });
  });

  it("ignora cualquier campo que no sea de la lista blanca (ownerId, status, slug…)", () => {
    const result = validateCreateEventInput({ ...good, ownerId: "usr_B", status: "PUBLISHED", slug: "hack" } as never);
    expect(result.ok && Object.keys(result.value).sort()).toEqual(["date", "eventType", "names", "startsAtIso", "templateSlug", "time", "timezone", "title"]);
  });
});

describe("Tipos de evento", () => {
  it("siete tipos con etiquetas y valores de base de datos estables (sin categorías duplicadas)", () => {
    expect(onboardingEventTypes.map((type) => eventTypeLabel(type))).toEqual(["Boda", "XV años", "Bautizo", "Cumpleaños", "Baby shower", "Graduación", "Otro"]);
    expect(onboardingEventTypes.map((type) => eventTypeToDb[type])).toEqual(["WEDDING", "QUINCEANERA", "BAPTISM", "BIRTHDAY", "BABY_SHOWER", "GRADUATION", "OTHER"]);
    expect(new Set(onboardingEventTypes.map((type) => eventTypeConfigs[type].label)).size).toBe(7);
  });
});

describe("Compatibilidad plantilla ↔ tipo", () => {
  const magnolia = templates.find((t) => t.slug === "magnolia")!;
  const ivory = templates.find((t) => t.status === "concept")!;
  const soon = templates.find((t) => t.status === "comingSoon")!;

  it("Magnolia sirve para bodas y solo para bodas", () => {
    expect(checkTemplateForEvent(magnolia, "wedding", "Boda")).toEqual({ ok: true });
    expect(checkTemplateForEvent(magnolia, "birthday", "Cumpleaños")).toMatchObject({ ok: false, reason: "incompatible" });
    expect(checkTemplateForEvent(magnolia, "quinceanera", "XV años")).toMatchObject({ ok: false, reason: "incompatible", message: expect.stringContaining("xv años") });
  });

  it("concept y comingSoon no se pueden usar; una plantilla inexistente tampoco", () => {
    expect(checkTemplateForEvent(ivory, ivory.eventType, "Boda")).toMatchObject({ ok: false, reason: "not_available" });
    expect(checkTemplateForEvent(soon, soon.eventType, "Boda")).toMatchObject({ ok: false, reason: "not_available" });
    expect(checkTemplateForEvent(undefined, "wedding", "Boda")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("la lista de candidatas por tipo solo incluye diseños aprobados", () => {
    expect(templatesFor(templates, "wedding").map((t) => t.slug)).toEqual(["magnolia"]);
    expect(templatesFor(templates, "birthday").map((t) => t.slug)).toEqual(["level-12", "spider-friends"]);
    // Étoile también es "quinceanera" pero sigue en concept: la única candidata aprobada es Aurora XV.
    expect(templatesFor(templates, "quinceanera").map((t) => t.slug)).toEqual(["aurora-xv"]);
    expect(templatesFor(templates, "baptism").map((t) => t.slug)).toEqual(["celeste"]);
  });
});

describe("createDefaultInvitationData (contenido inicial neutro)", () => {
  const build = (eventType: (typeof onboardingEventTypes)[number] = "wedding") =>
    createDefaultInvitationData({ eventType, templateSlug: "magnolia", names: ["Sofía", "Diego"], startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", invitationSlug: "sofia-y-diego" });

  it("10. crea las secciones en el orden aprobado, todas visibles y con ids únicos", () => {
    const invitation = build();
    expect(invitation.sections.map((section) => section.type)).toEqual([...defaultSectionOrder]);
    expect(invitation.sections.map((section) => section.type)).toEqual(["hero", "story", "countdown", "locations", "timeline", "gallery", "dressCode", "giftRegistry", "rsvp", "footer"]);
    expect(invitation.sections.every((section) => section.isVisible)).toBe(true);
    expect(new Set(invitation.sections.map((section) => section.id)).size).toBe(10);
  });

  it("no copia los datos de la demostración ni inventa contenido", () => {
    const json = JSON.stringify(build());
    for (const forbidden of ["Andrea", "Fernando", "Liverpool", "Amazon", "Ed Sheeran", "Parroquia", "Hacienda", "lorem", "/templates/magnolia"]) expect(json, forbidden).not.toContain(forbidden);
    const invitation = build();
    expect(invitation.names).toEqual(["Sofía", "Diego"]);
    expect(invitation.story.paragraphs).toEqual(["Queremos compartir contigo un día muy especial."]);
    expect(invitation.rsvp).toMatchObject({ enabled: true, message: "Nos encantará contar contigo." });
  });

  it("sin activos ni datos ficticios: sin portada propia, galería y itinerario vacíos, sin regalos ni música, sedes vacías", () => {
    const invitation = build();
    expect(invitation.cover.photo).toBeUndefined();
    expect(invitation.gallery).toEqual([]);
    expect(invitation.timeline).toEqual([]);
    expect(invitation.giftRegistry).toBeUndefined();
    expect(invitation.music).toBeUndefined();
    expect(invitation.locations.map((location) => [location.kind, location.name, location.addressLines])).toEqual([
      ["ceremony", "", [""]],
      ["reception", "", [""]],
    ]);
    expect(invitation.locations.every((location) => !location.mapUrl && !location.photo)).toBe(true);
    expect(JSON.stringify(invitation)).not.toContain("mediaAssetId");
  });

  it("la fecha y la zona salen de los datos del evento; la plantilla es la elegida", () => {
    expect(build()).toMatchObject({ templateSlug: "magnolia", eventType: "wedding", contentVersion: 1, event: { startsAt: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City" }, slug: "sofia-y-diego" });
  });

  it("cada tipo de evento tiene su copy neutro y sus sedes (no solo bodas)", () => {
    expect(build("birthday").locations.map((location) => location.kind)).toEqual(["other"]);
    expect(build("quinceanera").cover.eyebrow).toBe("Mis XV años");
    for (const type of onboardingEventTypes) expect(() => build(type)).not.toThrow();
  });

  it("sobrevive al viaje dominio → BD → dominio sin perder ni inventar nada (los mappers lo entienden)", () => {
    const invitation = build();
    const write = domainInvitationToDb(invitation);
    const row: InvitationAggregateRow = {
      ...write.invitation,
      template: { slug: invitation.templateSlug },
      sections: write.sections,
      event: {
        id: "evt",
        type: eventTypeToDb[invitation.eventType],
        startsAt: new Date(invitation.event.startsAt),
        timezone: invitation.event.timezone,
        locations: write.locations,
        timelineItems: write.timelineItems,
        galleryImages: write.galleryImages,
        giftRegistry: write.giftRegistry,
        music: write.music ?? null,
      },
    };
    const back = dbInvitationToDomain(row);
    expect(back.sections.map((section) => section.type)).toEqual(invitation.sections.map((section) => section.type));
    expect(back.locations).toHaveLength(2);
    expect(back.gallery).toEqual([]);
    expect(back.giftRegistry).toBeUndefined();
    expect(back.music).toBeUndefined();
    expect(back.dressCode).toEqual({ style: "", description: "", palette: [] });
    expect(back.story).toEqual(invitation.story);
    expect(back.names).toEqual(["Sofía", "Diego"]);
  });
});
