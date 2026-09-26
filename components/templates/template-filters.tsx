"use client";

import { Chip } from "@/components/ui/chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoryFilters, styleLabels, templatesPageCopy } from "@/lib/content/templates";
import type { EventCategoryId } from "@/types/marketing";
import type { TemplateStyleId } from "@/types/templates";

const ALL = "all";

/** En `lg` (1024–1279) los chips se compactan para que quepan en una sola fila junto al selector. */
const chipClass = "lg:px-4 xl:px-6";

type TemplateFiltersProps = {
  category: EventCategoryId | null;
  style: TemplateStyleId | null;
  styleOptions: readonly TemplateStyleId[];
  onCategoryChange: (category: EventCategoryId | null) => void;
  onStyleChange: (style: TemplateStyleId | null) => void;
};

/**
 * Filtros de la galería (mockup 02): chips de categoría (uno activo; "Todas" limpia el filtro)
 * y selector de estilo a la derecha. Componente controlado: el estado vive en `TemplateGallery`.
 * Móvil: los chips se desplazan en horizontal (RESPONSIVE §Galería).
 */
export function TemplateFilters({
  category,
  style,
  styleOptions,
  onCategoryChange,
  onStyleChange,
}: TemplateFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
      <div
        role="group"
        aria-label={templatesPageCopy.filtersLabel}
        className="-mx-(--lu-gutter) flex gap-2.5 overflow-x-auto px-(--lu-gutter) pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 lg:gap-3 [&::-webkit-scrollbar]:hidden"
      >
        <Chip className={chipClass} active={category === null} onClick={() => onCategoryChange(null)}>
          {templatesPageCopy.allCategories}
        </Chip>
        {categoryFilters.map((filter) => (
          <Chip key={filter.id} className={chipClass} active={category === filter.id} onClick={() => onCategoryChange(filter.id)}>
            {filter.label}
          </Chip>
        ))}
      </div>

      <Select
        value={style ?? ALL}
        onValueChange={(value) => onStyleChange(value === ALL ? null : (value as TemplateStyleId))}
      >
        <SelectTrigger
          aria-label={templatesPageCopy.styleLabel}
          className="h-(--lu-h-chip) w-full shrink-0 rounded-lu-button-lg px-5 sm:w-56"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={ALL}>{templatesPageCopy.allStyles}</SelectItem>
          {styleOptions.map((id) => (
            <SelectItem key={id} value={id}>
              {styleLabels[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
