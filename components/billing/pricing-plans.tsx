import { Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";
import { cardHighlights } from "@/lib/billing/plan-summary";
import { formatPlanPrice, formatPrice, getPlanConfig, isPaidPlanId, PLAN_IDS, type PlanId } from "@/lib/billing/plans";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * CTA de un plan (D-32). Toda compra pertenece a un EVENTO: `/pricing` nunca cobra. Sin sesión: registrarse y volver a crear el
 * evento con la intención de plan (`/dashboard/events/new?plan=…`). Con sesión: ir directo a crear el evento. Tras crearlo se abre el
 * panel «Mejorar evento» de ese evento, donde está el pago.
 */
function PlanCta({ plan, signedIn }: { plan: PlanId; signedIn: boolean }) {
  const copy = billingCopy.pricing;
  const destination = isPaidPlanId(plan) ? routes.newEventWithPlan(plan) : routes.newEvent;
  const href = signedIn ? destination : `${routes.signUp}?redirect_url=${encodeURIComponent(destination)}`;
  const label = signedIn ? (plan === "FREE" ? copy.goToEvents : copy.cta[plan]) : copy.cta[plan];
  return (
    <Button asChild variant={plan === "FREE" ? "secondary" : "primary"} size="lg" className="w-full">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

/**
 * Tarjetas de planes (`/pricing`, D-32: un pago único por evento). Editorial y sobrio, con los mismos tokens del producto. Los
 * precios y cuotas salen de la configuración de planes (una sola fuente: nada de «499» o «799» escrito aquí); los perks
 * destacados por tarjeta salen de `cardHighlights` (`lib/billing/plan-summary.ts`) — ahí está documentada la diferencia entre
 * "qué se promueve por plan" (esta tarjeta) y "qué existe técnicamente" (`planConfigs`, sin cambios).
 *
 * Esencial lleva el borde/realce y la insignia «Más elegido» (el plan que se quiere vender más); Gratis queda visualmente más
 * sobrio y con una lista de perks más corta a propósito (se siente "de prueba" sin afirmar que le falte algo que sí tiene).
 */
export function PricingPlans({ signedIn }: { signedIn: boolean }) {
  const copy = billingCopy.pricing;

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
        {PLAN_IDS.map((id) => {
          const plan = getPlanConfig(id);
          const featured = id === "ESSENTIAL";
          return (
            <li key={id} className={cn("flex", featured && "lg:-mt-3 lg:mb-3")}>
              <article
                aria-labelledby={`plan-${id}`}
                data-plan={id}
                className={cn(
                  "flex w-full flex-col gap-6 rounded-lu-card border bg-lu-surface p-6 md:p-7",
                  featured ? "border-lu-brown-400 shadow-lu-float ring-1 ring-lu-brown-400/25" : "border-lu-border-subtle shadow-lu-card",
                )}
              >
                <header className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Heading as="h2" id={`plan-${id}`} size="title-lg">
                      {plan.name}
                    </Heading>
                    {featured ? <Badge tone="accent">{copy.recommendedBadge}</Badge> : null}
                  </div>
                  <Text size="base">{plan.description}</Text>
                  <div className="flex min-h-14 flex-col justify-end gap-0.5">
                    <p data-plan-price className="font-lu-display text-lu-title-xl text-lu-text">
                      {formatPlanPrice(id)}
                    </p>
                    <Text size="sm" tone="muted">
                      {id === "FREE" ? copy.freeNote : copy.oneTime}
                    </Text>
                  </div>
                  <Text size="sm" tone="muted">
                    <span className="font-medium text-lu-text-secondary">{copy.comparison.rowLabels.idealFor}: </span>
                    {copy.idealFor[id]}
                  </Text>
                </header>

                <ul aria-label={`Incluye ${plan.name}`} className="flex flex-1 flex-col gap-3">
                  {cardHighlights(id).map((row) => (
                    <li key={row.id} className="flex items-start gap-3 text-lu-base text-lu-text-secondary">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-lu-success" strokeWidth={2} />
                      <span>{row.label}</span>
                    </li>
                  ))}
                </ul>

                <PlanCta plan={id} signedIn={signedIn} />
              </article>
            </li>
          );
        })}
      </ul>

      <Text size="sm" tone="muted" className="mx-auto max-w-2xl text-center">
        {copy.upgradeNote(formatPrice(getPlanConfig("PREMIUM").pricing.displayPrice - getPlanConfig("ESSENTIAL").pricing.displayPrice))}
      </Text>

      <section aria-labelledby="pricing-upcoming" className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
        <Text size="sm" tone="muted">
          {copy.access}
        </Text>
        <Text size="sm" tone="muted">
          {copy.footnote}
        </Text>
        <Heading as="h2" id="pricing-upcoming" size="title-sm" className="mt-2">
          {copy.upcomingTitle}
        </Heading>
        <Text size="sm" tone="muted">
          {copy.upcoming}
        </Text>
      </section>
    </div>
  );
}
