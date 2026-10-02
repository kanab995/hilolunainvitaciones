import { describe, expect, it, vi } from "vitest";
import {
  readGeneralRsvpFormData,
  submitGeneralRsvpFor,
  validateGeneralRsvp,
  type GeneralRsvpDeps,
  type GeneralRsvpTarget,
} from "@/server/services/general-rsvp";
import type { RSVPSettings } from "@/types/invitation";

const NOW = Date.parse("2026-09-26T12:00:00Z");
const rsvpSettings: RSVPSettings = { enabled: true, deadline: "2027-04-17T23:59:00-06:00", message: "", maxCompanions: 3, allowMaybe: true, askDietaryNotes: false };
const target = (over: Partial<GeneralRsvpTarget> = {}): GeneralRsvpTarget => ({ eventId: "evt_A", rsvp: rsvpSettings, ...over });
const raw = (over: Partial<Parameters<typeof validateGeneralRsvp>[1]> = {}) => ({ name: "Mariana López", status: "ATTENDING", companions: "", dietaryNotes: "", ...over });

describe("Validación del RSVP general (servidor, D-40)", () => {
  it("el nombre es obligatorio (mínimo 2 caracteres, saneado)", () => {
    expect(validateGeneralRsvp(target(), raw({ name: "" }), NOW)).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(validateGeneralRsvp(target(), raw({ name: "A" }), NOW).ok).toBe(false);
    expect(validateGeneralRsvp(target(), raw({ name: "  <b>Ana</b>  " }), NOW)).toMatchObject({ ok: true, value: { name: "Ana" } });
  });

  it("acompañantes: 1 + companions, acotado a maxCompanions; DECLINED fuerza 0; MAYBE deja null", () => {
    const t = target({ rsvp: { ...rsvpSettings, maxCompanions: 2 } });
    expect(validateGeneralRsvp(t, raw({ companions: "" }), NOW)).toMatchObject({ ok: true, value: { attendeeCount: 1 } });
    expect(validateGeneralRsvp(t, raw({ companions: "2" }), NOW)).toMatchObject({ ok: true, value: { attendeeCount: 3 } });
    expect(validateGeneralRsvp(t, raw({ companions: "3" }), NOW)).toMatchObject({ ok: false, fieldErrors: { attendeeCount: expect.any(String) } });
    expect(validateGeneralRsvp(t, raw({ companions: "-1" }), NOW).ok).toBe(false);
    expect(validateGeneralRsvp(t, raw({ companions: "1.5" }), NOW).ok).toBe(false);
    expect(validateGeneralRsvp(t, raw({ status: "DECLINED", companions: "2" }), NOW)).toMatchObject({ ok: true, value: { status: "DECLINED", attendeeCount: 0 } });
    expect(validateGeneralRsvp(t, raw({ status: "MAYBE", companions: "2" }), NOW)).toMatchObject({ ok: true, value: { status: "MAYBE", attendeeCount: null } });
  });

  it("sin acompañantes permitidos (maxCompanions = 0) solo cabe 1", () => {
    const t = target({ rsvp: { ...rsvpSettings, maxCompanions: 0 } });
    expect(validateGeneralRsvp(t, raw({ companions: "" }), NOW)).toMatchObject({ ok: true, value: { attendeeCount: 1 } });
    expect(validateGeneralRsvp(t, raw({ companions: "1" }), NOW).ok).toBe(false);
  });

  it("solo ATTENDING/DECLINED/MAYBE; MAYBE solo si allowMaybe", () => {
    expect(validateGeneralRsvp(target(), raw({ status: "PENDING" }), NOW).ok).toBe(false);
    expect(validateGeneralRsvp(target(), raw({ status: "" }), NOW).ok).toBe(false);
    expect(validateGeneralRsvp(target({ rsvp: { ...rsvpSettings, allowMaybe: false } }), raw({ status: "MAYBE" }), NOW).ok).toBe(false);
  });

  it("restricciones alimentarias: solo si la invitación las pide; texto plano, máximo 500", () => {
    const withDiet = target({ rsvp: { ...rsvpSettings, askDietaryNotes: true } });
    expect(validateGeneralRsvp(target(), raw({ dietaryNotes: "Vegetariana" }), NOW)).toMatchObject({ ok: true, value: { dietaryNotes: null } });
    expect(validateGeneralRsvp(withDiet, raw({ dietaryNotes: " Vegetariana <b>sin nueces</b> " }), NOW)).toMatchObject({ ok: true, value: { dietaryNotes: "Vegetariana sin nueces" } });
    expect(validateGeneralRsvp(withDiet, raw({ dietaryNotes: "" }), NOW)).toMatchObject({ ok: true, value: { dietaryNotes: null } });
  });

  it("respeta el plazo y si la confirmación está habilitada", () => {
    expect(validateGeneralRsvp(target(), raw(), Date.parse("2027-05-01T00:00:00Z"))).toMatchObject({ ok: false, code: "closed" });
    expect(validateGeneralRsvp(target({ rsvp: { ...rsvpSettings, enabled: false } }), raw(), NOW)).toMatchObject({ ok: false, code: "closed" });
  });

  it("readGeneralRsvpFormData lee solo slug, name, status, companions y dietaryNotes", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ slug: "andrea-y-fernando", name: "Mariana", status: "ATTENDING", companions: "1", dietaryNotes: "x", ownerId: "usr_x", eventId: "evt_x", guest: "T".repeat(32) })) form.set(key, value);
    const read = readGeneralRsvpFormData(form);
    expect(read).toEqual({ slug: "andrea-y-fernando", raw: { name: "Mariana", status: "ATTENDING", companions: "1", dietaryNotes: "x" } });
    expect(JSON.stringify(read)).not.toMatch(/usr_x|evt_x/);
  });
});

/** Mundo en memoria: crea un invitado nuevo por cada envío válido (sin identidad entre envíos, D-40). */
function world(overCheck: "ok" | "limit_reached" = "ok") {
  const guests: { id: string; eventId: string; name: string; status: string; attendeeCount: number | null; dietaryNotes: string | null }[] = [];
  let nextId = 1;
  const onSavedCalls: unknown[] = [];
  const deps = (over: Partial<GeneralRsvpDeps> = {}): GeneralRsvpDeps => ({
    // Una demo (slug `demo-*`) nunca resuelve destino: nunca se persiste (igual que en producción).
    resolveTarget: async (slug) => (slug === "andrea-y-fernando" ? target() : slug.startsWith("demo-") ? null : null),
    checkLimit: async () => overCheck,
    save: async (t, value) => {
      const id = `gst_auto_${nextId++}`;
      guests.push({ id, eventId: t.eventId, name: value.name, status: value.status, attendeeCount: value.attendeeCount, dietaryNotes: value.dietaryNotes });
      return { guestId: id };
    },
    now: () => NOW,
    isUnavailable: () => false,
    onSaved: (input) => onSavedCalls.push(input),
    ...over,
  });
  return { guests, onSavedCalls, deps };
}
const submit = (w: ReturnType<typeof world>, fields: Partial<Parameters<typeof validateGeneralRsvp>[1]> = {}, slug = "andrea-y-fernando") =>
  submitGeneralRsvpFor({ slug, raw: raw(fields) }, w.deps());

describe("Flujo funcional del RSVP general (D-40)", () => {
  it("cada envío válido crea un invitado NUEVO (sin identidad entre envíos)", async () => {
    const w = world();
    expect(await submit(w, { name: "Ana" })).toMatchObject({ ok: true, status: "ATTENDING" });
    expect(await submit(w, { name: "Ana" })).toMatchObject({ ok: true, status: "ATTENDING" });
    expect(w.guests).toHaveLength(2);
    expect(w.guests[0]!.id).not.toBe(w.guests[1]!.id);
  });

  it("una invitación de demostración (slug demo-*) NUNCA resuelve destino: nada se guarda", async () => {
    const w = world();
    const result = await submit(w, {}, "demo-aurora-xv");
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(w.guests).toHaveLength(0);
  });

  it("cupo alcanzado (D-40, cuota propia del plan): no crea nada", async () => {
    const w = world("limit_reached");
    const result = await submit(w);
    expect(result).toMatchObject({ ok: false, code: "limit_reached" });
    expect(w.guests).toHaveLength(0);
  });

  it("límite de tasa: no crea nada", async () => {
    const w = world();
    const result = await submitGeneralRsvpFor({ slug: "andrea-y-fernando", raw: raw() }, w.deps({ isRateLimited: async () => true }));
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(w.guests).toHaveLength(0);
  });

  it("slug desconocido o mal formado: mismo tipo de resultado, sin guardar", async () => {
    const w = world();
    const results = [await submit(w, {}, "no-existe"), await submit(w, {}, "../../etc/passwd"), await submit(w, {}, "")];
    for (const result of results) expect(result.ok).toBe(false);
    expect(w.guests).toHaveLength(0);
  });

  it("datos inválidos: no crea nada y marca el campo", async () => {
    const w = world();
    const result = await submit(w, { name: "" });
    expect(result).toMatchObject({ ok: false, code: "invalid", fieldErrors: { name: expect.any(String) } });
    expect(w.guests).toHaveLength(0);
  });

  it("notifica al anfitrión tras guardar (D-36, mismo contrato); un fallo del aviso no hace fallar el RSVP", async () => {
    const w = world();
    await submit(w, { name: "Ana" });
    expect(w.onSavedCalls).toHaveLength(1);
    const boomOnSaved = w.deps({ onSaved: () => { throw new Error("email caído"); } });
    const result = await submitGeneralRsvpFor({ slug: "andrea-y-fernando", raw: raw({ name: "Luis" }) }, boomOnSaved);
    expect(result.ok).toBe(true);
  });

  it("errores de infraestructura: mensaje genérico, sin detalles ni datos personales en el registro", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const w = world();
    const boom = w.deps({ save: async () => { throw new Error("Invalid `prisma.guest.create()` name=Mariana secreto"); } });
    const result = await submitGeneralRsvpFor({ slug: "andrea-y-fernando", raw: raw({ name: "Mariana" }) }, boom);
    expect(result).toMatchObject({ ok: false, code: "error" });
    expect(JSON.stringify(result)).not.toMatch(/prisma|secreto|Mariana/i);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/Mariana|secreto/);
    const down = w.deps({ save: async () => { throw new Error("down"); }, isUnavailable: () => true });
    expect(await submitGeneralRsvpFor({ slug: "andrea-y-fernando", raw: raw() }, down)).toMatchObject({ ok: false, code: "unavailable" });
    error.mockRestore();
  });
});
