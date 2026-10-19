"use client";

import { useActionState } from "react";
import { startPrintAddonCheckoutAction } from "@/app/(site)/dashboard/(workspace)/events/[id]/print/actions";
import { Button } from "@/components/ui/button";

/**
 * Botón de compra del complemento (isla cliente). Envía SOLO el id del evento a la Server Action; el servidor resuelve todo lo demás.
 * Doble clic: el botón queda «cargando» hasta salir hacia el pago (y el servidor, además, reutiliza la misma sesión). Errores con `aria-live`.
 */
export function AddonCheckoutForm({ eventId, label }: { eventId: string; label: string }) {
  const [state, formAction, pending] = useActionState(startPrintAddonCheckoutAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <Button type="submit" size="lg" loading={pending} fullWidth>
        {label}
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-lu-sm text-lu-error">
        {state.error?.message}
      </p>
    </form>
  );
}
