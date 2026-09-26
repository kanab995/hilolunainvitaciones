import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { billingCopy } from "@/lib/billing/copy";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * AVISO DE MEJORA DE PLAN (D-32): se muestra cuando una acción supera el plan DE UN EVENTO (invitados, galería o una plantilla de
 * otro plan). Tono sereno, nunca agresivo: explica lo ocurrido, tranquiliza («tus cosas se conservan») y ofrece «Mejorar evento»
 * (con `eventId`, abre el panel de mejora de ese evento) o «Ver planes» (sin evento, p. ej. al crear uno). Es solo interfaz: el
 * bloqueo real lo aplica el servidor. Sin estado, sirve en Server y Client Components.
 */
export function UpgradePrompt({ message, eventId, className }: { message: string; eventId?: string; className?: string }) {
  return (
    <div role="alert" data-upgrade-prompt className={cn("flex flex-col gap-3 rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint p-4 md:p-5", className)}>
      <div className="flex items-start gap-3">
        <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-lu-brown-600" strokeWidth={1.5} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-medium text-lu-base text-lu-text">{billingCopy.upgrade.title}</p>
          <p className="text-lu-sm text-lu-text-secondary">{message}</p>
          <p className="text-lu-sm text-lu-text-muted">{billingCopy.upgrade.hint}</p>
        </div>
      </div>
      <Button asChild variant="secondary" className="self-start max-sm:w-full">
        <Link href={eventId ? routes.eventUpgrade(eventId) : routes.pricing}>{eventId ? billingCopy.upgrade.action : billingCopy.upgrade.actionPlans}</Link>
      </Button>
    </div>
  );
}
