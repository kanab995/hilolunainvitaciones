import type { Metadata } from "next";
import { PricingComparison } from "@/components/billing/pricing-comparison";
import { PricingFaq } from "@/components/billing/pricing-faq";
import { PricingFinalCta } from "@/components/billing/pricing-final-cta";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { PricingSummaryStrip } from "@/components/billing/pricing-summary-strip";
import { PageHero } from "@/components/marketing/page-hero";
import { Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";
import { getOrCreateCurrentUser } from "@/server/auth/current-user";

const copy = billingCopy.pricing;

export const metadata: Metadata = { title: "Precios", description: copy.description };

/** Depende de la sesión (los CTA cambian con o sin cuenta): nunca se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * Planes y precios (D-32: un pago único por evento). Pública. Nada se paga aquí: toda compra pertenece a un evento, así que los CTA
 * llevan a crear el evento (sin sesión, pasando antes por el registro y conservando la intención de plan). Los precios y cuotas
 * salen de la configuración de planes (una sola fuente).
 *
 * Orden deliberado (D-46): primero vende (hero → tarjetas), después compara (franja resumen → tabla
 * detallada de apoyo), después resuelve dudas (FAQ) y cierra con un último CTA. La tabla ya no es el
 * protagonista de la página.
 */
export default async function PricingPage() {
  const user = await getOrCreateCurrentUser();
  const signedIn = user !== null;

  return (
    <>
      <PageHero headingId="pricing-title" eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} description={copy.description} />
      <section aria-label="Planes" className="lu-container flex flex-col gap-16 pt-2 pb-16 lg:pt-4 lg:pb-20 lg:gap-20">
        <Text size="sm" tone="muted" className="-mt-4 max-w-[30rem]">
          {copy.priceNote}
        </Text>
        <PricingPlans signedIn={signedIn} />
        <PricingSummaryStrip />
        <PricingComparison />
        <PricingFaq />
        <PricingFinalCta signedIn={signedIn} />
      </section>
    </>
  );
}
