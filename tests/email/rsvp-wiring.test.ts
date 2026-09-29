import { describe, expect, it, vi } from "vitest";

const { sendRsvpNotification, runAfterResponse } = vi.hoisted(() => ({
  sendRsvpNotification: vi.fn(async () => undefined),
  runAfterResponse: vi.fn((effect: () => Promise<void>) => void effect()),
}));

vi.mock("@/server/email/service", () => ({ sendRsvpNotification }));
vi.mock("@/server/email/run-after", () => ({ runAfterResponse }));
vi.mock("@/server/repositories/public-invitations", () => ({ resolveRsvpTarget: vi.fn(), savePublicRsvp: vi.fn() }));
vi.mock("@/server/security/rate-limit", () => ({ isRateLimited: vi.fn(), RATE_LIMIT_RULES: { rsvpByClient: {}, rsvpByGuest: {} }, rateLimitMessage: "Demasiados intentos." }));
vi.mock("@/server/security/client-identity", () => ({ getClientAddress: vi.fn(async () => "1.2.3.4") }));

import { defaultPublicRsvpDeps } from "@/server/services/public-rsvp-runtime";
import type { RsvpTarget, RsvpValue } from "@/server/services/public-rsvp";

const target: RsvpTarget = { eventId: "evt_1", guestId: "gst_1", maxCompanions: 2, rsvp: { enabled: true, message: "", maxCompanions: 2, allowMaybe: true, askDietaryNotes: false }, questions: [] };
const value = (over: Partial<RsvpValue> = {}): RsvpValue => ({ status: "ATTENDING", attendeeCount: 2, message: null, answers: [], ...over });

/** (D-36) `onSaved` es el ÚNICO punto donde el guardado del RSVP dispara el correo: debe respetar `changed` y usar `after()`. */
describe("public-rsvp-runtime: onSaved dispara la notificación solo si cambió", () => {
  it("con changed:true programa el correo vía runAfterResponse, con el estado y los asistentes", () => {
    defaultPublicRsvpDeps.onSaved?.({ target, value: value(), changed: true });
    expect(runAfterResponse).toHaveBeenCalledTimes(1);
    expect(sendRsvpNotification).toHaveBeenCalledWith({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 2 });
  });

  it("con changed:false NO programa nada", () => {
    runAfterResponse.mockClear();
    sendRsvpNotification.mockClear();
    defaultPublicRsvpDeps.onSaved?.({ target, value: value(), changed: false });
    expect(runAfterResponse).not.toHaveBeenCalled();
    expect(sendRsvpNotification).not.toHaveBeenCalled();
  });

  it("DECLINED/MAYBE nunca envían un número de asistentes, aunque el valor traiga uno", () => {
    runAfterResponse.mockClear();
    sendRsvpNotification.mockClear();
    defaultPublicRsvpDeps.onSaved?.({ target, value: value({ status: "DECLINED", attendeeCount: 0 }), changed: true });
    expect(sendRsvpNotification).toHaveBeenCalledWith(expect.objectContaining({ status: "DECLINED", attendeeCount: null }));
  });
});
