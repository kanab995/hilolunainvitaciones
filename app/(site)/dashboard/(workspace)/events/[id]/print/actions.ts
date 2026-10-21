"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/current-user";
import { startPrintAddonCheckout, type AddonCheckoutCode } from "@/server/services/addon-service";
import { savePrintQrTarget } from "@/server/services/print-service";

/**
 * SERVER ACTION de la compra del complemento «Archivo listo para imprimir» (D-48). Fina, igual que la de los planes: 1) sesión 2) usuario de
 * la BD 3) servicio 4) redirigir al pago. El navegador solo envía el id del evento: el servicio comprueba que es del usuario, que su plan es
 * Esencial o Premium, que no lo compró ya y resuelve precio y sesión en el servidor. En error devuelve un mensaje seguro (`aria-live`).
 */
export interface AddonCheckoutFormState {
  error?: { code: AddonCheckoutCode; message: string };
}

export async function startPrintAddonCheckoutAction(_previous: AddonCheckoutFormState, formData: FormData): Promise<AddonCheckoutFormState> {
  const user = await requireAuth();
  const result = await startPrintAddonCheckout(user, formData.get("eventId"));
  if (result.ok) redirect(result.url);
  return { error: { code: result.code, message: result.message } };
}

/**
 * Guarda el destino del QR (D-49). El navegador solo envía el id del evento y el destino; el servicio comprueba sesión, propiedad y que ese
 * destino exista en la invitación PUBLICADA del evento. No toca la compra, el precio ni la invitación.
 */
export async function savePrintQrTargetAction(eventId: string, target: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireAuth();
  const result = await savePrintQrTarget(user, eventId, target);
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}
