import { TemplateCard } from "@/components/templates/template-card";
import { eventTypeLabels, styleLabels, templates } from "@/lib/content/templates";
import { getTemplateStyles } from "@/lib/templates/filter";
import { getTemplateCoverImage } from "@/lib/templates/status";
import { routes } from "@/lib/routes";
import type { Template } from "@/types/templates";

/**
 * `TemplateCard` alimentada por un elemento del catálogo. Un solo punto de traducción
 * `Template` → props visuales para la home y la galería (sin duplicar etiquetas ni rutas).
 * El placeholder alterna su orientación según la posición de la plantilla en el catálogo, para que
 * no cambie al filtrar.
 */
export function CatalogTemplateCard({
  template,
  priority,
  allStyles = false,
  className,
}: {
  template: Template;
  priority?: boolean;
  /** Muestra también los estilos adicionales ("Boda · Minimal · Elegante", [03]); por defecto solo el principal ([02]). */
  allStyles?: boolean;
  className?: string;
}) {
  const flip = templates.findIndex((item) => item.id === template.id) % 2 === 1;
  const category = eventTypeLabels[template.eventType];
  const cover = getTemplateCoverImage(template.slug);
  return (
    <TemplateCard
      href={routes.template(template.slug)}
      name={template.name}
      category={category}
      styles={(allStyles ? getTemplateStyles(template) : [template.style]).map((style) => styleLabels[style])}
      imageSrc={cover?.src ?? template.thumbnail.src}
      imageAlt={cover ? `Vista previa de la plantilla ${template.name} para invitación de ${category}` : template.thumbnail.alt}
      imagePosition={cover?.position}
      tone={template.thumbnail.tone}
      flip={flip}
      priority={priority}
      className={className}
    />
  );
}
