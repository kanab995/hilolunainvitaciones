import { Check, Minus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";
import { planRows, templatesAllowedFor } from "@/lib/billing/plan-summary";
import { formatPlanPrice, getPlanConfig, isPaidPlanId, PLAN_IDS, type PlanId } from "@/lib/billing/plans";
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
 * Tarjetas de planes (`/pricing`, D-32: un pago único por evento). Editorial y sobrio, con los mismos tokens del producto. Las filas y
 * los precios salen de la configuración de planes (una sola fuente: nada de «499» o «799» escrito aquí) y el precio se muestra
 * siempre con «Pago único por evento».
 */
export function PricingPlans({ signedIn, templates }: { signedIn: boolean; templates: readonly { minimumPlan: PlanId }[] }) {
  const copy = billingCopy.pricing;

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        {PLAN_IDS.map((id) => {
          const plan = getPlanConfig(id);
          const rows = planRows(id, templatesAllowedFor(id, templates));
          return (
            <li key={id} className="flex">
              <article aria-labelledby={`plan-${id}`} data-plan={id} className="flex w-full flex-col gap-6 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-6 shadow-lu-card md:p-7">
                <header className="flex flex-col gap-3">
                  <Heading as="h2" id={`plan-${id}`} size="title-lg">
                    {plan.name}
                  </Heading>
                  <Text size="base">{plan.description}</Text>
                  <div className="flex min-h-14 flex-col justify-end gap-0.5">
                    <p data-plan-price className="font-lu-display text-lu-title-xl text-lu-text">
                      {formatPlanPrice(id)}
                    </p>
                    <Text size="sm" tone="muted">
                      {id === "FREE" ? copy.freeNote : copy.oneTime}
                    </Text>
                  </div>
                </header>

                <ul aria-label={`Incluye ${plan.name}`} className="flex flex-1 flex-col gap-3">
                  {rows.map((row) => (
                    <li key={row.id} className={cn("flex items-start gap-3 text-lu-base", row.included ? "text-lu-text-secondary" : "text-lu-text-subtle")}>
                      {row.included ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-lu-success" strokeWidth={2} /> : <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />}
                      <span>
                        {row.included ? null : <span className="sr-only">No incluido: </span>}
                        {row.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <PlanCta plan={id} signedIn={signedIn} />
              </article>
            </li>
          );
        })}
      </ul>

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
