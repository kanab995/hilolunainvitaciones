import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { formatAddonPrice } from "@/lib/billing/addons";
import { billingCopy } from "@/lib/billing/copy";
import { printCopy } from "@/lib/print/copy";

/**
 * Complemento «Archivo listo para imprimir» en `/pricing` (D-48). Solo PRESENTA el producto: no hay botón de compra aquí (cada compra pertenece
 * a un evento y se hace desde su «Versión para imprimir», tras la vista previa). Con la venta apagada (`saleOpen = false`) se rotula «Muy
 * pronto». El precio sale de `lib/billing/addons.ts` y lo incluido, de la misma lista que la tarjeta del producto (una sola fuente).
 */
export function PricingPrintAddon({ saleOpen }: { saleOpen: boolean }) {
  const copy = billingCopy.pricing.printAddon;
  return (
    <section aria-labelledby="pricing-print-addon-title" data-print-addon={saleOpen ? "open" : "coming-soon"} className="mx-auto w-full max-w-4xl">
      <div className="grid gap-8 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-4">
          <Text size="sm" tone="muted" className="font-medium uppercase tracking-wide text-lu-xs">
            {copy.eyebrow}
          </Text>
          <Heading as="h2" id="pricing-print-addon-title" size="title-xl">
            {copy.title}
          </Heading>
          <Text size="md" tone="secondary" className="max-w-prose">
            {copy.description}
          </Text>
          <ul aria-label={copy.includesTitle} className="mt-1 flex flex-col gap-3">
            {printCopy.page.product.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-lu-base text-lu-text-secondary">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-lu-success" strokeWidth={2} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-t border-lu-border-subtle pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          {saleOpen ? null : (
            <Badge tone="pending" size="md" className="self-start">
              {copy.comingSoon}
            </Badge>
          )}
          <p data-print-addon-price className="font-lu-display text-lu-title-xl text-lu-text">
            {formatAddonPrice("PRINT_FILE")}
          </p>
          <Text size="sm" tone="secondary">
            {copy.priceNote}
          </Text>
          <Text size="sm" tone="secondary">
            {copy.eligibility}
          </Text>
          <p role="note" className="rounded-lu-card bg-lu-surface-tint px-4 py-3 text-lu-sm text-lu-text">
            {copy.fileOnly}
          </p>
          <Text size="sm" tone="muted">
            {saleOpen ? copy.howTo : copy.comingSoonNote}
          </Text>
        </div>
      </div>
    </section>
  );
}
