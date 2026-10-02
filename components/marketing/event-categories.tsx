import { EventCategoryCard } from "@/components/marketing/event-category-card";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SectionHeading } from "@/components/ui/section-heading";
import { categoriesCopy, eventCategories } from "@/lib/content/home";
import { templates } from "@/lib/content/templates";
import { getTemplateCoverImage, isTemplateReady } from "@/lib/templates/status";

/**
 * "Elige el momento que estás celebrando" (mockup 01). 6 columnas en escritorio (`xl`),
 * 3 en tablet, 2 en móvil (elegida sobre el scroll horizontal: mantiene visibles las seis
 * categorías y evita contenido oculto). La foto de cada categoría es la portada real de su primera
 * plantilla lista (`isTemplateReady`, misma regla que `/templates`); sin ninguna plantilla lista
 * todavía para ese tipo de evento (hoy Baby Shower e Infantiles) queda con el placeholder de
 * siempre y un aviso "Próximamente" — nunca se presenta como disponible algo que no lo está.
 */
export function EventCategories() {
  return (
    <MarketingSection labelledBy="categories-title">
      <SectionHeading
        headingId="categories-title"
        align="center"
        title={categoriesCopy.title}
        description={categoriesCopy.description}
      />
      <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-6">
        {eventCategories.map((category, index) => {
          const readyTemplate = templates.find((template) => isTemplateReady(template) && template.eventType === category.id);
          const cover = readyTemplate ? getTemplateCoverImage(readyTemplate.slug) : undefined;
          return (
            <li key={category.id}>
              <EventCategoryCard
                title={category.title}
                href={category.href}
                imageSrc={cover?.src ?? category.imageSrc}
                imageAlt={category.imageAlt}
                tone={category.tone}
                flip={index % 2 === 1}
                comingSoon={!readyTemplate}
              />
            </li>
          );
        })}
      </ul>
    </MarketingSection>
  );
}
