import type { Metadata } from "next";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { PageHero } from "@/components/marketing/page-hero";
import { billingCopy } from "@/lib/billing/copy";
import { getOrCreateCurrentUser } from "@/server/auth/current-user";
import { getTemplates } from "@/server/repositories/templates";

const copy = billingCopy.pricing;

export const metadata: Metadata = { title: "Precios", description: copy.description };

/** Depende de la sesión (los CTA cambian con o sin cuenta): nunca se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * Planes y precios (D-32: un pago único por evento). Pública. Nada se paga aquí: toda compra pertenece a un evento, así que los CTA
 * llevan a crear el evento (sin sesión, pasando antes por el registro y conservando la intención de plan). Las filas y los precios salen
 * de la configuración de planes y el número de plantillas, del catálogo real.
 */
export default async function PricingPage() {
  const [user, catalog] = await Promise.all([getOrCreateCurrentUser(), getTemplates()]);
  const usable = catalog.filter((template) => template.status === "implemented");

  return (
    <>
      <PageHero headingId="pricing-title" eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} description={copy.description} />
      <section aria-label="Planes" className="lu-container pt-6 pb-16 lg:pt-8 lg:pb-20">
        <PricingPlans signedIn={user !== null} templates={usable} />
      </section>
    </>
  );
}
