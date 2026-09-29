import { describe, expect, it, vi } from "vitest";
import { getGuestGreeting } from "@/lib/invitation/greeting";
import { readPublicRsvpFormData, RSVP_LIMITS, sanitizePlainText, submitPublicRsvpFor, validatePublicRsvp, type PublicRsvpDeps, type RsvpTarget, type RsvpValue } from "@/server/services/public-rsvp";
import { summarizeRsvp } from "@/server/services/dashboard";
import { guestRecordToRow } from "@/server/mappers/guest";
import type { RSVPSettings } from "@/types/invitation";

const NOW = Date.parse("2026-09-26T12:00:00Z");
const TOKEN = "T".repeat(32);
const rsvpSettings: RSVPSettings = { enabled: true, deadline: "2027-04-17T23:59:00-06:00", message: "", maxCompanions: 3, allowMaybe: true, askDietaryNotes: false };
const questions = [
  { id: "q_text", label: "¿Alguna alergia?", type: "TEXT" as const, required: false, options: [] },
  { id: "q_choice", label: "Menú", type: "CHOICE" as const, required: true, options: ["Carne", "Pescado"] },
  { id: "q_bool", label: "¿Transporte?", type: "BOOLEAN" as const, required: false, options: [] },
];
const target = (over: Partial<RsvpTarget> = {}): RsvpTarget => ({ eventId: "evt_A", guestId: "gst_1", maxCompanions: 2, rsvp: rsvpSettings, questions: [], ...over });
const raw = (over: Partial<Parameters<typeof validatePublicRsvp>[1]> = {}) => ({ status: "ATTENDING", attendeeCount: "", message: "", answers: {}, ...over });

describe("Validación del RSVP público (servidor)", () => {
  it("4. attendeeCount sobre el máximo se rechaza; el máximo es 1 + maxCompanions (incluye al invitado)", () => {
    const t = target({ maxCompanions: 2 });
    expect(validatePublicRsvp(t, raw({ attendeeCount: "3" }), NOW)).toMatchObject({ ok: true, value: { status: "ATTENDING", attendeeCount: 3 } });
    expect(validatePublicRsvp(t, raw({ attendeeCount: "4" }), NOW)).toMatchObject({ ok: false, code: "invalid", fieldErrors: { attendeeCount: expect.any(String) } });
    expect(validatePublicRsvp(t, raw({ attendeeCount: "999" }), NOW).ok).toBe(false);
  });

  it("5. attendeeCount negativo, cero, decimal o no numérico se rechaza", () => {
    for (const value of ["-1", "0", "1.5", "dos", "1e2", " -3 "]) expect(validatePublicRsvp(target(), raw({ attendeeCount: value }), NOW).ok, value).toBe(false);
  });

  it("sin acompañantes permitidos siempre es 1 y no se acepta otro valor", () => {
    const t = target({ maxCompanions: 0 });
    expect(validatePublicRsvp(t, raw({ attendeeCount: "" }), NOW)).toMatchObject({ ok: true, value: { attendeeCount: 1 } });
    expect(validatePublicRsvp(t, raw({ attendeeCount: "1" }), NOW)).toMatchObject({ ok: true, value: { attendeeCount: 1 } });
    expect(validatePublicRsvp(t, raw({ attendeeCount: "2" }), NOW).ok).toBe(false);
  });

  it("6. DECLINED fuerza attendeeCount = 0 aunque el cliente envíe otro valor; MAYBE lo deja en null", () => {
    expect(validatePublicRsvp(target(), raw({ status: "DECLINED", attendeeCount: "3" }), NOW)).toMatchObject({ ok: true, value: { status: "DECLINED", attendeeCount: 0 } });
    expect(validatePublicRsvp(target(), raw({ status: "MAYBE", attendeeCount: "3" }), NOW)).toMatchObject({ ok: true, value: { status: "MAYBE", attendeeCount: null } });
  });

  it("solo estados del enum permitidos; MAYBE solo si la invitación lo admite; PENDING no se puede enviar", () => {
    expect(validatePublicRsvp(target(), raw({ status: "PENDING" }), NOW).ok).toBe(false);
    expect(validatePublicRsvp(target(), raw({ status: "CONFIRMED" }), NOW).ok).toBe(false);
    expect(validatePublicRsvp(target(), raw({ status: "" }), NOW).ok).toBe(false);
    expect(validatePublicRsvp(target({ rsvp: { ...rsvpSettings, allowMaybe: false } }), raw({ status: "MAYBE" }), NOW).ok).toBe(false);
  });

  it("mensaje: texto plano, sin etiquetas HTML ni caracteres de control, máximo 500", () => {
    expect(sanitizePlainText("Hola <script>alert(1)</script> <b>mundo</b>\u0000\u0007")).toBe("Hola alert(1) mundo");
    expect(validatePublicRsvp(target(), raw({ message: "  ¡Ahí estaremos!  " }), NOW)).toMatchObject({ ok: true, value: { message: "¡Ahí estaremos!" } });
    expect(validatePublicRsvp(target(), raw({ message: "x".repeat(RSVP_LIMITS.message) }), NOW).ok).toBe(true);
    expect(validatePublicRsvp(target(), raw({ message: "x".repeat(RSVP_LIMITS.message + 1) }), NOW)).toMatchObject({ ok: false, fieldErrors: { message: expect.any(String) } });
    expect(validatePublicRsvp(target(), raw({ message: "   " }), NOW)).toMatchObject({ ok: true, value: { message: null } });
  });

  it("7. una respuesta a una pregunta de OTRO evento se rechaza (solo valen las preguntas de este evento)", () => {
    const t = target({ questions });
    expect(validatePublicRsvp(t, raw({ answers: { q_choice: "Carne", q_de_otro_evento: "hola" } }), NOW)).toMatchObject({ ok: false, fieldErrors: { answers: expect.any(String) } });
    expect(validatePublicRsvp(t, raw({ answers: JSON.parse('{"q_choice":"Carne","__proto__":"x"}') }), NOW).ok).toBe(false);
  });

  it("preguntas: tipos, opciones válidas y obligatorias solo al confirmar asistencia", () => {
    const t = target({ questions });
    expect(validatePublicRsvp(t, raw({ answers: { q_choice: "Pescado", q_bool: "yes", q_text: "ninguna" } }), NOW)).toMatchObject({ ok: true, value: { answers: [{ questionId: "q_text", value: "ninguna" }, { questionId: "q_choice", value: "Pescado" }, { questionId: "q_bool", value: "yes" }] } });
    expect(validatePublicRsvp(t, raw({ answers: {} }), NOW).ok).toBe(false); // obligatoria
    expect(validatePublicRsvp(t, raw({ status: "DECLINED", answers: {} }), NOW).ok).toBe(true); // al declinar no se exigen
    expect(validatePublicRsvp(t, raw({ answers: { q_choice: "Pizza" } }), NOW).ok).toBe(false);
    expect(validatePublicRsvp(t, raw({ answers: { q_choice: "Carne", q_bool: "tal vez" } }), NOW).ok).toBe(false);
    expect(validatePublicRsvp(t, raw({ answers: { q_choice: "Carne", q_text: "x".repeat(501) } }), NOW).ok).toBe(false);
  });

  it("respeta el plazo y si la confirmación está habilitada (lo decide el servidor)", () => {
    expect(validatePublicRsvp(target(), raw(), Date.parse("2027-05-01T00:00:00Z"))).toMatchObject({ ok: false, code: "closed" });
    expect(validatePublicRsvp(target({ rsvp: { ...rsvpSettings, enabled: false } }), raw(), NOW)).toMatchObject({ ok: false, code: "closed" });
  });

  it("readPublicRsvpFormData lee solo slug, guest, status, attendeeCount, message y answer:<id>", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ slug: "andrea", guest: TOKEN, status: "ATTENDING", attendeeCount: "2", message: "hola", "answer:q_text": "x", ownerId: "usr_x", guestId: "gst_x", eventId: "evt_x", maxCompanions: "99" })) form.set(key, value);
    const read = readPublicRsvpFormData(form);
    expect(read).toEqual({ slug: "andrea", token: TOKEN, raw: { status: "ATTENDING", attendeeCount: "2", message: "hola", answers: { q_text: "x" } } });
    expect(JSON.stringify(read)).not.toMatch(/usr_x|gst_x|evt_x|99/);
  });
});

/** Almacén en memoria con la misma semántica que la BD: un Rsvp por invitado (upsert), Guest.status sincronizado. */
function world() {
  const rsvps = new Map<string, { id: number; status: string; attendeeCount: number | null; message: string | null; answers: RsvpValue["answers"] }>();
  const guests = new Map([["gst_1", { status: "PENDING" as "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE" }]]);
  let nextId = 1;
  const saves: unknown[] = [];
  const deps = (over: Partial<PublicRsvpDeps> = {}): PublicRsvpDeps => ({
    resolveTarget: async (slug, token) => (slug === "andrea" && token === TOKEN ? target({ questions }) : null),
    save: async (t, value) => {
      saves.push(value);
      const existing = rsvps.get(t.guestId);
      const changed = !existing || existing.status !== value.status || existing.attendeeCount !== value.attendeeCount;
      rsvps.set(t.guestId, { id: existing?.id ?? nextId++, status: value.status, attendeeCount: value.attendeeCount, message: value.message, answers: value.answers });
      guests.get(t.guestId)!.status = value.status;
      return { ok: true, changed };
    },
    now: () => NOW,
    isUnavailable: () => false,
    ...over,
  });
  return { rsvps, guests, saves, deps };
}
const submit = (w: ReturnType<typeof world>, fields: Partial<Parameters<typeof validatePublicRsvp>[1]>, token = TOKEN, slug = "andrea") => submitPublicRsvpFor({ slug, token, raw: raw({ answers: { q_choice: "Carne" }, ...fields }) }, w.deps());

describe("Flujo funcional del RSVP", () => {
  it("1–2. la primera respuesta crea el Rsvp; la segunda ACTUALIZA el mismo (nunca dos)", async () => {
    const w = world();
    expect(await submit(w, { attendeeCount: "2" })).toMatchObject({ ok: true, status: "ATTENDING", attendeeCount: 2 });
    const id = w.rsvps.get("gst_1")!.id;
    expect(await submit(w, { attendeeCount: "1", message: "cambio" })).toMatchObject({ ok: true, attendeeCount: 1 });
    expect(w.rsvps.size).toBe(1);
    expect(w.rsvps.get("gst_1")!.id).toBe(id);
    expect(w.rsvps.get("gst_1")).toMatchObject({ attendeeCount: 1, message: "cambio" });
  });

  it("3–4. CONFIRMED → DECLINED → CONFIRMED (y MAYBE → CONFIRMED) funcionan sin restricciones", async () => {
    const w = world();
    await submit(w, { status: "ATTENDING", attendeeCount: "3" });
    expect(await submit(w, { status: "DECLINED" })).toMatchObject({ ok: true, status: "DECLINED", attendeeCount: 0, message: "Gracias por avisarnos." });
    expect(w.rsvps.get("gst_1")).toMatchObject({ status: "DECLINED", attendeeCount: 0 });
    expect(await submit(w, { status: "ATTENDING", attendeeCount: "2" })).toMatchObject({ ok: true, attendeeCount: 2, message: "Tu asistencia ha sido confirmada." });
    await submit(w, { status: "MAYBE" });
    expect(w.rsvps.get("gst_1")).toMatchObject({ status: "MAYBE", attendeeCount: null });
    expect(await submit(w, { status: "ATTENDING", attendeeCount: "1" })).toMatchObject({ ok: true });
    expect(w.rsvps.size).toBe(1);
  });

  it("5–6. el mensaje y las respuestas se persisten", async () => {
    const w = world();
    await submit(w, { message: " Felicidades <i>a los dos</i> ", answers: { q_choice: "Pescado", q_text: "Sin nueces", q_bool: "no" } });
    expect(w.rsvps.get("gst_1")).toMatchObject({ message: "Felicidades a los dos", answers: expect.arrayContaining([{ questionId: "q_choice", value: "Pescado" }, { questionId: "q_text", value: "Sin nueces" }, { questionId: "q_bool", value: "no" }]) });
  });

  it("7–8. el resumen del dashboard y la lista del Guest Manager reflejan el nuevo estado", async () => {
    const w = world();
    const summary = () => summarizeRsvp([...w.guests.values()]);
    expect(summary()).toEqual({ confirmed: 0, pending: 1, declined: 0 });
    await submit(w, { status: "ATTENDING", attendeeCount: "3" });
    expect(summary()).toEqual({ confirmed: 1, pending: 0, declined: 0 });
    const row = () => guestRecordToRow({ id: "gst_1", name: "Mariana López", email: null, phone: null, groupId: null, groupName: null, maxCompanions: 2, status: w.guests.get("gst_1")!.status, inviteToken: TOKEN, createdAt: new Date(), attendeeCount: w.rsvps.get("gst_1")!.attendeeCount }, "andrea");
    expect(row()).toMatchObject({ statusGroup: "confirmed", attendeeCount: 3 });
    await submit(w, { status: "MAYBE" });
    expect(summary()).toEqual({ confirmed: 0, pending: 1, declined: 0 }); // «Tal vez» = pendiente
    await submit(w, { status: "DECLINED" });
    expect(summary()).toEqual({ confirmed: 0, pending: 0, declined: 1 });
    expect(row()).toMatchObject({ statusGroup: "declined", attendeeCount: null });
  });

  it("token mal formado, desconocido o de otro evento: mismo resultado, sin guardar ni filtrar información", async () => {
    const w = world();
    const results = [await submit(w, {}, "corto"), await submit(w, {}, "x".repeat(40)), await submit(w, {}, TOKEN, "otro-evento"), await submit(w, {}, "../../etc/passwd")];
    for (const result of results) expect(result).toEqual({ ok: false, code: "invalid_token", message: "No pudimos identificar esta invitación personalizada." });
    expect(w.saves).toHaveLength(0);
  });

  it("errores de infraestructura: mensaje genérico, sin detalles ni datos personales en el registro", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const w = world();
    const boom = w.deps({ save: async () => { throw new Error("Invalid `prisma.rsvp.upsert()` message=Hola secreto token=" + TOKEN); } });
    const result = await submitPublicRsvpFor({ slug: "andrea", token: TOKEN, raw: raw({ message: "mensaje privado", answers: { q_choice: "Carne" } }) }, boom);
    expect(result).toMatchObject({ ok: false, code: "error" });
    expect(JSON.stringify(result)).not.toMatch(/prisma|secreto|upsert/i);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(new RegExp(`${TOKEN}|mensaje privado|secreto`));
    const down = w.deps({ save: async () => { throw new Error("down"); }, isUnavailable: () => true });
    expect(await submitPublicRsvpFor({ slug: "andrea", token: TOKEN, raw: raw({ answers: { q_choice: "Carne" } }) }, down)).toMatchObject({ ok: false, code: "unavailable" });
    error.mockRestore();
  });

  it("un reintento idéntico (doble envío) deja el mismo resultado y un solo Rsvp", async () => {
    const w = world();
    const [a, b] = await Promise.all([submit(w, { attendeeCount: "2" }), submit(w, { attendeeCount: "2" })]);
    expect(a).toEqual(b);
    expect(w.rsvps.size).toBe(1);
  });
});

describe("Saludo personalizado (helper, no la portada)", () => {
  it("individual: solo el nombre; sin «y familia» aunque tenga acompañantes", () => {
    expect(getGuestGreeting({ displayName: "Mariana López" })).toMatchObject({ addressee: "Mariana", text: "Mariana, nos encantará compartir este día contigo." });
    expect(getGuestGreeting({ displayName: "Mariana López", groupName: "Amigos" }).text).toBe("Mariana, nos encantará compartir este día contigo.");
  });
  it("grupo familiar: «Luis y familia … con ustedes»", () => {
    expect(getGuestGreeting({ displayName: "Luis Hernández", groupName: "Familia" }).text).toBe("Luis y familia, nos encantará compartir este día con ustedes.");
    expect(getGuestGreeting({ displayName: "Luis", groupName: "Familia de Andrea" }).addressee).toBe("Luis y familia");
  });
  it("nombres ya plurales se usan tal cual; los muy largos se recortan", () => {
    expect(getGuestGreeting({ displayName: "Familia López" })).toMatchObject({ addressee: "Familia López", message: "nos encantará compartir este día con ustedes." });
    expect(getGuestGreeting({ displayName: "Ana y Luis" }).addressee).toBe("Ana y Luis");
    const long = getGuestGreeting({ displayName: "Familia " + "Rodríguez de la Fuente ".repeat(4) });
    expect(long.addressee.length).toBeLessThanOrEqual(29);
    expect(getGuestGreeting({ displayName: "Maximiliano-Alejandro Fernández-Villalobos de la Vega" }).addressee).toBe("Maximiliano-Alejandro");
  });
  it("sin grupo y con espacios raros", () => {
    expect(getGuestGreeting({ displayName: "  Ana   " }).addressee).toBe("Ana");
  });
});
