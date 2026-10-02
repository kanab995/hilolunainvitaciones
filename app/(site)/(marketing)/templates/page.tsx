import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/marketing/page-hero";
import { TemplateGallery, TemplateGalleryFallback } from "@/components/templates/template-gallery";
import { templatesPageCopy } from "@/lib/content/templates";
import { isTemplateReady } from "@/lib/templates/status";
import { getTemplates } from "@/server/repositories/templates";

export const metadata: Metadata = {
  title: templatesPageCopy.title,
  description: templatesPageCopy.metaDescription,
};

/** El catálogo se regenera cada hora (las plantillas cambian poco). */
export const revalidate = 3600;

/** Galería de plantillas (mockup 02). Catálogo leído de la base de datos; los filtros funcionan en el cliente. */
export default async function TemplatesPage() {
  /** Catálogo público: solo plantillas con diseño aprobado (`concept`/`comingSoon` existen pero no se listan). */
  const templates = (await getTemplates()).filter(isTemplateReady);
  return (
    <>
      <PageHero
        headingId="templates-title"
        eyebrow={templatesPageCopy.eyebrow}
        title={templatesPageCopy.title}
        subtitle={templatesPageCopy.subtitle}
        description={templatesPageCopy.description}
      />
      <section aria-label="Galería de plantillas" className="lu-container pt-6 pb-16 lg:pt-8 lg:pb-20">
        <Suspense fallback={<TemplateGalleryFallback catalog={templates} />}>
          <TemplateGallery catalog={templates} />
        </Suspense>
      </section>
    </>
  );
}
