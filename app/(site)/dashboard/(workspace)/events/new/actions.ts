"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CreateEventRaw } from "@/lib/events/create-event-input";
import { isPaidPlanId } from "@/lib/billing/plans";
import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/auth/current-user";
import { createEventForUser, type CreateEventResult } from "@/server/services/event-creation";

/**
 * SERVER ACTION del alta de eventos. Fina: 1) sesión  2) usuario de la BD  3) valida y crea (servicio,
 * transaccional)  4) redirige al editor del evento REAL. El propietario sale de la sesión: ningún campo del
 * cliente (`ownerId`, `status`, `slug`…) llega al servicio, que solo lee una lista blanca.
 * En éxito no devuelve nada (redirige); en error, un resultado seguro sin detalles de la base de datos.
 */
export async function createEventAction(raw: CreateEventRaw, planIntent?: unknown): Promise<Extract<CreateEventResult, { ok: false }>> {
  const user = await requireAuth();
  const input: CreateEventRaw = raw && typeof raw === "object" ? { templateSlug: raw.templateSlug, eventType: raw.eventType, name1: raw.name1, name2: raw.name2, date: raw.date, time: raw.time, timezone: raw.timezone } : {};

  const result = await createEventForUser(user, input);
  if (result.ok) {
    revalidatePath(routes.events);
    // Intención de plan (`/pricing` → `?plan=`): el evento nace Gratis y se abre su panel «Mejorar evento» (nunca se cobra antes de tener evento).
    const plan = typeof planIntent === "string" && isPaidPlanId(planIntent.toUpperCase()) ? planIntent : undefined;
    redirect(plan ? routes.eventUpgrade(result.eventId, plan) : routes.eventEdit(result.eventId));
  }
  return result;
}
