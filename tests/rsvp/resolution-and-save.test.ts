import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDemoRows } from "@/server/repositories/demo-store";
import { deriveDemoInviteToken } from "@/server/services/invite-token";

/**
 * Con base de datos: la invitación se busca por slug y el invitado por `inviteToken` + `eventId` DE ESA
 * invitación; el guardado es una transacción con upsert por `guestId`. Prisma se sustituye por un doble con
 * DOS eventos para comprobar que un token de otro evento no se reconoce. (La misma comprobación se hizo con
 * datos reales en PostgreSQL: ver el informe.)
 */
const T1 = "A".repeat(32); // token de un invitado del evento E1
const T2 = "B".repeat(32); // token de un invitado del evento E2

const store = vi.hoisted(() => ({
  guests: [
    { id: "g1", eventId: "E1", inviteToken: "A".repeat(32), name: "Mariana López", maxCompanions: 2, status: "PENDING", group: { name: "Amigos" }, rsvp: null },
    { id: "g2", eventId: "E2", inviteToken: "B".repeat(32), name: "Persona de Otro Evento", maxCompanions: 0, status: "PENDING", group: null, rsvp: null },
  ] as Record<string, unknown>[],
  calls: [] as { op: string; args: unknown }[],
  invitationRow: undefined as unknown,
  /** Respuesta ANTERIOR de cada invitado (D-36: base para `changed`). `undefined` = primera respuesta. */
  previousRsvp: {} as Record<string, { status: string; attendeeCount: number | null } | undefined>,
}));

vi.mock("@/server/db/client", () => {
  const log = (op: string, args: unknown) => store.calls.push({ op, args });
  const tx = {
    guest: {
      findFirst: vi.fn(async (args: { where: { inviteToken?: string; eventId?: string; id?: string } }) => {
        log("guest.findFirst", args);
        return store.guests.find((g) => (args.where.inviteToken === undefined || g.inviteToken === args.where.inviteToken) && (args.where.eventId === undefined || g.eventId === args.where.eventId) && (args.where.id === undefined || g.id === args.where.id)) ?? null;
      }),
      updateMany: vi.fn(async (args: unknown) => (log("guest.updateMany", args), { count: 1 })),
    },
    rsvp: {
      findUnique: vi.fn(async (args: { where: { guestId: string } }) => (log("rsvp.findUnique", args), store.previousRsvp[args.where.guestId] ?? null)),
      upsert: vi.fn(async (args: unknown) => (log("rsvp.upsert", args), { id: "r1" })),
      updateMany: vi.fn(async (args: unknown) => (log("rsvp.updateMany", args), { count: 1 })),
    },
    rsvpAnswer: { deleteMany: vi.fn(async (args: unknown) => (log("answer.deleteMany", args), { count: 0 })), upsert: vi.fn(async (args: unknown) => (log("answer.upsert", args), {})) },
  };
  return {
    prisma: {
      ...tx,
      invitation: {
      // 1.ª consulta (cabecera con la publicación vigente): sin publicaciones = dato anterior a D-29 → lee el borrador (2.ª, con `include`).
      findFirst: vi.fn(async (args: { include?: unknown }) => {
        log("invitation.findFirst", args);
        const row = store.invitationRow as { id: string; eventId: string } | undefined;
        if (!row) return null;
        return args.include ? row : { id: row.id, eventId: row.eventId, publications: [] };
      }),
    },
      rsvpQuestion: { findMany: vi.fn(async (args: unknown) => (log("question.findMany", args), [{ id: "q1", label: "Menú", type: "CHOICE", required: false, options: ["Carne"] }])) },
      $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
    },
  };
});

import { getPublicInvitationRecord, resolveRsvpTarget, savePublicRsvp, type PublicInvitationRecord } from "@/server/repositories/public-invitations";
import { toPersonalization } from "@/server/services/public-context";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  store.calls.length = 0;
  // Fila de la invitación del evento E1 (reutiliza la forma real del seed).
  store.invitationRow = { ...getDemoRows(new Date()).invitation, eventId: "E1", status: "PUBLISHED" };
  store.previousRsvp = {};
});
afterEach(() => vi.unstubAllEnvs());

/** La invitación pública o `undefined` (estos casos usan eventos vigentes: la expiración se prueba en tests/security/expiration.test.ts). */
const lookup = async (slug: string, token?: string) => (await getPublicInvitationRecord(slug, token)) as PublicInvitationRecord | undefined;

const guestQuery = () => store.calls.filter((call) => call.op === "guest.findFirst").map((call) => call.args as { where: Record<string, unknown> });

describe("Resolución del invitado: slug + token + mismo evento", () => {
  it("1. token válido + slug correcto → contexto del invitado", async () => {
    const record = await lookup("andrea-y-fernando", T1);
    expect(record).toMatchObject({ tokenStatus: "valid", eventId: "E1", guest: { name: "Mariana López", maxCompanions: 2, groupName: "Amigos" } });
    expect(record?.questions).toHaveLength(1);
    // La coincidencia es EN LA MISMA consulta: token + evento de la invitación.
    expect(guestQuery()[0]).toMatchObject({ where: { inviteToken: T1, eventId: "E1" } });
  });

  it("2. token válido de OTRO evento no devuelve al invitado (indistinguible de un token inventado)", async () => {
    const cross = await lookup("andrea-y-fernando", T2);
    expect(cross?.tokenStatus).toBe("invalid");
    expect(cross?.guest).toBeUndefined();
    expect(cross?.questions).toEqual([]);
    expect(await resolveRsvpTarget("andrea-y-fernando", T2)).toBeNull();
    expect(JSON.stringify(cross)).not.toContain("Otro Evento");
  });

  it("3. un token inválido no filtra información: mal formado, desconocido y de otro evento dan el mismo resultado", async () => {
    const results = await Promise.all(["../../etc/passwd", "x".repeat(40), T2, "corto", " "].map((token) => lookup("andrea-y-fernando", token)));
    for (const result of results) expect(result).toMatchObject({ tokenStatus: "invalid", questions: [] });
    expect(new Set(results.map((result) => JSON.stringify({ ...result, invitation: undefined }))).size).toBe(1);
    // Un valor mal formado ni siquiera llega a la base de datos.
    expect(guestQuery().every((query) => query.where.inviteToken !== "../../etc/passwd" && query.where.inviteToken !== "corto")).toBe(true);
  });

  it("sin token (o vacío): invitación general, sin buscar ningún invitado", async () => {
    for (const token of [undefined, ""]) expect(await lookup("andrea-y-fernando", token)).toMatchObject({ tokenStatus: "none", questions: [] });
    expect(guestQuery()).toHaveLength(0);
  });

  it("solo invitaciones PUBLICADAS; un slug desconocido no existe", async () => {
    await lookup("andrea-y-fernando", T1);
    expect(store.calls.find((call) => call.op === "invitation.findFirst")?.args).toMatchObject({ where: { slug: "andrea-y-fernando", status: "PUBLISHED" } });
    store.invitationRow = undefined;
    expect(await lookup("no-existe", T1)).toBeUndefined();
  });

  it("el contexto PÚBLICO no lleva ids, eventId, email, teléfono ni marcas internas", async () => {
    const record = (await lookup("andrea-y-fernando", T1))!;
    const pub = toPersonalization(record, "andrea-y-fernando", T1)!;
    expect(pub.kind).toBe("guest");
    const json = JSON.stringify(pub);
    // Los `id` de las PREGUNTAS sí viajan (hacen falta para responderlas); el invitado no lleva ninguno.
    expect(JSON.stringify((pub as { guest: object }).guest)).not.toContain('"id"');
    for (const forbidden of ["eventId", "guestId", "groupId", "email", "phone", "createdAt", "updatedAt", "firstViewedAt", '"g1"', '"E1"']) expect(json, forbidden).not.toContain(forbidden);
    expect(Object.keys((pub as { guest: object }).guest).sort()).toEqual(["displayName", "groupName", "maxCompanions"]);
    expect(toPersonalization({ ...record, tokenStatus: "invalid", guest: undefined }, "s", "t")).toEqual({ kind: "invalid" });
    expect(toPersonalization({ ...record, tokenStatus: "none", guest: undefined }, "s", "")).toBeUndefined();
  });
});

describe("Guardado: una transacción, un solo Rsvp por invitado", () => {
  const target = { eventId: "E1", guestId: "g1", maxCompanions: 2, rsvp: { enabled: true, message: "", maxCompanions: 2, allowMaybe: true, askDietaryNotes: false }, questions: [] };
  const value = { status: "ATTENDING" as const, attendeeCount: 2, message: "hola", answers: [{ questionId: "q1", value: "Carne" }] };

  it("upsert por guestId (restricción única), Guest.status en la misma transacción y respuestas reemplazadas", async () => {
    expect(await savePublicRsvp(target, value, new Date("2026-09-26T12:00:00Z"))).toEqual({ ok: true, changed: true });
    const ops = store.calls.map((call) => call.op);
    expect(ops).toEqual(["guest.findFirst", "rsvp.findUnique", "guest.updateMany", "rsvp.upsert", "answer.deleteMany", "answer.upsert"]);
    const upsert = store.calls.find((call) => call.op === "rsvp.upsert")!.args as { where: unknown; create: Record<string, unknown>; update: Record<string, unknown> };
    expect(upsert.where).toEqual({ guestId: "g1" });
    expect(upsert.create).toMatchObject({ eventId: "E1", guestId: "g1", status: "ATTENDING", attendeeCount: 2, message: "hola" });
    expect(upsert.update).toMatchObject({ status: "ATTENDING", attendeeCount: 2, message: "hola" });
    expect(upsert.update).not.toHaveProperty("guestId"); // la actualización no cambia a quién pertenece
    expect(store.calls.find((call) => call.op === "guest.updateMany")!.args).toMatchObject({ where: { id: "g1", eventId: "E1" }, data: { status: "ATTENDING" } });
    expect(store.calls.find((call) => call.op === "answer.upsert")!.args).toMatchObject({ where: { rsvpId_questionId: { rsvpId: "r1", questionId: "q1" } } });
  });

  it("DECLINED guarda attendeeCount 0 y quita las respuestas anteriores", async () => {
    await savePublicRsvp(target, { status: "DECLINED", attendeeCount: 0, message: null, answers: [] }, new Date());
    expect((store.calls.find((call) => call.op === "rsvp.upsert")!.args as { update: Record<string, unknown> }).update).toMatchObject({ status: "DECLINED", attendeeCount: 0, message: null });
    expect(store.calls.find((call) => call.op === "answer.deleteMany")!.args).toEqual({ where: { rsvpId: "r1" } });
    expect(store.calls.some((call) => call.op === "answer.upsert")).toBe(false);
  });

  it("si el invitado ya no existe en ese evento, no guarda nada", async () => {
    expect(await savePublicRsvp({ ...target, eventId: "E2" }, value, new Date())).toEqual({ ok: false, changed: false });
    expect(store.calls.some((call) => call.op === "rsvp.upsert")).toBe(false);
  });

  it("sin base de datos las escrituras públicas se rechazan con un error de infraestructura", async () => {
    vi.unstubAllEnvs();
    await expect(savePublicRsvp(target, value, new Date())).rejects.toThrow(/DATABASE_URL/);
  });

  describe("(D-36, 12/47.3) `changed`: solo avisa al anfitrión si el estado o el número de asistentes cambiaron", () => {
    it("la primera respuesta de un invitado siempre cuenta como cambio", async () => {
      store.previousRsvp.g1 = undefined;
      expect(await savePublicRsvp(target, value, new Date())).toMatchObject({ changed: true });
    });

    it("reenviar EXACTAMENTE la misma respuesta (estado y número de asistentes) no cuenta como cambio", async () => {
      store.previousRsvp.g1 = { status: "ATTENDING", attendeeCount: 2 };
      expect(await savePublicRsvp(target, value, new Date())).toMatchObject({ ok: true, changed: false });
    });

    it("cambiar SOLO el mensaje o las respuestas (mismo estado y mismo número) no cuenta como cambio", async () => {
      store.previousRsvp.g1 = { status: "ATTENDING", attendeeCount: 2 };
      const sameCountDifferentMessage = { ...value, message: "otro mensaje", answers: [{ questionId: "q1", value: "Pescado" }] };
      expect(await savePublicRsvp(target, sameCountDifferentMessage, new Date())).toMatchObject({ changed: false });
    });

    it("cambiar el ESTADO (Sí → No) cuenta como cambio", async () => {
      store.previousRsvp.g1 = { status: "ATTENDING", attendeeCount: 2 };
      expect(await savePublicRsvp(target, { status: "DECLINED", attendeeCount: 0, message: null, answers: [] }, new Date())).toMatchObject({ changed: true });
    });

    it("cambiar SOLO el número de asistentes (mismo estado) cuenta como cambio", async () => {
      store.previousRsvp.g1 = { status: "ATTENDING", attendeeCount: 2 };
      expect(await savePublicRsvp(target, { ...value, attendeeCount: 3 }, new Date())).toMatchObject({ changed: true });
    });
  });
});

describe("Sin base de datos (origen de demostración)", () => {
  it("la invitación general y los tokens de los invitados del seed funcionan en solo lectura", async () => {
    vi.unstubAllEnvs();
    const token = deriveDemoInviteToken("gst_demo_1");
    const record = await lookup("andrea-y-fernando", token);
    expect(record).toMatchObject({ tokenStatus: "valid", guest: { name: "Mariana López" } });
    expect((await lookup("andrea-y-fernando"))?.tokenStatus).toBe("none");
    expect((await lookup("andrea-y-fernando", "z".repeat(32)))?.tokenStatus).toBe("invalid");
  });
});
