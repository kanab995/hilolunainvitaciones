import { Heading, Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";

/**
 * Preguntas frecuentes de precios (`/pricing`). Lista estática siempre visible (sin acordeón: el
 * contenido de un acordeón colapsado no existe en el HTML servido hasta que React hidrata y se abre,
 * lo que esconde estas respuestas de buscadores y de cualquiera que vea la página sin JS todavía
 * activo — justo lo que una página pensada para vender mejor no debería hacer).
 */
export function PricingFaq() {
  const faq = billingCopy.pricing.faq;

  return (
    <section aria-labelledby="pricing-faq-title" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Heading as="h2" id="pricing-faq-title" size="title-lg" className="text-center">
        Preguntas frecuentes
      </Heading>
      <dl className="flex flex-col gap-5">
        {faq.map((item) => (
          <div key={item.question} className="flex flex-col gap-1.5 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-4 md:p-5">
            <Heading as="dt" size="title-sm">
              {item.question}
            </Heading>
            <Text as="dd" size="base" tone="muted">
              {item.answer}
            </Text>
          </div>
        ))}
      </dl>
    </section>
  );
}
