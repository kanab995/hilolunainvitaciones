import Link from "next/link";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { TemplateGrid } from "@/components/templates/template-grid";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { templateDetailCopy } from "@/lib/content/templates";
import { routes } from "@/lib/routes";
import type { Template } from "@/types/templates";

/**
 * "Otros diseños que podrían gustarte" (mockup 03): titular a la izquierda, botón "Ver todas" a la
 * derecha y una rejilla de `TemplateCard` (reutiliza `TemplateGrid`, que a su vez usa `TemplateCard`).
 * Recibe las plantillas ya elegidas (`getRelatedTemplates`); sin ellas no dibuja nada.
 */
export function RelatedTemplates({ templates }: { templates: readonly Template[] }) {
  if (templates.length === 0) return null;

  return (
    <MarketingSection labelledBy="related-templates-title">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          headingId="related-templates-title"
          size="title-xl"
          title={templateDetailCopy.related.title}
          description={templateDetailCopy.related.description}
        />
        <Button asChild variant="secondary" size="md" arrow className="self-start md:mb-1 md:self-auto">
          <Link href={routes.templates}>{templateDetailCopy.related.cta}</Link>
        </Button>
      </div>
      <TemplateGrid items={templates} allStyles className="mt-10" />
    </MarketingSection>
  );
}
