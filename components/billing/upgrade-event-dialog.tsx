"use client";

import { Sparkles } from "lucide-react";
import { EventCheckoutForm } from "@/components/billing/billing-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { billingCopy } from "@/lib/billing/copy";
import { formatPrice, getPlanConfig, PLAN_IDS, planLabel, PRICING_CURRENCY, type PlanId } from "@/lib/billing/plans";
import type { EventPlanOption } from "@/server/services/billing-service";

/**
 * PANEL «MEJORAR EVENTO» (D-32): compra el plan de UN evento desde su dashboard. Muestra Gratis, Esencial y Premium con su precio de
 * pago único (todo sale de `lib/billing/plans.ts`); en Esencial → Premium solo se paga la diferencia. Cada botón es un formulario que
 * envía únicamente el id del evento y el plan: el servidor comprueba la propiedad y decide el precio. Sin pagos configurados los
 * botones se deshabilitan con una nota. El botón «Mejorar evento» no se muestra si el evento ya tiene el plan más completo.
 */
export interface UpgradeEventDialogProps {
  eventId: string;
  title: string;
  plan: PlanId;
  options: readonly EventPlanOption[];
  paymentsReady: boolean;
  defaultOpen?: boolean;
  /** Plan que se quiere destacar (intención de plan al crear el evento). */
  highlight?: string;
}

const copy = billingCopy.upgradePanel;

export function UpgradeEventDialog({ eventId, title, plan, options, paymentsReady, defaultOpen = false, highlight }: UpgradeEventDialogProps) {
  if (!options.some((option) => option.state === "available")) return null;

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="secondary" className="max-sm:px-3" data-upgrade-trigger>
          <Sparkles aria-hidden="true" />
          {billingCopy.upgrade.action}
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description(title)}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-3">
          {PLAN_IDS.map((id) => {
            const config = getPlanConfig(id);
            const option = options.find((candidate) => candidate.plan === id);
            const isCurrent = id === plan;
            return (
              <li key={id} data-plan-option={id} className={`flex flex-col gap-3 rounded-lu-card border p-4 md:flex-row md:items-center md:justify-between ${highlight?.toUpperCase() === id ? "border-lu-brown-600" : "border-lu-border-subtle"}`}>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-lu-display text-lu-title-md text-lu-text">{planLabel(id)}</p>
                    {isCurrent ? <Badge tone="ink">{copy.current}</Badge> : null}
                  </div>
                  <p className="text-lu-sm text-lu-text-secondary">
                    {formatPrice(config.pricing.displayPrice, PRICING_CURRENCY)} · {billingCopy.pricing.oneTime.toLowerCase()}
                  </p>
                  <p className="text-lu-sm text-lu-text-muted">
                    Hasta {config.limits.maxGuestsPerEvent} invitados · {config.limits.maxGalleryImages} imágenes en la galería
                  </p>
                </div>
                {option?.state === "available" && option.amount !== null && option.kind ? (
                  <div className="flex min-w-0 flex-col gap-1 md:w-64 md:shrink-0">
                    {paymentsReady ? (
                      <EventCheckoutForm eventId={eventId} plan={option.plan} label={option.kind === "UPGRADE" ? copy.upgradeFor(formatPrice(option.amount)) : copy.pay(formatPrice(option.amount))} variant={highlight?.toUpperCase() === id ? "primary" : "secondary"} />
                    ) : (
                      <Button size="lg" disabled aria-describedby={`payments-note-${eventId}`} className="w-full">
                        {option.kind === "UPGRADE" ? copy.upgradeFor(formatPrice(option.amount)) : copy.pay(formatPrice(option.amount))}
                      </Button>
                    )}
                    {option.kind === "UPGRADE" ? <p className="text-lu-xs text-lu-text-muted">{copy.upgradeNote}</p> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {!paymentsReady ? (
          <p id={`payments-note-${eventId}`} role="note" className="text-lu-sm text-lu-text-muted">
            {copy.notConfigured}
          </p>
        ) : null}
        <p className="text-lu-sm text-lu-text-muted">{billingCopy.pricing.access}</p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
