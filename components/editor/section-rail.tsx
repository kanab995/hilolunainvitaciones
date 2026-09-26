"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Gift,
  GripVertical,
  Heart,
  Image as ImageIcon,
  ListOrdered,
  MapPin,
  Music,
  PenLine,
  Shirt,
  Users,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import type { DraftApi } from "@/components/editor/use-invitation-draft";
import { IconButton } from "@/components/ui/icon-button";
import { canMoveSection } from "@/lib/editor/operations";
import type { EditorIconKey, EditorRow } from "@/lib/editor/rows";
import { cn } from "@/lib/utils";
import type { InvitationSection } from "@/types/invitation";

const icons: Record<EditorIconKey, ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: "true" }>> = {
  cover: ImageIcon,
  date: CalendarDays,
  countdown: Clock,
  location: MapPin,
  story: Heart,
  photos: ImageIcon,
  timeline: ListOrdered,
  gifts: Gift,
  rsvp: Users,
  music: Music,
  dressCode: Shirt,
  closing: PenLine,
};

type SectionRailProps = {
  rows: readonly EditorRow[];
  sections: readonly InvitationSection[];
  selectedId: string;
  onSelect: (id: string) => void;
  api: Pick<DraftApi, "toggleSection" | "moveSection" | "reorderSection">;
  /** Cabecera con el evento y la plantilla (mockup 04). */
  header?: React.ReactNode;
};

/**
 * LISTA DE SECCIONES (mockup 04, 352 px). Cada fila: asa de arrastre · ícono · nombre y subtítulo ·
 * ojo de visibilidad. Seleccionar una fila cambia SOLO el panel central. Reordenar: arrastrar con el
 * asa (HTML drag-and-drop, sin librerías) O los botones "Mover arriba/abajo" (siempre disponibles y
 * únicos en móvil). La portada y el cierre están fijos; Fecha y Música son datos, no secciones.
 */
export function SectionRail({ rows, sections, selectedId, onSelect, api, header }: SectionRailProps) {
  const [draggingId, setDraggingId] = useState<string>();
  const [overId, setOverId] = useState<string>();

  const sectionIndex = (id: string) => sections.findIndex((section) => section.id === id);

  const drop = (targetId: string) => {
    if (draggingId && draggingId !== targetId) api.reorderSection(draggingId, sectionIndex(targetId));
    setDraggingId(undefined);
    setOverId(undefined);
  };

  return (
    <nav aria-label="Secciones de la invitación" className="flex flex-col gap-4">
      {header}
      <p id="rail-help" className="sr-only">
        Selecciona una sección para editarla. Para reordenar, arrastra el asa o usa los botones Mover arriba y Mover abajo.
      </p>
      <ul aria-describedby="rail-help" className="flex flex-col gap-2">
        {rows.map((row) => {
          const Icon = icons[row.icon];
          const selected = row.id === selectedId;
          const hidden = row.isSection && row.visible === false;
          const movable = row.isSection && !row.pinned;
          const canUp = movable && canMoveSection(sections, row.id, "up");
          const canDown = movable && canMoveSection(sections, row.id, "down");

          return (
            <li
              key={row.id}
              onDragOver={(event) => {
                if (!draggingId || !movable) return;
                event.preventDefault();
                setOverId(row.id);
              }}
              onDrop={(event) => {
                if (!movable) return;
                event.preventDefault();
                drop(row.id);
              }}
              className={cn(
                "group/row relative flex items-center gap-1 rounded-lu-card border border-lu-border-subtle bg-lu-surface transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-lu-standard",
                selected && "border-l-2 border-l-lu-brown-600 bg-lu-nav-active",
                draggingId === row.id && "opacity-40",
                overId === row.id && draggingId !== row.id && "ring-2 ring-lu-brown-600/40",
              )}
            >
              {movable ? (
                <button
                  type="button"
                  draggable
                  aria-label={`Arrastrar sección ${row.label}`}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", row.id);
                    setDraggingId(row.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(undefined);
                    setOverId(undefined);
                  }}
                  className="inline-flex h-11 w-7 shrink-0 cursor-grab items-center justify-center rounded-lu-xs text-lu-text-subtle outline-none hover:text-lu-text focus-visible:ring-2 focus-visible:ring-lu-brown-600 max-md:hidden"
                >
                  <GripVertical aria-hidden="true" className="size-4" strokeWidth={1.5} />
                </button>
              ) : (
                <span aria-hidden="true" className="w-7 shrink-0 max-md:hidden" />
              )}

              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(row.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-lu-input py-2.5 pr-1 pl-2 text-left outline-none md:pl-0",
                  "focus-visible:ring-2 focus-visible:ring-lu-brown-600",
                  hidden && "opacity-55",
                )}
              >
                <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lu-input bg-lu-surface-tint text-lu-text [&_svg]:size-5">
                  <Icon strokeWidth={1.5} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-lu-display text-lu-title-sm leading-tight text-lu-text">{row.label}</span>
                  <span className="truncate text-lu-xs text-lu-text-muted">{hidden ? "Oculta en la invitación" : row.subtitle}</span>
                </span>
              </button>

              {movable ? (
                <span className="flex shrink-0 items-center transition-opacity duration-150 max-md:opacity-100 md:absolute md:top-1/2 md:right-11 md:-translate-y-1/2 md:rounded-lu-input md:bg-lu-surface md:opacity-0 md:shadow-lu-card md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100">
                  <IconButton variant="ghost" size="sm" aria-label={`Mover ${row.label} arriba`} disabled={!canUp} onClick={() => api.moveSection(row.id, "up")}>
                    <ChevronUp aria-hidden="true" />
                  </IconButton>
                  <IconButton variant="ghost" size="sm" aria-label={`Mover ${row.label} abajo`} disabled={!canDown} onClick={() => api.moveSection(row.id, "down")}>
                    <ChevronDown aria-hidden="true" />
                  </IconButton>
                </span>
              ) : null}

              {row.isSection ? (
                <IconButton
                  variant="ghost"
                  size="md"
                  className="mr-1"
                  aria-label={`${row.visible ? "Ocultar" : "Mostrar"} sección ${row.label}`}
                  onClick={() => api.toggleSection(row.id)}
                >
                  {row.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </IconButton>
              ) : (
                <span aria-hidden="true" className="mr-1 size-9 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
