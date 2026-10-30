import type { Metadata } from "next";
import { EventCategories } from "@/components/marketing/event-categories";
import { FeatureShowcase } from "@/components/marketing/feature-showcase";
import { FeaturedTemplates } from "@/components/marketing/featured-templates";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { siteConfig } from "@/lib/site-config";
import { getTemplates } from "@/server/repositories/templates";

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} | Invitaciones digitales elegantes para eventos` },
  description:
    "Crea invitaciones digitales para bodas, XV años, bautizos y cumpleaños con RSVP, galería, ubicación, cuenta regresiva y enlace personalizado.",
};

/** Igual que `/templates`: se regenera cada hora y, al publicar u ocultar una plantilla, lo invalida `updateTemplateAction`. */
export const revalidate = 3600;

/** Homepage de marketing (mockup 01). Las secciones de plantillas reciben el catálogo publicado (`getTemplates`). */
export default async function HomePage() {
  const catalog = await getTemplates();
  return (
    <>
      <Hero catalog={catalog} />
      <EventCategories catalog={catalog} />
      <HowItWorks />
      <FeatureShowcase />
      <FeaturedTemplates catalog={catalog} />
      <FinalCta />
    </>
  );
}
