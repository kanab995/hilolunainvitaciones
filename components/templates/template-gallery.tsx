"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { TemplateFilters } from "@/components/templates/template-filters";
import { TemplateGrid } from "@/components/templates/template-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { templatesPageCopy } from "@/lib/content/templates";
import {
  filterTemplates,
  getAvailableStyles,
  parseTemplateFilters,
  serializeTemplateFilters,
} from "@/lib/templates/filter";
import type { Template, TemplateFilterState } from "@/types/templates";

const NO_FILTERS: TemplateFilterState = { category: null, style: null };

/**
 * Galería de plantillas (mockup 02): filtros + rejilla, todo en el cliente sobre el catálogo que
 * recibe por props. Los filtros se reflejan en la URL (`?category=&style=`, docs/ROUTES.md §5) con
 * `history.replaceState`, así el enlace se puede compartir sin recargar ni añadir historial.
 * Requiere un `<Suspense>` en la página (usa `useSearchParams`): la página sigue siendo estática y
 * su HTML inicial es el catálogo completo (`TemplateGalleryFallback`).
 */
export function TemplateGallery({ catalog }: { catalog: readonly Template[] }) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseTemplateFilters(searchParams, catalog), [searchParams, catalog]);
  const styleOptions = useMemo(() => getAvailableStyles(catalog), [catalog]);
  const visible = useMemo(() => filterTemplates(catalog, filters), [catalog, filters]);

  /** Next sincroniza `useSearchParams` con `history.replaceState`: la URL es la única fuente de verdad. */
  const update = (next: TemplateFilterState) => {
    const query = serializeTemplateFilters(next);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  return (
    <div className="flex flex-col gap-8">
      <TemplateFilters
        category={filters.category}
        style={filters.style}
        styleOptions={styleOptions}
        onCategoryChange={(category) => update({ ...filters, category })}
        onStyleChange={(style) => update({ ...filters, style })}
      />

      {/* Anuncia el resultado a lectores de pantalla sin mover el foco */}
      <p role="status" className="sr-only">
        {visible.length === 1 ? "1 plantilla" : `${visible.length} plantillas`}
      </p>

      {visible.length > 0 ? (
        <TemplateGrid items={visible} />
      ) : (
        <EmptyState
          variant="dashed"
          icon={<SearchX />}
          title={templatesPageCopy.empty.title}
          description={templatesPageCopy.empty.description}
          action={
            <Button variant="secondary" onClick={() => update(NO_FILTERS)}>
              {templatesPageCopy.empty.action}
            </Button>
          }
        />
      )}
    </div>
  );
}

/** HTML estático inicial de la galería: catálogo completo y hueco reservado para los filtros. */
export function TemplateGalleryFallback({ catalog }: { catalog: readonly Template[] }) {
  return (
    <div className="flex flex-col gap-8">
      <div aria-hidden="true" className="h-12" />
      <TemplateGrid items={catalog} />
    </div>
  );
}
