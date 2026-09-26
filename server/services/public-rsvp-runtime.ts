import { StoreUnavailableError } from "@/server/db/errors";
import { getClientAddress } from "@/server/security/client-identity";
import { isRateLimited, RATE_LIMIT_RULES } from "@/server/security/rate-limit";
import { resolveRsvpTarget, savePublicRsvp } from "@/server/repositories/public-invitations";
import { submitPublicRsvpFor, type PublicRsvpDeps, type RsvpRawInput } from "@/server/services/public-rsvp";
import { getServerNow } from "@/lib/invitation/server-time";
import type { PublicRsvpResult } from "@/types/public-rsvp";

/** Dependencias reales del caso de uso (repositorios + hora del servidor). Las pruebas usan otras. */
export const defaultPublicRsvpDeps: PublicRsvpDeps = {
  resolveTarget: resolveRsvpTarget,
  // Por dirección de cliente y por invitado; el token solo entra al limitador como hash.
  isRateLimited: async ({ token }) =>
    isRateLimited([
      { rule: RATE_LIMIT_RULES.rsvpByClient, identity: await getClientAddress() },
      { rule: RATE_LIMIT_RULES.rsvpByGuest, identity: token },
    ]),
  save: savePublicRsvp,
  now: getServerNow,
  isUnavailable: (error) => error instanceof StoreUnavailableError,
};

export const submitPublicRsvpDefault = (input: { slug: string; token: string; raw: RsvpRawInput }): Promise<PublicRsvpResult> => submitPublicRsvpFor(input, defaultPublicRsvpDeps);
