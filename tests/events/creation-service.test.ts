import { describe, expect, it, vi } from "vitest";
import { templates } from "@/lib/content/templates";
import { StoreUnavailableError } from "@/server/db/errors";
import { SlugTakenError } from "@/server/repositories/event-creation";
import { createEventForUser, type EventCreationDeps } from "@/server/services/event-creation";
import type { NewEventAggregate } from "@/server/services/event-aggregate";
import type { Template } from "@/types/templates";

const userA = { id: "usr_A", email: "a@example.com", name: "A" };
const good = { templateSlug: "magnolia", eventType: "wedding", name1: "Andrea", name2: "Fernando", date: "2027-05-17", time: "17:00", timezone: "America/Mexico_City" };

/** Mundo de prueba: la «base de datos» es un arreglo en memoria; ninguna prueba toca PostgreSQL. */
function world(over: Partial<EventCreationDeps> & { catalog?: readonly Template[]; takenEvent?: string[]; takenInvitation?: string[] } = {}) {
  const created: { ownerId: string; aggregate: NewEventAggregate }[] = [];
  let n = 0;
  const { catalog, takenEvent, takenInvitation, ...depOverrides } = over;
  const deps: EventCreationDeps = {
    findTemplate: async (slug) => (catalog ?? templates).find((template) => template.slug === slug),
    findTakenSlugs: async () => ({ event: new Set(takenEvent ?? []), invitation: new Set(takenInvitation ?? []) }),
    create: async (ownerId, aggregate) => {
      created.push({ ownerId, aggregate });
      return { eventId: aggregate.event.id, invitationId: aggregate.invitation.invitation.id };
    },
    newId: (prefix) => `${prefix}_${++n}`,
    checkTemplatePlan: () => ({ ok: true }),
    ...depOverrides,
  };
  return { deps, created };
}

describe("createEventForUser", () => {
  it("1/7/12. un usuario autenticado crea un evento de boda con Magnolia y obtiene el id real", async () => {
    const { deps, created } = world();
    const result = await createEventForUser(userA, good, deps);
    expect(result.ok).toBe(true);
    const { aggregate } = created[0]!;
    expect(result).toEqual({ ok: true, eventId: aggregate.event.id });
    expect(aggregate.event).toMatchObject({ type: "WEDDING", title: "Andrea & Fernando", status: "DRAFT", timezone: "America/Mexico_City" });
    expect(aggregate.event.startsAt.toISOString()).toBe("2027-05-17T23:00:00.000Z");
    expect(aggregate.templateSlug).toBe("magnolia");
    expect(aggregate.invitationStatus).toBe("DRAFT"); // nada es público hasta publicar
    expect(aggregate.guests).toEqual([]);
    expect(aggregate.guestGroups).toEqual([]);
  });

  it("2/3. el propietario es SIEMPRE el usuario de la sesión: un ownerId del cliente se ignora", async () => {
    const { deps, created } = world();
    await createEventForUser(userA, { ...good, ownerId: "usr_B", userId: "usr_B", status: "ACTIVE" } as never, deps);
    expect(created[0]?.ownerId).toBe("usr_A");
    expect(created[0]?.aggregate.owner.id).toBe("usr_A");
    expect(JSON.stringify(created[0]?.aggregate)).not.toContain("usr_B");
  });

  it("4. una plantilla inexistente se rechaza y no se crea nada", async () => {
    const { deps, created } = world();
    const result = await createEventForUser(userA, { ...good, templateSlug: "no-existe" }, deps);
    expect(result).toMatchObject({ ok: false, code: "template_unavailable", message: "No encontramos esa plantilla." });
    expect(created).toHaveLength(0);
  });

  it("5/6. plantillas concept y comingSoon se rechazan", async () => {
    const { deps, created } = world();
    for (const template of templates.filter((t) => t.status !== "implemented")) {
      const result = await createEventForUser(userA, { ...good, templateSlug: template.slug }, deps);
      expect(result, template.slug).toMatchObject({ ok: false, code: "template_unavailable" });
    }
    expect(created).toHaveLength(0);
  });

  it("8. Magnolia con otro tipo de evento se rechaza con un mensaje claro", async () => {
    const { deps, created } = world();
    const result = await createEventForUser(userA, { ...good, eventType: "birthday", name2: undefined }, deps);
    expect(result).toMatchObject({ ok: false, code: "template_unavailable", message: expect.stringContaining("Magnolia todavía no está disponible para cumpleaños") });
    expect(created).toHaveLength(0);
  });

  it("valida en el servidor (fecha, hora, nombres) sin tocar la base de datos", async () => {
    const { deps, created } = world();
    const findTemplate = vi.fn(deps.findTemplate);
    const result = await createEventForUser(userA, { ...good, name1: "", date: "2027-13-40", time: "99:99" }, { ...deps, findTemplate });
    expect(result).toMatchObject({ ok: false, code: "invalid", fieldErrors: { name1: expect.any(String), date: expect.any(String), time: expect.any(String) } });
    expect(findTemplate).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("9/10. evento, invitación y secciones viajan en UN solo agregado (una escritura transaccional) y en el orden correcto", async () => {
    const { deps, created } = world();
    await createEventForUser(userA, good, deps);
    expect(created).toHaveLength(1);
    const { invitation } = created[0]!.aggregate;
    expect(invitation.sections.map((section) => [section.position, section.type])).toEqual([
      [0, "COVER"],
      [1, "STORY"],
      [2, "COUNTDOWN"],
      [3, "LOCATION"],
      [4, "ITINERARY"],
      [5, "GALLERY"],
      [6, "DRESS_CODE"],
      [7, "GIFTS"],
      [8, "RSVP"],
      [9, "CLOSING"],
    ]);
    expect(invitation.locations).toHaveLength(2);
    expect(invitation.timelineItems).toEqual([]);
    expect(invitation.galleryImages).toEqual([]);
    expect(invitation.giftRegistry).toEqual([]);
    expect(invitation.music).toBeUndefined();
  });

  it("11. slugs únicos y separados: «andrea-fernando» ocupado → «andrea-fernando-2»; la invitación también", async () => {
    const { deps, created } = world({ takenEvent: ["andrea-fernando"], takenInvitation: ["andrea-y-fernando", "andrea-y-fernando-2"] });
    await createEventForUser(userA, good, deps);
    expect(created[0]?.aggregate.event.slug).toBe("andrea-fernando-2");
    expect(created[0]?.aggregate.invitation.invitation.slug).toBe("andrea-y-fernando-3");
  });

  it("si otra petición ocupa el slug justo antes de escribir, reintenta con uno libre (sin duplicar)", async () => {
    const taken = new Set<string>();
    const attempts: string[] = [];
    const { deps } = world({
      findTakenSlugs: async () => ({ event: new Set(taken), invitation: new Set<string>() }),
      create: async (_owner, aggregate) => {
        attempts.push(aggregate.event.slug);
        if (attempts.length === 1) {
          taken.add(aggregate.event.slug); // «alguien» ganó la carrera
          throw new SlugTakenError(["slug"]);
        }
        return { eventId: aggregate.event.id, invitationId: aggregate.invitation.invitation.id };
      },
    });
    expect(await createEventForUser(userA, good, deps)).toMatchObject({ ok: true });
    expect(attempts).toEqual(["andrea-fernando", "andrea-fernando-2"]);
  });

  it("un fallo de la base de datos no filtra detalles ni deja un resultado parcial", async () => {
    const { deps } = world({
      create: async () => {
        throw new Error("password authentication failed for user hilo at db.internal:5432");
      },
    });
    const result = await createEventForUser(userA, good, deps);
    expect(result).toMatchObject({ ok: false, code: "error" });
    expect(JSON.stringify(result)).not.toMatch(/password|hilo|5432|internal/);
  });

  it("sin base de datos (origen de demostración) responde con un aviso claro", async () => {
    const { deps } = world({
      create: async () => {
        throw new StoreUnavailableError();
      },
    });
    expect(await createEventForUser(userA, good, deps)).toMatchObject({ ok: false, code: "unavailable" });
  });
});
