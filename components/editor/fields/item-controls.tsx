"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * Controles de un elemento de lista editable: subir, bajar y eliminar. Son botones reales con
 * nombre accesible ("Mover Cena arriba"): reordenar NUNCA depende solo de arrastrar.
 */
export function ItemControls({
  name,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel = "Eliminar",
  className,
}: {
  /** Nombre legible del elemento ("Cena", "Liverpool"). */
  name: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconButton variant="ghost" size="sm" aria-label={`Mover ${name} arriba`} disabled={isFirst} onClick={onMoveUp}>
        <ChevronUp aria-hidden="true" />
      </IconButton>
      <IconButton variant="ghost" size="sm" aria-label={`Mover ${name} abajo`} disabled={isLast} onClick={onMoveDown}>
        <ChevronDown aria-hidden="true" />
      </IconButton>
      {onRemove ? (
        <IconButton variant="ghost" size="sm" aria-label={`${removeLabel} ${name}`} onClick={onRemove}>
          <Trash2 aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}

/** Tarjeta de un elemento de lista: contenido a la izquierda y controles a la derecha. */
export function ItemCard({ children, controls, className }: { children: ReactNode; controls?: ReactNode; className?: string }) {
  return (
    <li className={cn("flex flex-col gap-3 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-4 @md:flex-row @md:items-start", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {controls ? <div className="shrink-0">{controls}</div> : null}
    </li>
  );
}
