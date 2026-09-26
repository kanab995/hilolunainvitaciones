import { resolveOwnedEvent, type OwnedEventResolution } from "@/server/auth/ownership";
import { createOwnedGuest, deleteOwnedGuest, GuestStoreUnavailableError, updateOwnedGuest, type GuestWriteResult } from "@/server/repositories/guests";
import { validateGuestInput, type GuestInput } from "@/server/services/guest-input";
import { checkGuestLimit, type LimitDecision } from "@/server/services/plan-limits";
import type { GuestActionResult } from "@/types/guests";
import { logger } from "@/server/observability/logger";

/**
 * CASOS DE USO del Guest Manager (los llaman las Server Actions). Orden fijo y obligatorio:
 *   1. sesión  2. usuario de la BD  3. el evento es DEL usuario  4. validar  5. escribir  6. resultado seguro.
 * Nunca se acepta `ownerId`/`userId` del cliente: el propietario sale de la sesión (paso 2). El `eventId`
 * del cliente es solo una referencia que el paso 3 comprueba. Los errores de la BD no llegan al usuario.
 * Las dependencias son inyectables para probar el flujo sin base de datos.
 */
export interface GuestServiceDeps {
  resolveOwnedEvent: (ref: string) => Promise<OwnedEventResolution>;
  create: (userId: string, eventId: string, input: GuestInput) => Promise<GuestWriteResult>;
  update: (userId: string, eventId: string, guestId: string, input: GuestInput) => Promise<GuestWriteResult>;
  remove: (userId: string, eventId: string, guestId: string) => Promise<boolean>;
  /** Cupo de invitados del plan DE ESTE EVENTO (D-32). Solo aplica al ALTA: editar y eliminar nunca se bloquean. */
  checkGuestLimit: (userId: string, eventId: string) => Promise<LimitDecision>;
}

const defaultDeps: GuestServiceDeps = { resolveOwnedEvent, create: createOwnedGuest, update: updateOwnedGuest, remove: deleteOwnedGuest, checkGuestLimit };

export interface GuestServiceResult {
  result: GuestActionResult;
  /** Id canónico del evento (para revalidar sus páginas). Solo si la operación llegó a resolverlo. */
  eventId?: string;
}

const GUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

const denied: GuestActionResult = { ok: false, code: "not_found", message: "No encontramos este evento o al invitado." };
const unauthenticated: GuestActionResult = { ok: false, code: "unauthenticated", message: "Tu sesión terminó. Inicia sesión de nuevo para continuar." };
const failure: GuestActionResult = { ok: false, code: "error", message: "No pudimos completar la acción. Inténtalo de nuevo en unos instantes." };
const unavailable: GuestActionResult = { ok: false, code: "unavailable", message: "Guardar invitados no está disponible en este entorno (falta la base de datos)." };

/** Ejecuta `run` con el evento ya verificado; traduce cualquier fallo a un resultado seguro. */
async function withOwnedEvent(
  eventRef: string,
  deps: GuestServiceDeps,
  run: (ctx: { userId: string; eventId: string }) => Promise<GuestActionResult>,
): Promise<GuestServiceResult> {
  try {
    const resolution = await deps.resolveOwnedEvent(eventRef);
    if (resolution.status === "unauthenticated") return { result: unauthenticated };
    if (resolution.status === "not_found") return { result: denied };
    return { result: await run({ userId: resolution.user.id, eventId: resolution.event.id }), eventId: resolution.event.id };
  } catch (error) {
    if (error instanceof GuestStoreUnavailableError) return { result: unavailable };
    // Solo el tipo de error en el log del servidor: sin datos de invitados ni trazas para el usuario.
    logger.error("guests.failure", error);
    return { result: failure };
  }
}

function invalid(errors: Extract<ReturnType<typeof validateGuestInput>, { ok: false }>["errors"]): GuestActionResult {
  return { ok: false, code: "invalid", message: "Revisa los datos marcados.", fieldErrors: errors };
}

const fromWrite = (write: GuestWriteResult, message: string): GuestActionResult =>
  write.ok ? { ok: true, message } : write.code === "group_not_found" ? invalid({ groupId: "Elige un grupo válido." }) : denied;

export async function createGuestFor(eventRef: string, raw: Record<string, unknown>, deps: GuestServiceDeps = defaultDeps): Promise<GuestServiceResult> {
  return withOwnedEvent(eventRef, deps, async ({ userId, eventId }) => {
    const validation = validateGuestInput(raw);
    if (!validation.ok) return invalid(validation.errors);
    // Autoridad del plan (D-31): con el cupo lleno no se crea nada; lo ya existente se conserva y sigue editable.
    const limit = await deps.checkGuestLimit(userId, eventId);
    if (!limit.ok) return { ok: false, code: "limit_reached", message: limit.message };
    return fromWrite(await deps.create(userId, eventId, validation.value), "Invitado agregado.");
  });
}

export async function updateGuestFor(eventRef: string, guestId: string, raw: Record<string, unknown>, deps: GuestServiceDeps = defaultDeps): Promise<GuestServiceResult> {
  return withOwnedEvent(eventRef, deps, async ({ userId, eventId }) => {
    if (!GUEST_ID.test(guestId)) return denied;
    const validation = validateGuestInput(raw);
    if (!validation.ok) return invalid(validation.errors);
    return fromWrite(await deps.update(userId, eventId, guestId, validation.value), "Cambios guardados.");
  });
}

export async function deleteGuestFor(eventRef: string, guestId: string, deps: GuestServiceDeps = defaultDeps): Promise<GuestServiceResult> {
  return withOwnedEvent(eventRef, deps, async ({ userId, eventId }) => {
    if (!GUEST_ID.test(guestId)) return denied;
    return (await deps.remove(userId, eventId, guestId)) ? { ok: true, message: "Invitado eliminado." } : denied;
  });
}
