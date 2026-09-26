import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEventAggregate } from "@/server/services/event-aggregate";
import { createDefaultInvitationData } from "@/lib/events/default-invitation";

/**
 * Con base de datos, el alta escribe TODO dentro de UNA transacción (`prisma.$transaction`): el cliente
 * raíz de Prisma no recibe ninguna escritura directa. Prisma se sustituye por un doble que registra por
 * qué cliente pasa cada operación; si algo falla dentro, el error se propaga y (con Prisma real) toda la
 * transacción se revierte. La comprobación con PostgreSQL real está en el informe.
 */
const log = vi.hoisted(() => ({ calls: [] as { client: "tx" | "root"; op: string; args: unknown }[], txOpen: 0, fail: undefined as string | undefined, mode: "normal" as "normal" | "noTemplate" | "unique" }));
const op = (client: "tx" | "root", name: string, result: unknown = {}) =>
  vi.fn(async (args: unknown) => {
    log.calls.push({ client, op: name, args });
    if (log.fail === name) throw new Error(`fallo en ${name}`);
    return typeof result === "function" ? (result as () => unknown)() : result;
  });

vi.mock("@/server/db/client", () => {
  const tx = () => ({
    template: { findFirst: op("tx", "template.findFirst", { id: "tpl_magnolia" }) },
    user: { findUnique: op("tx", "user.findUnique", { id: "usr_A" }) },
    event: { create: op("tx", "event.create") },
    invitation: { create: op("tx", "invitation.create") },
    invitationSection: { createMany: op("tx", "sections.createMany") },
    location: { createMany: op("tx", "locations.createMany") },
    timelineItem: { createMany: op("tx", "timeline.createMany") },
    galleryImage: { createMany: op("tx", "gallery.createMany") },
    giftRegistry: { createMany: op("tx", "gifts.createMany") },
    musicSettings: { create: op("tx", "music.create") },
    guestGroup: { createMany: op("tx", "groups.createMany") },
    guest: { createMany: op("tx", "guests.createMany") },
    rsvp: { createMany: op("tx", "rsvp.createMany") },
  });
  const root = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "$transaction") {
          return async (cb: (client: unknown) => unknown) => {
            if (log.mode === "unique") throw Object.assign(new Error("unique"), { code: "P2002", meta: { target: ["slug"] } });
            const client = tx();
            if (log.mode === "noTemplate") client.template.findFirst = op("tx", "template.findFirst", () => null) as never;
            return cb(client);
          };
        }
        // Cualquier acceso directo al cliente raíz (fuera de la transacción) se registra como escritura fuera de ella.
        return new Proxy({}, { get: (_t, method) => op("root", `${String(key)}.${String(method)}`) });
      },
    },
  );
  return { prisma: root };
});

import { createOwnedEvent, SlugTakenError, TemplateUnavailableError } from "@/server/repositories/event-creation";

const aggregate = () =>
  buildEventAggregate({
    owner: { id: "usr_A", email: "a@example.com", name: "A" },
    event: { id: "evt_1", slug: "andrea-fernando", title: "Andrea & Fernando", status: "DRAFT" },
    invitation: createDefaultInvitationData({ eventType: "wedding", templateSlug: "magnolia", names: ["Andrea", "Fernando"], startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", invitationSlug: "andrea-y-fernando" }),
    invitationStatus: "DRAFT",
  });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  log.calls.length = 0;
  log.fail = undefined;
  log.mode = "normal";
});
afterEach(() => vi.unstubAllEnvs());

describe("createOwnedEvent: una transacción", () => {
  it("9. evento, invitación, secciones y contenido se escriben SOLO dentro de la transacción y con el propietario de la sesión", async () => {
    expect(await createOwnedEvent("usr_A", aggregate())).toMatchObject({ eventId: "evt_1" });
    expect(log.calls.every((call) => call.client === "tx")).toBe(true);
    const ops = log.calls.map((call) => call.op);
    expect(ops.slice(0, 3)).toEqual(["template.findFirst", "user.findUnique", "event.create"]);
    for (const expected of ["invitation.create", "sections.createMany", "locations.createMany", "timeline.createMany", "gallery.createMany", "gifts.createMany"]) expect(ops).toContain(expected);
    expect(ops).not.toContain("music.create"); // sin música
    expect(log.calls.find((call) => call.op === "event.create")?.args).toMatchObject({ data: { ownerId: "usr_A", type: "WEDDING", status: "DRAFT" } });
  });

  it("12. la plantilla se resuelve DENTRO de la transacción: publicada, diseño aprobado y del tipo del evento; la invitación usa su id", async () => {
    await createOwnedEvent("usr_A", aggregate());
    expect(log.calls.find((call) => call.op === "template.findFirst")?.args).toMatchObject({ where: { slug: "magnolia", publicationStatus: "PUBLISHED", designStatus: "IMPLEMENTED", eventType: "WEDDING" } });
    expect(log.calls.find((call) => call.op === "invitation.create")?.args).toMatchObject({ data: { templateId: "tpl_magnolia", status: "DRAFT", eventId: "evt_1" } });
  });

  it("una plantilla no elegible aborta antes de escribir nada", async () => {
    log.mode = "noTemplate";
    await expect(createOwnedEvent("usr_A", aggregate())).rejects.toBeInstanceOf(TemplateUnavailableError);
    expect(log.calls.map((call) => call.op)).toEqual(["template.findFirst"]);
  });

  it("si una escritura falla, el error se propaga (Prisma revierte todo) y no se registra escritura fuera de la transacción", async () => {
    log.fail = "sections.createMany";
    await expect(createOwnedEvent("usr_A", aggregate())).rejects.toThrow(/sections/);
    expect(log.calls.some((call) => call.client === "root")).toBe(false);
  });

  it("una violación de unicidad del slug se traduce a SlugTakenError (el servicio reintenta)", async () => {
    log.mode = "unique";
    await expect(createOwnedEvent("usr_A", aggregate())).rejects.toBeInstanceOf(SlugTakenError);
  });

  it("sin base de datos se rechaza (no se finge que se creó)", async () => {
    vi.unstubAllEnvs();
    await expect(createOwnedEvent("usr_A", aggregate())).rejects.toThrow(/DATABASE_URL/);
  });
});
