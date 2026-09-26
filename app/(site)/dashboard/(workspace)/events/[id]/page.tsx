import type { Metadata } from "next";
import { PaymentStatus, type PaymentBannerState } from "@/components/billing/payment-status";
import { UpgradeEventDialog } from "@/components/billing/upgrade-event-dialog";
import { ActionCards } from "@/components/dashboard/action-cards";
import { EventBanner } from "@/components/dashboard/event-banner";
import { EventHeader } from "@/components/dashboard/event-header";
import { EventPreviewCard } from "@/components/dashboard/event-preview-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RsvpSummary } from "@/components/dashboard/rsvp-summary";
import { ShareDialogProvider } from "@/components/dashboard/share-dialog";
import { Badge } from "@/components/ui/badge";
import { billingCopy } from "@/lib/billing/copy";
import { planLabel } from "@/lib/billing/plans";
import { loadDashboardPage } from "@/lib/dashboard/load-dashboard";
import { getServerNow } from "@/lib/invitation/server-time";
import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/auth/current-user";
import { getEventUpgradeView, reconcileEventPayments } from "@/server/services/billing-service";

export const metadata: Metadata = { title: "Evento" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Fecha corta del fin del acceso, en la zona por defecto del producto. */
const formatAccessDate = (date: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" }).format(date);

/**
 * Dashboard de un evento (mockup 05). Los datos salen de la base de datos (`loadDashboardPage`); la hora del servidor se toma una sola vez para que "Faltan X días" y los tiempos relativos
 * sean coherentes entre sí. Orden móvil: encabezado → acciones → confirmaciones → tarjetas de acción →
 * actividad → vista previa del evento.
 *
 * Plan del evento (D-32): junto al estado de publicación se muestra discretamente «Plan Gratis|Esencial|Premium» y, cuando aplica,
 * «Mejorar evento» (abre el panel de compra de ESTE evento; `?upgrade=` lo abre solo, p. ej. tras crear el evento desde `/pricing`).
 * `?payment=success` NO activa nada: muestra «Estamos confirmando tu pago…» hasta que el webhook verificado confirme la compra
 * (antes intenta reconciliarla una vez); `?payment=canceled` no cambia nada.
 */
export default async function EventDashboardPage(props: PageProps<"/dashboard/events/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const now = getServerNow();
  const data = await loadDashboardPage(id, routes.event);
  const user = await requireAuth();

  let billing = await getEventUpgradeView(user, data.event.id);
  const payment = first(searchParams.payment);
  if (billing && payment === "success" && billing.pendingPayment) {
    try {
      await reconcileEventPayments(user, data.event.id);
      billing = await getEventUpgradeView(user, data.event.id);
    } catch {
      // La reconciliación es opcional: si falla, sigue valiendo el webhook.
    }
  }
  const banner: PaymentBannerState | undefined = payment === "canceled" ? "canceled" : payment === "success" && billing ? (billing.pendingPayment ? "confirming" : "confirmed") : undefined;
  const upgradeParam = first(searchParams.upgrade);

  const planBadge = billing ? (
    <>
      <Badge data-event-plan={billing.plan} tone={billing.plan === "FREE" ? "neutral" : "success"} className="self-start">
        Plan {planLabel(billing.plan)}
      </Badge>
      {billing.plan !== "FREE" && billing.paidAccessEndsAt ? (
        <span data-access-until className="text-lu-sm text-lu-text-muted">
          {billing.accessState === "expired" ? billingCopy.billing.accessExpired(formatAccessDate(billing.paidAccessEndsAt)) : billingCopy.billing.access(formatAccessDate(billing.paidAccessEndsAt))}
        </span>
      ) : null}
    </>
  ) : undefined;

  const upgradeAction = billing ? (
    <UpgradeEventDialog
      eventId={data.event.id}
      title={data.event.title}
      plan={billing.plan}
      options={billing.options}
      paymentsReady={billing.payments === "ready"}
      defaultOpen={upgradeParam !== undefined && !banner}
      highlight={upgradeParam && upgradeParam !== "1" ? upgradeParam : undefined}
    />
  ) : undefined;

  return (
    <ShareDialogProvider slug={data.event.publicSlug} title={data.event.title} state={data.event.publication.state} eventId={data.event.id}>
      <div className="flex flex-col gap-6 md:gap-8">
        <EventHeader event={data.event} now={now} planBadge={planBadge} upgradeAction={upgradeAction} />
        {banner ? <PaymentStatus state={banner} /> : null}
        <EventBanner data={data} />
        <RsvpSummary summary={data.rsvpSummary} eventId={data.event.id} />
        <ActionCards data={data} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <RecentActivity activity={data.recentActivity} eventId={data.event.id} now={now} />
          <EventPreviewCard data={data} />
        </div>
      </div>
    </ShareDialogProvider>
  );
}
