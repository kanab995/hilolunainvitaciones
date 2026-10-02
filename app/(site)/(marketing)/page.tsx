import type { Metadata } from "next";
import { EventCategories } from "@/components/marketing/event-categories";
import { FeatureShowcase } from "@/components/marketing/feature-showcase";
import { FeaturedTemplates } from "@/components/marketing/featured-templates";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} | Invitaciones digitales elegantes para eventos` },
  description:
    "Crea invitaciones digitales para bodas, XV años, bautizos y cumpleaños con RSVP, galería, ubicación, cuenta regresiva y enlace personalizado.",
};

/** Homepage de marketing (mockup 01). Solo presentación: sin datos de servidor. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <EventCategories />
      <HowItWorks />
      <FeatureShowcase />
      <FeaturedTemplates />
      <FinalCta />
    </>
  );
}
