"use client";

import { useActionState } from "react";
import { startEventCheckoutAction } from "@/app/(site)/dashboard/(workspace)/billing/actions";
import { Button } from "@/components/ui/button";
import type { PaidPlanId } from "@/lib/billing/plans";

/**
 * Formulario de pago de UN evento (isla cliente). Envía SOLO el id del evento y el plan (`ESSENTIAL` | `PREMIUM`) a una Server
 * Action, que comprueba que el evento es del usuario y resuelve el precio y la sesión de pago en el servidor: el navegador nunca
 * aporta precios ni ids de cliente. Doble clic: el botón queda en «cargando» hasta que el navegador sale hacia el proveedor. Los
 * errores se anuncian con `aria-live`.
 */
export function EventCheckoutForm({ eventId, plan, label, variant = "primary", size = "lg", className }: { eventId: string; plan: PaidPlanId; label: string; variant?: "primary" | "secondary"; size?: "md" | "lg"; className?: string }) {
  const [state, formAction, pending] = useActionState(startEventCheckoutAction, {});
  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="plan" value={plan} />
      <Button type="submit" variant={variant} size={size} loading={pending} className="w-full">
        {label}
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-lu-sm text-lu-error">
        {state.error?.message}
      </p>
    </form>
  );
}
