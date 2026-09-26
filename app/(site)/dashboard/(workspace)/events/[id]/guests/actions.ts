"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/lib/routes";
import { createGuestFor, deleteGuestFor, updateGuestFor, type GuestServiceResult } from "@/server/services/guest-service";
import { readGuestFormData } from "@/server/services/guest-input";
import type { GuestActionResult } from "@/types/guests";

/**
 * SERVER ACTIONS del Guest Manager. Son finas: leen SOLO los campos permitidos del formulario, delegan
 * en el servicio (sesión → usuario → propiedad del evento → validación → escritura) y revalidan las
 * páginas afectadas. NUNCA aceptan un propietario del cliente: `eventId` es solo una referencia que el
 * servidor comprueba contra el usuario de la sesión.
 */
const text = (formData: FormData, key: string) => (typeof formData.get(key) === "string" ? (formData.get(key) as string) : "");

function finish({ result, eventId }: GuestServiceResult): GuestActionResult {
  if (result.ok && eventId) {
    revalidatePath(routes.eventGuests(eventId));
    revalidatePath(routes.event(eventId)); // el dashboard deriva sus métricas de los mismos invitados
  }
  return result;
}

export async function createGuest(_previous: GuestActionResult | null, formData: FormData): Promise<GuestActionResult> {
  return finish(await createGuestFor(text(formData, "eventId"), readGuestFormData(formData)));
}

export async function updateGuest(_previous: GuestActionResult | null, formData: FormData): Promise<GuestActionResult> {
  return finish(await updateGuestFor(text(formData, "eventId"), text(formData, "guestId"), readGuestFormData(formData)));
}

export async function deleteGuest(_previous: GuestActionResult | null, formData: FormData): Promise<GuestActionResult> {
  return finish(await deleteGuestFor(text(formData, "eventId"), text(formData, "guestId")));
}
