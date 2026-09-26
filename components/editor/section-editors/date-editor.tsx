"use client";

import { useState } from "react";
import { useEditor } from "@/components/editor/editor-context";
import { TextField } from "@/components/editor/fields/text-field";
import { date as dateError, time as timeError } from "@/lib/editor/validation";
import { isoToZonedParts, zonedPartsToIso } from "@/lib/editor/datetime";
import { formatCompactDate, formatLongDate } from "@/lib/invitation/format";

/**
 * Fecha y hora del evento. Escribe SOLO `event.startsAt` (la única fuente de verdad: la cuenta
 * regresiva, la portada y el cierre se calculan desde ahí). Mientras la fecha o la hora estén
 * incompletas o sean inválidas, el borrador conserva la última fecha válida y el campo muestra el error.
 */
export function DateEditor() {
  const { draft, api } = useEditor();
  const { startsAt, timezone } = draft.event;
  const initial = isoToZonedParts(startsAt, timezone) ?? { date: "", time: "" };
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [touched, setTouched] = useState(false);

  const commit = (nextDate: string, nextTime: string) => {
    setTouched(true);
    const iso = zonedPartsToIso(nextDate, nextTime, timezone);
    if (iso) api.updateInvitation((d) => ({ event: { ...d.event, startsAt: iso } }));
  };

  const shownError = (kind: "date" | "time") => {
    if (!touched) return undefined;
    return kind === "date" ? dateError(date) : timeError(time);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          id="event-date"
          label="Fecha"
          type="date"
          value={date}
          error={shownError("date")}
          onChange={(value) => {
            setDate(value);
            commit(value, time);
          }}
        />
        <TextField
          id="event-time"
          label="Hora"
          type="time"
          value={time}
          error={shownError("time")}
          onChange={(value) => {
            setTime(value);
            commit(date, value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1 rounded-lu-card bg-lu-surface-tint/60 p-4 text-lu-sm text-lu-text-secondary">
        <p>
          En la invitación se verá como <strong className="font-medium text-lu-text">{formatCompactDate(startsAt, timezone)}</strong>
        </p>
        <p>{formatLongDate(startsAt, timezone)}</p>
        <p className="text-lu-text-muted">Zona horaria del evento: {timezone}</p>
      </div>
    </div>
  );
}
