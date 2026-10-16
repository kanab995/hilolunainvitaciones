import { Switch } from "@/components/ui/switch";

/** Interruptor con etiqueta y explicación (RSVP, música): la etiqueta y la pista quedan asociadas al control para lectores de pantalla. */
export function ToggleRow({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
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
      <Switch id={id} aria-describedby={`${id}-hint`} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
