import { EventCategoryCard } from "@/components/marketing/event-category-card";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SectionHeading } from "@/components/ui/section-heading";
import { categoriesCopy, eventCategories } from "@/lib/content/home";

/**
 * "Elige el momento que estás celebrando" (mockup 01). 6 columnas en escritorio (`xl`),
 * 3 en tablet, 2 en móvil (elegida sobre el scroll horizontal: mantiene visibles las seis
 * categorías y evita contenido oculto).
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
        {eventCategories.map((category, index) => (
          <li key={category.id}>
            <EventCategoryCard
              title={category.title}
              href={category.href}
              imageSrc={category.imageSrc}
              imageAlt={category.imageAlt}
              tone={category.tone}
              flip={index % 2 === 1}
            />
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
