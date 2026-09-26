"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTemplateChoices } from "@/lib/editor/template-choice";
import { cn } from "@/lib/utils";

/**
 * Cambiar plantilla (panel mock). Solo las plantillas `implemented` (Magnolia) se pueden elegir;
 * Ivory y Étoile (`concept`) aparecen como «Próximamente» y no son seleccionables. Las `comingSoon`
 * no se listan (no aportan valor aquí). Cambiar de plantilla NO toca los datos (regla 17).
 */
export function TemplateDialog({ open, onOpenChange, activeSlug, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; activeSlug: string; onSelect: (slug: string) => void }) {
  const choices = getTemplateChoices();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Cambiar plantilla</DialogTitle>
          <DialogDescription>Tu contenido se conserva al cambiar de plantilla: solo cambia el diseño.</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {choices.map((choice) => {
            const active = choice.slug === activeSlug;
            return (
              <li key={choice.slug}>
                <button
                  type="button"
                  disabled={!choice.selectable}
                  aria-pressed={active}
                  onClick={() => {
                    onSelect(choice.slug);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lu-card border bg-lu-surface p-4 text-left outline-none transition-colors duration-150",
                    "focus-visible:ring-2 focus-visible:ring-lu-brown-600",
                    active ? "border-lu-brown-600 bg-lu-nav-active" : "border-lu-border-subtle",
                    choice.selectable ? "hover:border-lu-border-outline" : "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="font-lu-display text-lu-title-md text-lu-text">{choice.name}</span>
                  {active ? (
                    <Badge tone="success" dot>
                      <Check aria-hidden="true" className="size-3" />
                      Plantilla actual
                    </Badge>
                  ) : choice.selectable ? (
                    <Badge tone="neutral">Disponible</Badge>
                  ) : (
                    <Badge tone="outline">Próximamente</Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <DialogClose asChild>
          <Button variant="secondary" className="self-end">
            Cerrar
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
