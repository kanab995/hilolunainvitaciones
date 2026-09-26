import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";
import { formatPrice, planLabel } from "@/lib/billing/plans";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { BillingEventRow, BillingOverview } from "@/server/services/billing-service";

const copy = billingCopy.billing;

/** Fecha para mostrar en la zona por defecto del producto (no depende de la del servidor). */
const formatBillingDate = (date: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" }).format(date);

/** Una fila de uso de UN evento: «Invitados · 24 / 30» con un indicador delgado (decorativo; el dato va en texto). */
function UsageRow({ label, current, max }: { label: string; current: number; max: number | null }) {
  const over = max !== null && current > max;
  const ratio = max === null || max === 0 ? 0 : Math.min(1, current / max);
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <dt className="text-lu-base text-lu-text">{label}</dt>
        <dd className="text-lu-base text-lu-text-secondary" data-usage-value>
          {copy.of(current, max)}
        </dd>
      </div>
      {max !== null ? (
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-lu-pill bg-lu-surface-tint">
          <div className={cn("h-full rounded-lu-pill", over ? "bg-lu-brown-900" : "bg-lu-brown-600")} style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function accessLine(event: BillingEventRow): string {
  if (event.plan === "FREE" || !event.paidAccessEndsAt) return copy.accessFree;
  return event.accessState === "expired" ? copy.accessExpired(formatBillingDate(event.paidAccessEndsAt)) : copy.access(formatBillingDate(event.paidAccessEndsAt));
}

/** Un evento con su plan, acceso, uso e historial de pagos. */
function EventBillingCard({ event }: { event: BillingEventRow }) {
  const over = (event.guests.max !== null && event.guests.count > event.guests.max) || (event.gallery.max !== null && event.gallery.count > event.gallery.max);
  return (
    <Card role="region" aria-labelledby={`billing-event-${event.eventId}`} data-billing-event={event.eventId} data-plan={event.plan} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading as="h2" id={`billing-event-${event.eventId}`} size="title-lg">
            <Link href={routes.event(event.eventId)} className="hover:underline">
              {event.title}
            </Link>
          </Heading>
          <Text size="sm" tone="muted">
            {accessLine(event)}
          </Text>
        </div>
        <Badge tone={event.plan === "FREE" ? "neutral" : "success"} size="md">
          {copy.plan} {planLabel(event.plan)}
          {event.plan !== "FREE" ? ` · ${copy.paid}` : ""}
        </Badge>
      </div>

      <dl className="divide-y divide-lu-border-subtle">
        <UsageRow label={copy.guests} current={event.guests.count} max={event.guests.max} />
        <UsageRow label={copy.gallery} current={event.gallery.count} max={event.gallery.max} />
      </dl>
      {over ? (
        <p role="note" data-over-limit className="text-lu-sm text-lu-text-secondary">
          {copy.overLimit}
        </p>
      ) : null}

      {event.purchases.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Text size="sm" tone="muted">
            {copy.purchasesTitle}
          </Text>
          <ul className="flex flex-col gap-1.5">
            {event.purchases.map((purchase) => (
              <li key={purchase.id} data-purchase-status={purchase.status} className="flex flex-wrap items-baseline justify-between gap-x-4 text-lu-sm text-lu-text-secondary">
                <span>
                  {copy.purchaseRow(planLabel(purchase.plan), formatPrice(purchase.amount / 100, purchase.currency))}
                  {purchase.kind === "UPGRADE" ? ` · ${copy.upgradeTag}` : ""}
                </span>
                <span className="text-lu-text-muted">
                  {billingCopy.purchaseStatus[purchase.status]}
                  {purchase.paidAt ? ` · ${formatBillingDate(purchase.paidAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {event.canUpgrade ? (
        <Button asChild size="lg" className="self-start max-sm:w-full">
          <Link href={routes.eventUpgrade(event.eventId)}>{copy.upgrade}</Link>
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * Compras y planes (`/dashboard/billing`, D-32): un bloque POR EVENTO (plan, «Disponible hasta…», uso, historial de pagos). No hay
 * plan de cuenta ni contador de eventos. Sin datos de pago: el recibo lo emite el proveedor. El estado nunca depende solo del color.
 */
export function BillingOverviewCard({ overview }: { overview: BillingOverview }) {
  if (overview.events.length === 0) {
    return (
      <Card role="region" aria-label={copy.title} className="flex flex-col items-start gap-4">
        <Text size="base">{copy.noEvents}</Text>
        <Button asChild size="lg" className="max-sm:w-full">
          <Link href={routes.newEvent}>{copy.createEvent}</Link>
        </Button>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {overview.events.map((event) => (
        <EventBillingCard key={event.eventId} event={event} />
      ))}
      <Text size="sm" tone="muted">
        {copy.accessNote}
      </Text>
      {overview.payments !== "ready" ? (
        <Text size="sm" tone="muted">
          {billingCopy.notConfigured}
        </Text>
      ) : null}
    </div>
  );
}
