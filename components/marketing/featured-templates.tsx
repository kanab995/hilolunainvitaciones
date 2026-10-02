import Link from "next/link";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { CatalogTemplateCard } from "@/components/templates/catalog-template-card";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { featuredTemplateSlugs, featuredTemplatesCopy } from "@/lib/content/home";
import { templates } from "@/lib/content/templates";
import { routes } from "@/lib/routes";
import { isTemplateReady } from "@/lib/templates/status";

/**
 * "Plantillas que se sienten como tu evento" (mockup 01): titular a la izquierda, botón a la
 * derecha y las plantillas destacadas. Filtra por `isTemplateReady` además de por `slug` (misma
 * regla que `/templates`, `docs/ARCHITECTURE.md`): aunque `featuredTemplateSlugs` cambie, nunca
 * puede llegar a destacarse aquí una plantilla `concept`/`comingSoon`.
 */
export function FeaturedTemplates() {
  const featured = featuredTemplateSlugs.flatMap((slug) => {
    const template = templates.find((item) => item.slug === slug);
    return template && isTemplateReady(template) ? [template] : [];
  });

  return (
    <MarketingSection labelledBy="featured-templates-title">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          headingId="featured-templates-title"
          title={featuredTemplatesCopy.title}
          description={featuredTemplatesCopy.description}
        />
        <Button asChild variant="secondary" size="sm" arrow className="self-start md:mb-1 md:self-auto">
          <Link href={routes.templates}>{featuredTemplatesCopy.cta}</Link>
        </Button>
      </div>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((template) => (
          <li key={template.id}>
            <CatalogTemplateCard template={template} />
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
