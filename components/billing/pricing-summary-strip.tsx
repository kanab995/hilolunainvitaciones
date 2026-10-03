import { Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";
import { formatPlanPrice, getPlanConfig, PLAN_IDS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Franja de comparación RÁPIDA (`/pricing`): precio, invitados, imágenes e "ideal para" de un
 * vistazo, entre las tarjetas de planes y la tabla detallada. Más ligera que las tarjetas (sin
 * borde grueso ni botones) y más visual que la tabla — el puente entre "vender" y "comparar".
 * Los números salen de `planConfigs` (una sola fuente), igual que el resto de `/pricing`.
 */
export function PricingSummaryStrip() {
  const idealForShort = billingCopy.pricing.idealForShort;

  return (
    <section aria-label="Resumen de planes" className="mx-auto grid w-full max-w-3xl grid-cols-1 divide-y divide-lu-border-subtle rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {PLAN_IDS.map((id) => {
        const plan = getPlanConfig(id);
        const featured = id === "ESSENTIAL";
        return (
          <div key={id} className={cn("flex flex-col items-center gap-1.5 px-5 py-5 text-center", featured && "bg-lu-surface")}>
            <Text size="sm" tone="muted" className="font-medium uppercase tracking-wide text-lu-xs">
              {plan.name}
            </Text>
            <p className="font-lu-display text-lu-title-md text-lu-text">{formatPlanPrice(id)}</p>
            <Text size="sm" tone="secondary">
              {plan.limits.maxGuestsPerEvent === null ? "Invitados sin límite" : `${plan.limits.maxGuestsPerEvent} invitados`}
            </Text>
            <Text size="sm" tone="secondary">
              {plan.limits.maxGalleryImages === null ? "Galería sin límite" : `${plan.limits.maxGalleryImages} imágenes`}
            </Text>
            <Text size="sm" tone="muted" className="mt-1">
              {idealForShort[id]}
            </Text>
          </div>
        );
      })}
    </section>
  );
}
