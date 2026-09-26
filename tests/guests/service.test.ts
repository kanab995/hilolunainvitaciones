import { describe, expect, it, vi } from "vitest";
import type { OwnedEventResolution } from "@/server/auth/ownership";
import { GuestStoreUnavailableError, type GuestWriteResult } from "@/server/repositories/guests";
import { createGuestFor, deleteGuestFor, updateGuestFor, type GuestServiceDeps } from "@/server/services/guest-service";
import type { GuestRecord } from "@/server/mappers/guest";

const record: GuestRecord = { id: "gst_1", name: "Ana", email: null, phone: null, groupId: null, groupName: null, maxCompanions: 0, status: "PENDING", inviteToken: "t".repeat(32), createdAt: new Date(), attendeeCount: null };

/** Mundo de prueba: el usuario A es dueño de `evt_A`; `evt_B` es de otra persona (para A no existe). */
function deps(over: Partial<GuestServiceDeps> = {}): GuestServiceDeps & { calls: string[] } {
  const calls: string[] = [];
  const resolveOwnedEvent = vi.fn(async (ref: string): Promise<OwnedEventResolution> => {
    calls.push(`resolve:${ref}`);
    return ref === "evt_A" ? { status: "ok", user: { id: "usr_A", email: "a@example.com", name: "A" }, event: { id: "evt_A", slug: "a", title: "A", type: "wedding", status: "active", startsAt: "2027-01-01T00:00:00Z", timezone: "UTC" } } : { status: "not_found" };
  });
  return {
    calls,
    resolveOwnedEvent,
    create: vi.fn(async (userId, eventId): Promise<GuestWriteResult> => {
      calls.push(`create:${userId}:${eventId}`);
      return { ok: true, guest: record };
    }),
    update: vi.fn(async (userId, eventId, guestId): Promise<GuestWriteResult> => {
      calls.push(`update:${userId}:${eventId}:${guestId}`);
      return { ok: true, guest: record };
    }),
    remove: vi.fn(async (userId, eventId, guestId) => {
      calls.push(`remove:${userId}:${eventId}:${guestId}`);
      return true;
    }),
    checkGuestLimit: vi.fn(async () => ({ ok: true }) as const),
    ...over,
  };
}

describe("Guest service: sesión → propiedad → validación → escritura", () => {
  it("crear: el propietario sale de la sesión; ownerId/userId del cliente se ignoran", async () => {
    const d = deps();
    const { result, eventId } = await createGuestFor("evt_A", { name: "Ana", ownerId: "usr_B", userId: "usr_B", eventId: "evt_B" }, d);
    expect(result).toEqual({ ok: true, message: "Invitado agregado." });
    expect(eventId).toBe("evt_A");
    expect(d.calls).toEqual(["resolve:evt_A", "create:usr_A:evt_A"]);
    expect(JSON.stringify(vi.mocked(d.create).mock.calls)).not.toContain("usr_B");
  });

  it("2. crear en el evento de otra persona: se rechaza sin tocar la base de datos", async () => {
    const d = deps();
    const { result, eventId } = await createGuestFor("evt_B", { name: "Ana" }, d);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(eventId).toBeUndefined();
    expect(d.create).not.toHaveBeenCalled();
  });

  it("3. editar un invitado de un evento ajeno: no_encontrado y ninguna escritura", async () => {
    const d = deps();
    expect((await updateGuestFor("evt_B", "gst_1", { name: "Ana" }, d)).result).toMatchObject({ ok: false, code: "not_found" });
    expect(d.update).not.toHaveBeenCalled();
  });

  it("4. eliminar un invitado de un evento ajeno: no_encontrado y ninguna escritura", async () => {
    const d = deps();
    expect((await deleteGuestFor("evt_B", "gst_1", d)).result).toMatchObject({ ok: false, code: "not_found" });
    expect(d.remove).not.toHaveBeenCalled();
  });

  it("un evento ajeno y uno inexistente responden exactamente igual (no se revela que existe)", async () => {
    const d = deps();
    const foreign = await createGuestFor("evt_B", { name: "Ana" }, d);
    const missing = await createGuestFor("evt_no_existe", { name: "Ana" }, d);
    expect(foreign).toEqual(missing);
  });

  it("un guestId ajeno (la escritura no encuentra fila) responde no_encontrado", async () => {
    const d = deps({ update: vi.fn(async () => ({ ok: false, code: "not_found" }) as const), remove: vi.fn(async () => false) });
    expect((await updateGuestFor("evt_A", "gst_de_B", { name: "Ana" }, d)).result).toMatchObject({ ok: false, code: "not_found" });
    expect((await deleteGuestFor("evt_A", "gst_de_B", d)).result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("sin sesión: resultado «unauthenticated», sin escribir", async () => {
    const d = deps({ resolveOwnedEvent: vi.fn(async () => ({ status: "unauthenticated" }) as const) });
    expect((await createGuestFor("evt_A", { name: "Ana" }, d)).result).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(d.create).not.toHaveBeenCalled();
  });

  it("datos inválidos: errores por campo y no se escribe", async () => {
    const d = deps();
    const { result } = await createGuestFor("evt_A", { name: "", email: "mal" }, d);
    expect(result).toMatchObject({ ok: false, code: "invalid", fieldErrors: { name: expect.any(String), email: expect.any(String) } });
    expect(d.create).not.toHaveBeenCalled();
  });

  it("editar y eliminar correctos devuelven mensajes y el id canónico del evento", async () => {
    const d = deps();
    expect(await updateGuestFor("evt_A", "gst_1", { name: "Ana", status: "ATTENDING" }, d)).toEqual({ result: { ok: true, message: "Cambios guardados." }, eventId: "evt_A" });
    expect(d.calls.at(-1)).toBe("update:usr_A:evt_A:gst_1");
    expect(await deleteGuestFor("evt_A", "gst_1", d)).toEqual({ result: { ok: true, message: "Invitado eliminado." }, eventId: "evt_A" });
    expect((await updateGuestFor("evt_A", "../etc/passwd", { name: "Ana" }, d)).result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("un grupo de otro evento se informa como grupo inválido", async () => {
    const d = deps({ create: vi.fn(async () => ({ ok: false, code: "group_not_found" }) as const) });
    expect((await createGuestFor("evt_A", { name: "Ana", groupId: "grp_de_B" }, d)).result).toMatchObject({ ok: false, code: "invalid", fieldErrors: { groupId: expect.any(String) } });
  });

  it("errores de la base de datos: mensaje genérico, sin detalles de Prisma", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps({ create: vi.fn(async () => { throw new Error("Invalid `prisma.guest.create()` invocation: secret table detail"); }) });
    const { result } = await createGuestFor("evt_A", { name: "Ana" }, d);
    expect(result).toMatchObject({ ok: false, code: "error" });
    expect(JSON.stringify(result)).not.toMatch(/prisma|secret|invocation/i);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/secret table detail/);

    const unavailable = deps({ create: vi.fn(async () => { throw new GuestStoreUnavailableError(); }) });
    expect((await createGuestFor("evt_A", { name: "Ana" }, unavailable)).result).toMatchObject({ ok: false, code: "unavailable" });
    error.mockRestore();
  });
});
