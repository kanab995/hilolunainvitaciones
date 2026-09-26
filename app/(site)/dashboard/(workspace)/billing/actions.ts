"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/current-user";
import { startEventCheckout, type BillingActionCode } from "@/server/services/billing-service";

/**
 * SERVER ACTION de pago (D-32: un pago único por evento). Fina: 1) sesión  2) usuario de la BD  3) servicio  4) redirigir al
 * proveedor. El cliente solo envía `eventId` y `plan` (ESSENTIAL | PREMIUM); nunca precios, clientes ni ids de usuario: el usuario
 * sale de la sesión, el evento se comprueba como PROPIO en el servidor y todo lo demás lo resuelve el servidor. En éxito redirige
 * (fuera del sitio, al pago); en error devuelve un estado con mensaje seguro para mostrar con `aria-live`.
 */
export interface BillingFormState {
  error?: { code: BillingActionCode; message: string };
}

export async function startEventCheckoutAction(_previous: BillingFormState, formData: FormData): Promise<BillingFormState> {
  const user = await requireAuth();
  const result = await startEventCheckout(user, formData.get("eventId"), formData.get("plan"));
  if (result.ok) redirect(result.url);
  return { error: { code: result.code, message: result.message } };
}
