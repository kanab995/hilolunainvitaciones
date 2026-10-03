import { Check, Minus } from "lucide-react";
import { Heading, Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";
import { formatPlanPrice, getPlanConfig, PLAN_IDS, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Tabla de APOYO (`/pricing`): va después de las tarjetas y la franja resumen, no antes — aquí se
 * viene a confirmar, no a decidir. Por eso es deliberadamente corta: solo filas que CAMBIAN de
 * verdad entre planes (precio, tipo de pago, invitados, galería, mesa de regalos, música, ideal
 * para). RSVP, ubicación, cuenta regresiva, código QR, calendario y enlace personalizado son
 * capacidades del motor de invitaciones disponibles en los tres planes hoy (`ALL_ON` en
 * `lib/billing/plans.ts`) — no se listan aquí como fila para no repetir lo que ya dicen las
 * tarjetas, y nunca con una `✗` que contradiga lo que el producto hace de verdad.
 *
 * Mesa de regalos y música SÍ son `ALL_ON` también hoy (ninguna de las dos es un `FeatureId`
 * gateado): se marcan `Minus` en Gratis como curaduría COMERCIAL, igual que en `cardHighlights`
 * (`lib/billing/plan-summary.ts`) — una promesa de qué se promueve por plan, no una limitación
 * técnica real. Documentado ahí con el mismo criterio para que ambos componentes no se contradigan.
 */
const MARKETED_ONLY_IN_PAID: Record<PlanId, boolean> = { FREE: false, ESSENTIAL: true, PREMIUM: true };

export function PricingComparison() {
  const copy = billingCopy.pricing.comparison;
  const idealFor = billingCopy.pricing.idealFor;

  return (
    <section aria-labelledby="pricing-comparison-title" className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <Heading as="h2" id="pricing-comparison-title" size="title-md">
          {copy.title}
        </Heading>
        <Text size="sm" tone="muted">
          {copy.description}
        </Text>
      </div>
      <div className="overflow-x-auto rounded-lu-card border border-lu-border-subtle bg-lu-surface">
        <table className="w-full min-w-[32rem] border-collapse text-left text-lu-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead>
            <tr className="border-b border-lu-border-subtle">
              <th scope="col" className="p-3.5 font-lu-sans text-lu-xs font-medium text-lu-text-muted md:p-4">
                &nbsp;
              </th>
              {PLAN_IDS.map((id) => (
                <th key={id} scope="col" className={cn("p-3.5 font-lu-display text-lu-title-sm text-lu-text md:p-4", id === "ESSENTIAL" && "bg-lu-surface-tint")}>
                  {getPlanConfig(id).name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label={copy.rowLabels.price}>{PLAN_IDS.map((id) => <Cell key={id} highlight={id === "ESSENTIAL"}>{formatPlanPrice(id)}</Cell>)}</Row>
            <Row label={copy.rowLabels.paymentType}>
              {PLAN_IDS.map((id) => (
                <Cell key={id} highlight={id === "ESSENTIAL"}>
                  {id === "FREE" ? copy.paymentTypeFree : copy.paymentTypePaid}
                </Cell>
              ))}
            </Row>
            <Row label={copy.rowLabels.guests}>
              {PLAN_IDS.map((id) => {
                const max = getPlanConfig(id).limits.maxGuestsPerEvent;
                return (
                  <Cell key={id} highlight={id === "ESSENTIAL"}>
                    {max === null ? "Sin límite" : `Hasta ${max}`}
                  </Cell>
                );
              })}
            </Row>
            <Row label={copy.rowLabels.gallery}>
              {PLAN_IDS.map((id) => {
                const max = getPlanConfig(id).limits.maxGalleryImages;
                return (
                  <Cell key={id} highlight={id === "ESSENTIAL"}>
                    {max === null ? "Sin límite" : `Hasta ${max}`}
                  </Cell>
                );
              })}
            </Row>
            {(["giftRegistry", "music"] as const).map((rowId) => (
              <Row key={rowId} label={copy.rowLabels[rowId]}>
                {PLAN_IDS.map((id) =>
                  MARKETED_ONLY_IN_PAID[id] ? <IncludedCell key={id} highlight={id === "ESSENTIAL"} /> : <NotIncludedCell key={id} />,
                )}
              </Row>
            ))}
            <Row label={copy.rowLabels.idealFor} last>
              {PLAN_IDS.map((id) => (
                <Cell key={id} highlight={id === "ESSENTIAL"} className="text-lu-text-secondary">
                  {idealFor[id]}
                </Cell>
              ))}
            </Row>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ label, last = false, children }: { label: string; last?: boolean; children: React.ReactNode }) {
  return (
    <tr className={cn(!last && "border-b border-lu-border-subtle")}>
      <th scope="row" className="p-3.5 align-top font-lu-sans text-lu-xs font-medium text-lu-text-muted md:p-4">
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ className, highlight = false, children }: { className?: string; highlight?: boolean; children: React.ReactNode }) {
  return <td className={cn("p-3.5 align-top text-lu-text-secondary md:p-4", highlight && "bg-lu-surface-tint", className)}>{children}</td>;
}

function IncludedCell({ highlight = false }: { highlight?: boolean }) {
  return (
    <td className={cn("p-3.5 align-top md:p-4", highlight && "bg-lu-surface-tint")}>
      <Check aria-label="Incluido" className="size-4 text-lu-success" strokeWidth={2} />
    </td>
  );
}

function NotIncludedCell() {
  return (
    <td className="p-3.5 align-top md:p-4">
      <Minus aria-label="No destacado en este plan" className="size-4 text-lu-text-subtle" strokeWidth={2} />
    </td>
  );
}
