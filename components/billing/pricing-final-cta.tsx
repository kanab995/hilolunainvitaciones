import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { billingCopy } from "@/lib/billing/copy";
import { routes } from "@/lib/routes";

/** Cierre de `/pricing`: un último empujón hacia crear el evento (plan Gratis, sin fricción) tras ver planes, comparación y FAQ. */
export function PricingFinalCta({ signedIn }: { signedIn: boolean }) {
  const copy = billingCopy.pricing.finalCta;
  const href = signedIn ? routes.newEvent : `${routes.signUp}?redirect_url=${encodeURIComponent(routes.newEvent)}`;

  return (
    <section aria-labelledby="pricing-final-cta-title" className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <Heading as="h2" id="pricing-final-cta-title" size="title-xl">
        {copy.title}
      </Heading>
      <Text size="md" tone="secondary">
        {copy.description}
      </Text>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="primary" size="lg">
          <Link href={href}>{copy.action}</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={routes.templates}>{copy.secondaryAction}</Link>
        </Button>
      </div>
    </section>
  );
}
