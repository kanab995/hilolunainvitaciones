import type { Metadata } from "next";
import { BillingOverviewCard } from "@/components/billing/billing-overview";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { billingCopy } from "@/lib/billing/copy";
import { requireAuth } from "@/server/auth/current-user";
import { getBillingOverview } from "@/server/services/billing-service";

const copy = billingCopy.billing;

export const metadata: Metadata = { title: copy.title };

/** Depende de la sesión y del webhook: nunca se prerenderiza ni se cachea. */
export const dynamic = "force-dynamic";

/**
 * Compras y planes (`/dashboard/billing`, D-32). Sesión obligatoria. Lista los eventos DEL usuario con el plan de cada uno, hasta cuándo
 * está disponible, su uso y lo que se pagó. No hay plan de cuenta: cada compra pertenece a un evento y se inicia desde el dashboard de
 * ese evento («Mejorar evento»). El plan sale SIEMPRE del servidor (la URL nunca decide nada).
 */
export default async function BillingPage() {
  const user = await requireAuth();
  const overview = await getBillingOverview(user);
  return (
    <DashboardPlaceholder title={copy.title} description={copy.description}>
      <BillingOverviewCard overview={overview} />
    </DashboardPlaceholder>
  );
}
