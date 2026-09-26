"use client";

import { CalendarClock } from "lucide-react";
import { useEditor } from "@/components/editor/editor-context";
import { SectionHeadingFields } from "@/components/editor/fields/section-heading-fields";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { Button } from "@/components/ui/button";
import { DATE_ROW_ID } from "@/lib/editor/rows";
import { formatLongDate } from "@/lib/invitation/format";
import { isoToZonedParts } from "@/lib/editor/datetime";

/**
 * Cuenta regresiva: no hay números que editar. Se calcula desde `event.startsAt` (única fuente de
 * verdad); aquí solo se edita el titular y se enlaza al editor de la fecha. El modelo actual no tiene
 * opciones para ocultar días/horas/minutos/segundos y no se amplía por eso.
 */
export function CountdownEditor({ section }: SectionEditorProps) {
  const { draft, selectRow } = useEditor();
  if (!section) return null;
  const { startsAt, timezone } = draft.event;
  const parts = isoToZonedParts(startsAt, timezone);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeadingFields section={section} fields={["title"]} />

      <div className="flex flex-col gap-3 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-4">
        <p className="text-lu-sm text-lu-text-muted">Cuenta regresiva hasta:</p>
        <p className="font-lu-display text-lu-title-md text-lu-text">
          {formatLongDate(startsAt, timezone)}
          {parts ? `, ${parts.time}` : ""}
        </p>
        <Button variant="secondary" size="sm" className="self-start" onClick={() => selectRow(DATE_ROW_ID)}>
          <CalendarClock aria-hidden="true" />
          Cambiar fecha
        </Button>
      </div>
    </div>
  );
}
