import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentFingerprint } from "@/lib/invitation/change-template";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { dbDateToEventIso, dbInvitationToDomain, domainInvitationToDb, type InvitationAggregateRow } from "@/server/mappers/invitation";
import { dbTemplateToDomain } from "@/server/mappers/template";
import { getDemoRows } from "@/server/repositories/demo-store";
import { buildTemplateRows } from "@/server/seed/demo-data";
import { buildDashboardData, summarizeRsvp } from "@/server/services/dashboard";

const NOW = new Date("2026-09-25T12:00:00Z");
const clean = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
const rows = () => getDemoRows(NOW);

afterEach(() => vi.restoreAllMocks());

describe("Template: designStatus y publicationStatus son independientes", () => {
  it("el estado de diseño del dominio sale de designStatus, no de la publicación", () => {
    const base = buildTemplateRows().find((row) => row.slug === "magnolia")!;
    expect(dbTemplateToDomain(base).status).toBe("implemented");

    // Misma madurez de diseño con otra publicación, y viceversa.
    expect(dbTemplateToDomain({ ...base, publicationStatus: "DRAFT" }).status).toBe("implemented");
    expect(dbTemplateToDomain({ ...base, publicationStatus: "ARCHIVED" }).status).toBe("implemented");
    expect(dbTemplateToDomain({ ...base, designStatus: "COMING_SOON", publicationStatus: "PUBLISHED" }).status).toBe("comingSoon");
    expect(dbTemplateToDomain({ ...base, designStatus: "CONCEPT" }).status).toBe("concept");
  });

  it("el esquema define dos enums distintos, cada uno en su campo", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const enumValues = (name: string) => {
      const body = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)?.[1] ?? "";
      return body.split("\n").map((line) => line.trim().split(/\s/)[0] ?? "").filter((word) => /^[A-Z_]+$/.test(word));
    };
    expect(enumValues("TemplateDesignStatus")).toEqual(["IMPLEMENTED", "CONCEPT", "COMING_SOON"]);
    expect(enumValues("TemplatePublicationStatus")).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
    expect(schema).toMatch(/designStatus\s+TemplateDesignStatus/);
    expect(schema).toMatch(/publicationStatus\s+TemplatePublicationStatus/);
  });

  it("el diseño y la publicación se guardan por separado en la fila", () => {
    const seeded = buildTemplateRows();
    for (const row of seeded) expect(row.publicationStatus).toBe("PUBLISHED");
    expect(new Set(seeded.map((row) => row.designStatus))).toEqual(new Set(["IMPLEMENTED", "CONCEPT", "COMING_SOON"]));
  });
});

describe("Invitation: BD → dominio", () => {
  it("conserva todos los datos de la invitación de demostración", () => {
    expect(clean(dbInvitationToDomain(rows().invitation))).toEqual(clean(andreaFernandoInvitation));
  });

  it("cambiar la plantilla (templateId) no altera el contenido", () => {
    const original = dbInvitationToDomain(rows().invitation);
    const other = dbInvitationToDomain({ ...rows().invitation, template: { slug: "ivory" } });
    expect(other.templateSlug).toBe("ivory");
    expect(contentFingerprint(other)).toBe(contentFingerprint(original));
    expect(clean({ ...other, templateSlug: "magnolia" })).toEqual(clean(original));
  });

  it("ordena las secciones y el resto de listas por position, sin fiarse del orden de la consulta", () => {
    const row = rows().invitation;
    const shuffled: InvitationAggregateRow = {
      ...row,
      sections: [...row.sections].reverse(),
      event: {
        ...row.event,
        locations: [...row.event.locations].reverse(),
        timelineItems: [...row.event.timelineItems].reverse(),
        galleryImages: [...row.event.galleryImages].reverse(),
        giftRegistry: [...row.event.giftRegistry].reverse(),
      },
    };
    const invitation = dbInvitationToDomain(shuffled);
    expect(invitation.sections.map((section) => section.type)).toEqual(andreaFernandoInvitation.sections.map((section) => section.type));
    expect(invitation.locations.map((location) => location.id)).toEqual(["loc_ceremony", "loc_reception"]);
    expect(invitation.timeline.map((item) => item.time)).toEqual(["17:00", "19:00", "20:00", "22:00", "00:00"]);
    expect(invitation.gallery.map((image) => image.id)).toEqual(andreaFernandoInvitation.gallery.map((image) => image.id));
  });

  it("preserva la visibilidad de cada sección y ocultar no borra el contenido", () => {
    const row = rows().invitation;
    const hidden: InvitationAggregateRow = {
      ...row,
      sections: row.sections.map((section) => (section.type === "STORY" || section.type === "GIFTS" ? { ...section, isVisible: false } : section)),
    };
    const invitation = dbInvitationToDomain(hidden);
    expect(invitation.sections.filter((section) => !section.isVisible).map((section) => section.type)).toEqual(["story", "giftRegistry"]);
    expect(invitation.story).toEqual(andreaFernandoInvitation.story);
    expect(invitation.giftRegistry?.entries).toEqual(andreaFernandoInvitation.giftRegistry?.entries);
  });
});

describe("Event.startsAt es la fecha canónica", () => {
  it("la fecha de la invitación y del dashboard salen del evento, no de la invitación", () => {
    const { event, invitation, guests } = rows();
    const moved = { ...event, startsAt: new Date("2028-02-01T20:00:00Z") };
    const domain = dbInvitationToDomain({ ...invitation, event: { ...invitation.event, ...moved } });
    expect(domain.event).toEqual({ startsAt: "2028-02-01T14:00:00-06:00", timezone: "America/Mexico_City" });
    expect(buildDashboardData({ event: moved, invitation: domain, guests }).event.startsAt).toBe("2028-02-01T14:00:00-06:00");
  });

  it("la escritura no guarda fecha ni zona horaria fuera de Event", () => {
    const serialized = JSON.stringify(domainInvitationToDb(andreaFernandoInvitation));
    expect(serialized).not.toContain("2027-05-17");
    expect(serialized).not.toContain("America/Mexico_City");
  });

  it("el instante se representa con el desfase de la zona del evento", () => {
    expect(dbDateToEventIso(new Date("2027-05-17T23:00:00Z"), "America/Mexico_City")).toBe("2027-05-17T17:00:00-06:00");
    expect(dbDateToEventIso(new Date("2027-05-17T23:00:00Z"), "Zona/Invalida")).toBe("2027-05-17T23:00:00.000Z");
  });
});

describe("Dashboard derivado de datos persistidos", () => {
  it("cuenta invitados por estado; «Tal vez» es pendiente", () => {
    const guests = [{ status: "ATTENDING" }, { status: "ATTENDING" }, { status: "PENDING" }, { status: "MAYBE" }, { status: "DECLINED" }] as const;
    expect(summarizeRsvp(guests)).toEqual({ confirmed: 2, pending: 2, declined: 1 });
  });

  it("resumen, actividad y vista previa salen de los invitados y sus respuestas", () => {
    const { event, invitation, guests } = rows();
    const data = buildDashboardData({ event, invitation: dbInvitationToDomain(invitation), guests });
    expect(data.rsvpSummary).toEqual({ confirmed: 2, pending: 1, declined: 1 });
    expect(data.recentActivity.map((item) => [item.actorName, item.type])).toEqual([
      ["Mariana López", "rsvp_confirmed"],
      ["Luis Hernández", "rsvp_confirmed"],
      ["Carolina Méndez", "invitation_viewed"],
      ["Javier Torres", "rsvp_declined"],
    ]);
    expect(data.recentActivity[1]?.metadata).toEqual({ guests: 3 });
    expect(data.guestPreview.map((guest) => guest.status)).toEqual(["confirmed", "confirmed", "pending"]);
    expect(data.event.publicSlug).toBe(andreaFernandoInvitation.slug);
  });
});

describe("Lectura defensiva del JSON", () => {
  it("un JSON inválido usa valores seguros, se registra y no rompe la invitación", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const row = rows().invitation;
    const brokenContent = { openLabel: 42, paragraphs: "x", enabled: "sí" };
    const broken: InvitationAggregateRow = {
      ...row,
      styleOverrides: "no-es-un-objeto" as never,
      sections: row.sections.map((section) => {
        if (section.type === "COVER" || section.type === "RSVP" || section.type === "STORY") return { ...section, content: brokenContent };
        if (section.type === "ITINERARY") return { ...section, settings: "roto" as never };
        return section;
      }),
    };
    const invitation = dbInvitationToDomain(broken);
    expect(invitation.cover.openLabel).toBe("Abrir invitación");
    expect(invitation.story.paragraphs).toEqual([]);
    expect(invitation.rsvp.enabled).toBe(false);
    expect(invitation.styleOverrides).toEqual({});
    expect(invitation.locations).toHaveLength(2);
    expect(error).toHaveBeenCalled();
  });
});
