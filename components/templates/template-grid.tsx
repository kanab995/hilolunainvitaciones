import { CatalogTemplateCard } from "@/components/templates/catalog-template-card";
import { cn } from "@/lib/utils";
import type { Template } from "@/types/templates";

/**
 * Rejilla de plantillas (mockups 02 y 03): 3 columnas en escritorio, 2 en tablet y 1 en móvil
 * (RESPONSIVE §Galería). Las tres primeras tarjetas cargan con prioridad.
 */
export function TemplateGrid({
  items,
  allStyles = false,
  className,
}: {
  items: readonly Template[];
  /** Muestra todos los estilos en el pie de cada tarjeta (detalle [03]). */
  allStyles?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3", className)}>
      {items.map((template, index) => (
        <li key={template.id}>
          <CatalogTemplateCard template={template} priority={index < 3} allStyles={allStyles} />
        </li>
      ))}
    </ul>
  );
}
