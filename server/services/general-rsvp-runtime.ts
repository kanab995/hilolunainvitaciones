import { EntitlementError } from "@/lib/billing/entitlements";
import { StoreUnavailableError } from "@/server/db/errors";
import { sendRsvpNotification } from "@/server/email/service";
import { runAfterResponse } from "@/server/email/run-after";
import { countPublicRsvpResponses } from "@/server/repositories/usage";
import { resolveGeneralRsvpTarget, saveGeneralRsvp } from "@/server/repositories/public-invitations";
import { getClientAddress } from "@/server/security/client-identity";
import { isRateLimited, RATE_LIMIT_RULES } from "@/server/security/rate-limit";
import { assertEventEntitlement } from "@/server/services/entitlement-service";
import { submitGeneralRsvpFor, type GeneralRsvpDeps, type GeneralRsvpRawInput } from "@/server/services/general-rsvp";
import { getServerNow } from "@/lib/invitation/server-time";
import type { GeneralRsvpResult } from "@/types/public-rsvp";

/** Dependencias reales del caso de uso (repositorios + hora del servidor). Las pruebas usan otras. */
export const defaultGeneralRsvpDeps: GeneralRsvpDeps = {
  resolveTarget: resolveGeneralRsvpTarget,
  isRateLimited: async () => isRateLimited([{ rule: RATE_LIMIT_RULES.generalRsvpByClient, identity: await getClientAddress() }]),
  checkLimit: async (eventId) => {
    try {
      await assertEventEntitlement(eventId, { limit: "maxPublicRsvpResponses", current: await countPublicRsvpResponses(eventId) });
      return "ok";
    } catch (error) {
      if (error instanceof EntitlementError && error.code === "limit_reached") return "limit_reached";
      throw error;
    }
  },
  save: saveGeneralRsvp,
  now: getServerNow,
  isUnavailable: (error) => error instanceof StoreUnavailableError,
  // Mismo contrato que el RSVP personalizado (D-36): nunca bloquea ni deshace el guardado.
  onSaved: ({ target, value, guestId }) => {
    runAfterResponse(() => sendRsvpNotification({ eventId: target.eventId, guestId, status: value.status, attendeeCount: value.status === "ATTENDING" ? value.attendeeCount : null }));
  },
};

export const submitGeneralRsvpDefault = (input: { slug: string; raw: GeneralRsvpRawInput }): Promise<GeneralRsvpResult> => submitGeneralRsvpFor(input, defaultGeneralRsvpDeps);
