import { describe, expect, it } from "vitest";
import { getCountdown } from "@/lib/invitation/countdown";
import { formatCompactDate } from "@/lib/invitation/format";
import { getRsvpAvailability, validateRsvp } from "@/lib/invitation/rsvp";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";

describe("getCountdown", () => {
  const target = "2027-05-17T17:00:00-06:00";

  it("descompone el tiempo restante", () => {
    const now = Date.parse(target) - (2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000);
    expect(getCountdown(target, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, isPast: false });
  });

  it("es determinista: depende solo de la hora inyectada", () => {
    const now = Date.parse("2027-01-01T00:00:00-06:00");
    expect(getCountdown(target, now)).toEqual(getCountdown(target, now));
    expect(getCountdown(target, now).days).toBe(136);
  });

  it("en el instante y después queda en cero y marcado como pasado", () => {
    expect(getCountdown(target, Date.parse(target))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
    expect(getCountdown(target, Date.parse(target) + 1)).toMatchObject({ isPast: true });
  });

  it("una fecha inválida no rompe", () => {
    expect(getCountdown("no es una fecha", 0).isPast).toBe(true);
  });
});

describe("formatCompactDate", () => {
  it("usa la zona horaria del evento", () => {
    const { startsAt, timezone } = andreaFernandoInvitation.event;
    expect(formatCompactDate(startsAt, timezone)).toBe("17 · 05 · 27");
    // 17:00 en México es el mismo día; a las 23:30 UTC del día anterior sigue siendo 16 en Tokio+... se comprueba el cambio de día
    expect(formatCompactDate("2027-05-17T23:30:00-06:00", "Asia/Tokyo")).toBe("18 · 05 · 27");
  });
});

describe("RSVP (lógica genérica de la invitación)", () => {
  const { rsvp } = andreaFernandoInvitation;
  const valid = { name: "Laura", attendance: "yes" as const, companions: 1 };

  it("acepta una respuesta válida", () => {
    expect(validateRsvp(rsvp, valid)).toEqual({});
  });

  it("exige nombre y una opción de asistencia", () => {
    expect(validateRsvp(rsvp, { ...valid, name: " " }).name).toBeDefined();
    expect(validateRsvp(rsvp, { ...valid, attendance: "" }).attendance).toBeDefined();
  });

  it("respeta el máximo de acompañantes de la invitación", () => {
    expect(validateRsvp(rsvp, { ...valid, companions: rsvp.maxCompanions }).companions).toBeUndefined();
    expect(validateRsvp(rsvp, { ...valid, companions: rsvp.maxCompanions + 1 }).companions).toBeDefined();
    expect(validateRsvp(rsvp, { ...valid, companions: -1 }).companions).toBeDefined();
  });

  it("«Tal vez» solo es válido si la invitación lo permite", () => {
    expect(validateRsvp(rsvp, { ...valid, attendance: "maybe" })).toEqual({});
    expect(validateRsvp({ ...rsvp, allowMaybe: false }, { ...valid, attendance: "maybe" }).attendance).toBeDefined();
  });

  it("disponibilidad: abierta, cerrada tras el plazo o deshabilitada", () => {
    const deadline = Date.parse(rsvp.deadline ?? "");
    expect(getRsvpAvailability(rsvp, deadline - 1000)).toBe("open");
    expect(getRsvpAvailability(rsvp, deadline + 1000)).toBe("closed");
    expect(getRsvpAvailability({ ...rsvp, enabled: false }, 0)).toBe("disabled");
    expect(getRsvpAvailability({ ...rsvp, deadline: undefined }, Number.MAX_SAFE_INTEGER)).toBe("open");
  });
});
