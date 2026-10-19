"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/current-user";
import { startPrintAddonCheckout, type AddonCheckoutCode } from "@/server/services/addon-service";

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
