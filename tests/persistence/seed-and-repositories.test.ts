import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BlockType, EventType, LocationKind, MusicSourceType, TemplateDesignStatus, TemplateFeature, TemplateStyle, TimelineIcon } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getDataSource } from "@/server/data-source";
import {
  designStatusFromDb,
  eventTypeFromDb,
  locationKindFromDb,
  musicSourceFromDb,
  sectionTypeFromDb,
  templateFeatureFromDb,
  templateStyleFromDb,
  timelineIconFromDb,
} from "@/server/mappers/enums";
import { getOwnedDashboardData } from "@/server/repositories/dashboard";
import { getOwnedEventByRef, listOwnedEvents } from "@/server/repositories/events";
import { getOwnedInvitation } from "@/server/repositories/invitations";
import { loadPublishedInvitation, type PublishedRecord } from "@/server/repositories/publishing";
import { getTemplateBySlug, getTemplates } from "@/server/repositories/templates";
import { buildDemoAggregate, buildTemplateRows, DEMO_EVENT_ID, DEMO_EVENT_SLUG, DEMO_USER } from "@/server/seed/demo-data";

const ROOT = process.cwd();

describe("Seed", () => {
  it("incluye Magnolia, Level 12 y Aurora XV (implemented, publicadas), Ivory y Étoile (concept) y seis plantillas comingSoon", () => {
    const rows = buildTemplateRows();
    const by = (slug: string) => rows.find((row) => row.slug === slug);
    expect(rows).toHaveLength(11);
    expect(by("magnolia")).toMatchObject({ designStatus: "IMPLEMENTED", publicationStatus: "PUBLISHED" });
    expect(by("level-12")).toMatchObject({ designStatus: "IMPLEMENTED", publicationStatus: "PUBLISHED" });
    expect(by("aurora-xv")).toMatchObject({ designStatus: "IMPLEMENTED", publicationStatus: "PUBLISHED" });
    expect(by("ivory")?.designStatus).toBe("CONCEPT");
    expect(by("etoile")?.designStatus).toBe("CONCEPT");
    for (const slug of ["tuscany", "noir", "blossom", "riviera", "dream", "safari"]) expect(by(slug)?.designStatus, slug).toBe("COMING_SOON");
    expect(new Set(rows.map((row) => row.slug)).size).toBe(11);
  });

  it("el evento demo: usuario, slug, fecha canónica y pocos invitados en estados variados", () => {
    const seeded = buildDemoAggregate(new Date("2026-09-25T12:00:00Z"));
    expect(seeded.owner).toMatchObject({ email: "demo@hiloluna.local", name: "Andrea" });
    expect(seeded.event).toMatchObject({ id: DEMO_EVENT_ID, slug: "andrea-fernando", title: "Andrea & Fernando", type: "WEDDING", timezone: "America/Mexico_City" });
    expect(seeded.event.startsAt.toISOString()).toBe("2027-05-17T23:00:00.000Z");
    expect(seeded.templateSlug).toBe("magnolia");
    expect(seeded.invitationStatus).toBe("PUBLISHED");
    expect(seeded.guests.map((guest) => [guest.name, guest.status])).toEqual([
      ["Mariana López", "ATTENDING"],
      ["Luis Hernández", "ATTENDING"],
      ["Carolina Méndez", "PENDING"],
      ["Javier Torres", "DECLINED"],
    ]);
    expect(seeded.invitation.locations.map((location) => location.name)).toEqual(["Parroquia de San Miguel Arcángel", "Hacienda Los Olivos"]);
    expect(seeded.invitation.sections.map((section) => section.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(DEMO_USER.email).toBe("demo@hiloluna.local");
  });

  it("todos los ids del agregado son únicos (no colisionan al insertarse)", () => {
    const { invitation, guests, guestGroups } = buildDemoAggregate(new Date());
    const ids = [...invitation.sections, ...invitation.locations, ...invitation.timelineItems, ...invitation.galleryImages, ...invitation.giftRegistry, ...guests, ...guestGroups].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Repositorios (origen de demostración, sin DATABASE_URL)", () => {
  it("sin DATABASE_URL se usa el origen demo; con ella, la base de datos", () => {
    expect(getDataSource({})).toBe("demo");
    expect(getDataSource({ DATABASE_URL: "postgresql://x" })).toBe("database");
  });

  it("resuelve el evento del propietario por id, slug y alias `demo`", async () => {
    for (const ref of [DEMO_EVENT_ID, DEMO_EVENT_SLUG, "demo"]) expect((await getOwnedEventByRef(DEMO_USER.id, ref))?.id, ref).toBe(DEMO_EVENT_ID);
    expect(await getOwnedEventByRef(DEMO_USER.id, "no-existe")).toBeUndefined();
    expect(await listOwnedEvents(DEMO_USER.id)).toHaveLength(1);
  });

  it("loadPublishedInvitation solo devuelve invitaciones publicadas", async () => {
    expect(((await loadPublishedInvitation("andrea-y-fernando")) as PublishedRecord | undefined)?.invitation.names).toEqual(["Andrea", "Fernando"]);
    expect(await loadPublishedInvitation("demo-magnolia")).toBeUndefined();
    expect((await getOwnedInvitation(DEMO_USER.id, DEMO_EVENT_ID))?.templateSlug).toBe("magnolia");
    expect(await getOwnedInvitation(DEMO_USER.id, "otro")).toBeUndefined();
  });

  it("getDashboardData y catálogo", async () => {
    const data = await getOwnedDashboardData(DEMO_USER.id, "demo");
    expect(data?.event).toMatchObject({ id: DEMO_EVENT_ID, title: "Andrea & Fernando" });
    expect(await getOwnedDashboardData(DEMO_USER.id, "nope")).toBeUndefined();
    expect(await getTemplates()).toHaveLength(11);
    expect((await getTemplateBySlug("magnolia"))?.status).toBe("implemented");
    expect((await getTemplateBySlug("level-12"))?.status).toBe("implemented");
    expect((await getTemplateBySlug("aurora-xv"))?.status).toBe("implemented");
    expect(await getTemplateBySlug("no-existe")).toBeUndefined();
  });
});

describe("Esquema y mappers", () => {
  it("cada valor de cada enum de Prisma tiene traducción al dominio", () => {
    const covered: [Record<string, string>, Record<string, unknown>][] = [
      [EventType, eventTypeFromDb],
      [TemplateStyle, templateStyleFromDb],
      [TemplateFeature, templateFeatureFromDb],
      [TemplateDesignStatus, designStatusFromDb],
      [BlockType, sectionTypeFromDb],
      [LocationKind, locationKindFromDb],
      [TimelineIcon, timelineIconFromDb],
      [MusicSourceType, musicSourceFromDb],
    ];
    for (const [prismaEnum, table] of covered) expect(Object.keys(table).sort()).toEqual(Object.values(prismaEnum).sort());
  });

  it("índices y unicidad mínimos del esquema", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    const model = (name: string) => new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema)?.[1] ?? "";
    expect(model("User")).toMatch(/email\s+String\s+@unique/);
    expect(model("Event")).toMatch(/slug\s+String\s+@unique/);
    expect(model("Template")).toMatch(/slug\s+String\s+@unique/);
    for (const name of ["Event", "Guest", "Rsvp", "Location", "Invitation"]) expect(model(name), name).toMatch(/@@index\(\[|eventId\s+String\s+@unique/);
    // Cascada explícita desde Event; las plantillas no se borran en cascada.
    expect(model("Invitation")).toMatch(/template\s+Template\s+@relation\([^)]*onDelete: Restrict/);
    expect(model("Invitation")).toMatch(/event\s+Event\s+@relation\([^)]*onDelete: Cascade/);
    expect(model("Template")).not.toMatch(/Cascade/);
  });

  it("existe la migración inicial", () => {
    const migrations = readdirSync(join(ROOT, "prisma/migrations")).filter((entry) => statSync(join(ROOT, "prisma/migrations", entry)).isDirectory());
    expect(migrations.some((name) => name.endsWith("_init_lunaria"))).toBe(true);
  });
});

describe("Arquitectura de acceso a datos", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (entry === "node_modules" || entry === ".next") return [];
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
  const rel = (file: string) => file.slice(ROOT.length + 1).replaceAll("\\", "/");

  it("solo server/db importa el runtime de Prisma; el resto, únicamente tipos", () => {
    const offenders = ["server", "lib", "app", "components", "types"]
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /import\s+(?!type\b)[^;]*from\s+"@prisma\/client"/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual(["server/db/client.ts"]);
  });

  it("componentes y tipos no conocen la BD, los repositorios ni los secretos", () => {
    const offenders = ["components", "types"]
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /from\s+"(@prisma\/client|@\/server\/(db|repositories|mappers|seed))|process.env.CLERK_SECRET_KEY/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("solo los repositorios importan el cliente de Prisma", () => {
    const offenders = ["server", "lib", "app", "components"]
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /from\s+"@\/server\/db\/client"/.test(readFileSync(file, "utf8")))
      .map(rel)
      .filter((file) => !file.startsWith("server/repositories/"));
    expect(offenders).toEqual([]);
  });
});
