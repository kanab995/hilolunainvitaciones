"use client";

import { useState } from "react";
import { useEditor } from "@/components/editor/editor-context";
import { SectionHeadingFields } from "@/components/editor/fields/section-heading-fields";
import { TextAreaField, TextField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { Switch } from "@/components/ui/switch";
import { isoToZonedParts, zonedPartsToIso } from "@/lib/editor/datetime";
import { LIMITS } from "@/lib/editor/validation";
import type { RSVPSettings } from "@/types/invitation";

function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-lu-sm font-medium text-lu-text">
          {label}
        </label>
        <p id={`${id}-hint`} className="max-w-sm text-lu-sm text-lu-text-muted">
          {hint}
        </p>
      </div>
      <Switch id={id} aria-describedby={`${id}-hint`} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * RSVP: configuración de la confirmación (habilitada, fecha límite, mensaje, texto del botón,
 * acompañantes). No hay respuestas reales: la invitación las recibe en modo demostración.
 */
export function RsvpEditor({ section }: SectionEditorProps) {
  const { draft, api, errors } = useEditor();
  const { rsvp, event } = draft;
  const [deadline, setDeadline] = useState(rsvp.deadline ? (isoToZonedParts(rsvp.deadline, event.timezone)?.date ?? "") : "");
  if (!section) return null;

  const patch = (change: Partial<RSVPSettings>) => api.updateInvitation((d) => ({ rsvp: { ...d.rsvp, ...change } }));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeadingFields section={section} fields={["eyebrow", "title"]} />

      <ToggleRow id="rsvp-enabled" label="Aceptar confirmaciones" hint="Si lo desactivas, la invitación indica que la confirmación no está disponible." checked={rsvp.enabled} onChange={(enabled) => patch({ enabled })} />

      <TextAreaField id="rsvp-message" label="Mensaje" className="[&_textarea]:min-h-24" max={LIMITS.rsvpMessage} value={rsvp.message} error={errors["rsvp.message"]} onChange={(message) => patch({ message })} />

      <div className="grid gap-4 @md:grid-cols-2">
        <TextField id="rsvp-cta" label="Texto del botón" placeholder="Confirmar asistencia" max={LIMITS.rsvpCta} optional value={rsvp.ctaLabel ?? ""} error={errors["rsvp.ctaLabel"]} onChange={(ctaLabel) => patch({ ctaLabel })} />
        <TextField
          id="rsvp-deadline"
          label="Fecha límite"
          type="date"
          optional
          hint="Después de este día el formulario se cierra."
          value={deadline}
          onChange={(value) => {
            setDeadline(value);
            if (value === "") patch({ deadline: undefined });
            else {
              const iso = zonedPartsToIso(value, "23:59", event.timezone);
              if (iso) patch({ deadline: iso });
            }
          }}
        />
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          id="rsvp-companions"
          label="Acompañantes por invitación"
          type="number"
          min={0}
          max={10}
          value={String(rsvp.maxCompanions)}
          onChange={(value) => patch({ maxCompanions: Math.max(0, Math.min(10, Math.trunc(Number(value) || 0))) })}
        />
      </div>

      <ToggleRow id="rsvp-maybe" label="Permitir «Tal vez»" hint="Cuenta como pendiente en las métricas." checked={rsvp.allowMaybe} onChange={(allowMaybe) => patch({ allowMaybe })} />
      <ToggleRow id="rsvp-dietary" label="Preguntar por restricciones alimentarias" hint="Añade un campo opcional al formulario." checked={rsvp.askDietaryNotes} onChange={(askDietaryNotes) => patch({ askDietaryNotes })} />

      <p className="rounded-lu-card bg-lu-surface-tint/60 p-4 text-lu-sm text-lu-text-secondary">Modo demostración: las respuestas de tus invitados todavía no se guardan.</p>
    </div>
  );
}
