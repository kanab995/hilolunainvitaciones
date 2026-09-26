"use client";

import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { SaveStatus } from "@/components/editor/save-status";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import type { AutosaveState } from "@/lib/editor/autosave";
import { routes } from "@/lib/routes";

/**
 * Barra superior del editor (mockup 04, 76 px): marca · ← Mis eventos / nombre del evento, a la
 * derecha estado de guardado (+ estado de publicación), "Vista previa" y «Publicar» / «Publicar cambios»
 * (D-29: la publicación es real; «Guardado» y «Publicado» se muestran por separado).
 */
export function EditorTopbar({
  eventTitle,
  saveState,
  onRetry,
  onPreview,
  onPublish,
  publicationLabel,
  publishLabel = "Publicar",
  publishing = false,
  demo = false,
}: {
  eventTitle: string;
  saveState: AutosaveState;
  onRetry: () => void;
  onPreview: () => void;
  onPublish: () => void;
  publicationLabel?: string;
  publishLabel?: string;
  publishing?: boolean;
  demo?: boolean;
}) {
  return (
    <header className="flex h-(--lu-editor-topbar-h) shrink-0 items-center gap-3 border-b border-lu-border-subtle bg-lu-surface px-4 max-md:h-16 md:gap-6 md:px-8">
      <Wordmark href={routes.home} className="hidden lg:inline" />

      <nav aria-label="Migas de pan" className="flex min-w-0 flex-1 items-center gap-2 text-lu-sm text-lu-text-secondary lg:ml-6 lg:flex-none md:text-lu-base">
        <Link
          href={routes.events}
          className="inline-flex shrink-0 items-center gap-2 rounded-lu-xs outline-none hover:text-lu-text focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <span className="max-lg:sr-only">Mis eventos</span>
        </Link>
        <span aria-hidden="true" className="text-lu-text-subtle max-lg:hidden">
          /
        </span>
        <span aria-current="page" className="truncate font-medium text-lu-text md:font-normal">
          {eventTitle}
        </span>
      </nav>

      <div className="flex shrink-0 items-center gap-3 lg:ml-auto md:gap-4">
        <SaveStatus state={saveState} onRetry={onRetry} publicationLabel={publicationLabel} demo={demo} />
        <span aria-hidden="true" className="hidden h-8 w-px bg-lu-border-subtle md:block" />
        <Button variant="secondary" size="md" className="hidden md:inline-flex" onClick={onPreview}>
          <Eye aria-hidden="true" />
          Vista previa
        </Button>
        <Button size="md" arrow={!publishing} loading={publishing} className="max-md:px-4 max-md:[&_svg]:hidden" onClick={onPublish}>
          {publishing ? "Publicando..." : publishLabel}
        </Button>
      </div>
    </header>
  );
}
