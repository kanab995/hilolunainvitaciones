"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { billingCopy } from "@/lib/billing/copy";

/** Cuántas veces se vuelve a leer el plan tras el pago, y cada cuánto (el webhook suele llegar en segundos). */
const MAX_REFRESHES = 6;
const REFRESH_EVERY_MS = 4000;

export type PaymentBannerState = "confirming" | "confirmed" | "canceled";

/**
 * Regreso del pago (`?payment=success|canceled` en el dashboard del evento). NO activa nada: solo informa y vuelve a leer el plan
 * desde el servidor, porque quien concede el plan es el webhook verificado. `confirming` = el pago aún no está confirmado: «Estamos
 * confirmando tu pago…», se refresca unas cuantas veces y se ofrece «Actualizar» a mano. Cuando el servidor ya no tiene un pago
 * pendiente pasa a `confirmed`. `canceled` = el pago se canceló: sin cargo y sin cambios.
 */
export function PaymentStatus({ state }: { state: PaymentBannerState }) {
  const router = useRouter();
  const refreshes = useRef(0);

  useEffect(() => {
    if (state !== "confirming") return;
    const timer = setInterval(() => {
      if (refreshes.current >= MAX_REFRESHES) return clearInterval(timer);
      refreshes.current += 1;
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [state, router]);

  const copy = billingCopy.upgradePanel;
  return (
    <div role="status" aria-live="polite" data-payment-status={state} className="flex flex-col gap-3 rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint p-4 md:flex-row md:items-center md:justify-between md:p-5">
      <div className="flex flex-col gap-1">
        <p className="font-medium text-lu-base text-lu-text">{state === "confirming" ? copy.confirming : state === "confirmed" ? copy.confirmed : copy.canceled}</p>
        {state === "confirming" ? <p className="text-lu-sm text-lu-text-secondary">{copy.confirmingHint}</p> : null}
      </div>
      {state === "confirming" ? (
        <Button type="button" variant="secondary" onClick={() => router.refresh()} className="max-sm:w-full">
          {copy.refresh}
        </Button>
      ) : null}
    </div>
  );
}
