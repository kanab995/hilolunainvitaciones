import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computePaidAccessEnd, extendPaidAccessEnd, getEffectiveEventPlan, isEventAccessActive, PAID_ACCESS_DAYS } from "@/lib/billing/purchase";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { buildPublishedInvitationSnapshot } from "@/lib/publishing/snapshot";
import { visibleText } from "../invitation/helpers";

const NOW_KEY = vi.hoisted(() => ({ now: Date.parse("2027-06-01T12:00:00Z") }));
vi.mock("@/lib/invitation/server-time", () => ({ getServerNow: () => NOW_KEY.now }));

/** Base de datos de prueba: una invitación publicada con el snapshot de Magnolia y un evento con compras y acceso configurables. */
const db = vi.hoisted(() => ({
  event: { paidAccessEndsAt: null as Date | null, purchases: [] as Array<{ plan: string; status: string }> },
  calls: [] as string[],
  snapshot: undefined as unknown,
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    invitation: {
      findFirst: vi.fn(async () => {
        db.calls.push("invitation.findFirst");
        return { id: "inv_1", eventId: "evt_1", publications: [{ snapshot: db.snapshot }], event: db.event };
      }),
    },
    guest: { findFirst: vi.fn(async () => { db.calls.push("guest.findFirst"); return null; }) },
    rsvpQuestion: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/server/security/client-identity", () => ({ getClientAddress: async () => "1.2.3.4" }));

// El snapshot se fabrica una vez (fuera del mock hoisted).
db.snapshot = buildPublishedInvitationSnapshot({ invitation: andreaFernandoInvitation, template: magnoliaTemplate, assets: new Map(), version: 1, publishedAt: new Date("2027-01-01T00:00:00Z") }).snapshot;

import { ExpiredInvitation, EXPIRED_INVITATION_TITLE } from "@/components/invitation/expired-invitation";
import { getPublishedCalendar } from "@/server/services/calendar-service";
import { isExpiredRecord, loadPublishedInvitation } from "@/server/repositories/publishing";
import { getPublicInvitationRecord, resolveRsvpTarget } from "@/server/repositories/public-invitations";
import { submitPublicRsvpFor, type PublicRsvpDeps } from "@/server/services/public-rsvp";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const paid = (over: Partial<{ plan: string; status: string }> = {}) => ({ plan: "ESSENTIAL", status: "PAID", ...over });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  NOW_KEY.now = Date.parse("2027-06-01T12:00:00Z");
  db.calls.length = 0;
  db.event = { paidAccessEndsAt: null, purchases: [] };
});
afterEach(() => vi.unstubAllEnvs());

describe("(11/12) expiración del acceso público", () => {
  it("un evento de PAGO con el acceso vigente se muestra normal", async () => {
    db.event = { paidAccessEndsAt: new Date("2027-06-10T00:00:00Z"), purchases: [paid()] };
    const record = await loadPublishedInvitation("boda");
    expect(isExpiredRecord(record)).toBe(false);
    expect(record).toMatchObject({ eventId: "evt_1", invitation: expect.any(Object) });
  });

  it("al vencer paidAccessEndsAt, la lectura devuelve SOLO { expired, eventId }: ni invitación, ni nombres, ni fecha, ni plantilla", async () => {
    db.event = { paidAccessEndsAt: new Date("2027-05-31T00:00:00Z"), purchases: [paid()] };
    const record = await loadPublishedInvitation("boda");
    expect(record).toEqual({ expired: true, eventId: "evt_1" });
    expect(JSON.stringify(record)).not.toMatch(/Andrea|Fernando|Magnolia|startsAt/);
  });

  it("FREE nunca expira (comportamiento actual), aunque tenga un paidAccessEndsAt viejo (p. ej. tras un reembolso total)", async () => {
    db.event = { paidAccessEndsAt: new Date("2020-01-01T00:00:00Z"), purchases: [] };
    expect(isExpiredRecord(await loadPublishedInvitation("boda"))).toBe(false);
    db.event = { paidAccessEndsAt: new Date("2020-01-01T00:00:00Z"), purchases: [paid({ status: "REFUNDED" }), paid({ status: "PENDING", plan: "PREMIUM" })].filter((purchase) => purchase.status === "PAID") };
    expect(isExpiredRecord(await loadPublishedInvitation("boda"))).toBe(false);
  });

  it("usa isEventAccessActive (la misma función del producto): el límite exacto sigue activo, un instante después expira", async () => {
    const end = new Date("2027-06-01T12:00:00Z");
    db.event = { paidAccessEndsAt: end, purchases: [paid()] };
    expect(isEventAccessActive({ plan: "ESSENTIAL", paidAccessEndsAt: end, now: new Date(NOW_KEY.now) })).toBe(true);
    expect(isExpiredRecord(await loadPublishedInvitation("boda"))).toBe(false);
    NOW_KEY.now += 1;
    expect(isExpiredRecord(await loadPublishedInvitation("boda"))).toBe(true);
  });

  it("los enlaces personalizados (?guest=) caen en la misma página de expiración SIN consultar al invitado", async () => {
    db.event = { paidAccessEndsAt: new Date("2027-05-01T00:00:00Z"), purchases: [paid()] };
    const record = await getPublicInvitationRecord("boda", TOKEN);
    expect(record).toEqual({ expired: true, eventId: "evt_1" });
    expect(db.calls).not.toContain("guest.findFirst");
  });

  it("(13) RSVP tras la expiración: no se acepta (code expired) y no se guarda nada", async () => {
    db.event = { paidAccessEndsAt: new Date("2027-05-01T00:00:00Z"), purchases: [paid()] };
    expect(await resolveRsvpTarget("boda", TOKEN)).toBe("expired");
    const save = vi.fn();
    const deps: PublicRsvpDeps = { resolveTarget: resolveRsvpTarget, save, now: () => NOW_KEY.now, isUnavailable: () => false };
    expect(await submitPublicRsvpFor({ slug: "boda", token: TOKEN, raw: { status: "ATTENDING", attendeeCount: 1, message: "", answers: {} } }, deps)).toEqual({ ok: false, code: "expired", message: EXPIRED_INVITATION_TITLE });
    expect(save).not.toHaveBeenCalled();
  });

  it("(13) calendar.ics: sin archivo (404) cuando el evento expiró; con el acceso vigente, sí hay archivo", async () => {
    db.event = { paidAccessEndsAt: new Date("2027-05-01T00:00:00Z"), purchases: [paid()] };
    expect(await getPublishedCalendar("boda")).toBeUndefined();
    db.event = { paidAccessEndsAt: new Date("2027-12-01T00:00:00Z"), purchases: [paid()] };
    expect(await getPublishedCalendar("boda")).toMatchObject({ filename: expect.stringMatching(/\.ics$/) });
  });

  it("la página elegante: «Esta invitación ya no está disponible.», sin contenido del evento, sin enlaces al producto", () => {
    const html = renderToStaticMarkup(<ExpiredInvitation />);
    const text = visibleText(html);
    expect(html).toContain('data-invitation-state="expired"');
    expect(text).toContain("Esta invitación");
    expect(text).toContain("ya no está disponible.");
    expect(html).not.toMatch(/<a |href=/);
    expect(text).not.toMatch(/Andrea|Fernando|Magnolia|\d{4}/);
    expect(EXPIRED_INVITATION_TITLE).toBe("Esta invitación ya no está disponible.");
  });
});

describe("(14) cambios de fecha: extender sí, acortar nunca", () => {
  const day = 86_400_000;

  it("recorrido completo: compra → el evento pasa → expira → se mueve la fecha hacia adelante → vuelve → mover hacia atrás NO lo acorta", async () => {
    const eventDate = new Date("2027-05-17T23:00:00Z");
    const paidAt = new Date("2027-03-01T00:00:00Z");
    let end = computePaidAccessEnd({ startsAt: eventDate, paidAt });
    expect(end.getTime()).toBe(eventDate.getTime() + PAID_ACCESS_DAYS * day);
    const state = async () => {
      db.event = { paidAccessEndsAt: end, purchases: [paid()] };
      return isExpiredRecord(await loadPublishedInvitation("boda")) ? "expirado" : "activo";
    };

    NOW_KEY.now = eventDate.getTime() + 10 * day;
    expect(await state()).toBe("activo");
    NOW_KEY.now = eventDate.getTime() + 31 * day;
    expect(await state()).toBe("expirado");

    // El anfitrión mueve el evento 2 meses hacia adelante (ya había expirado): el acceso se EXTIENDE.
    const later = new Date(eventDate.getTime() + 60 * day);
    end = extendPaidAccessEnd(end, later) as Date;
    expect(end.getTime()).toBe(later.getTime() + PAID_ACCESS_DAYS * day);
    expect(await state()).toBe("activo");

    // Mover la fecha hacia atrás nunca lo acorta.
    const earlier = new Date(eventDate.getTime() - 40 * day);
    expect((extendPaidAccessEnd(end, earlier) as Date).getTime()).toBe(end.getTime());
  });

  it("comprar DESPUÉS del evento da al menos 30 días desde la compra; una mejora posterior no acorta el acceso", () => {
    const eventDate = new Date("2027-01-01T00:00:00Z");
    const paidAt = new Date("2027-02-15T00:00:00Z");
    const end = computePaidAccessEnd({ startsAt: eventDate, paidAt });
    expect(end.getTime()).toBe(paidAt.getTime() + 30 * day);
    expect(computePaidAccessEnd({ startsAt: eventDate, paidAt: new Date("2027-01-05T00:00:00Z"), currentEnd: end }).getTime()).toBe(end.getTime());
    expect(getEffectiveEventPlan([{ plan: "ESSENTIAL", status: "PAID" }])).toBe("ESSENTIAL");
  });

  it("guardar un borrador con otra fecha extiende paidAccessEndsAt en la MISMA transacción (el repositorio ya lo hace; nunca lo reduce)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("server/repositories/draft.ts", "utf8");
    expect(source).toMatch(/extendPaidAccessEnd\(currentEnd, startsAt\)/);
    expect(source).toMatch(/extendedEnd\.getTime\(\) > currentEnd\.getTime\(\)/);
  });
});
