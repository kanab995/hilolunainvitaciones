"use client";

import { ArrowRight } from "lucide-react";
import { useId, useState } from "react";
import { invButtonClass } from "@/components/invitation/primitives/inv-button";
import { invitationCopy } from "@/lib/invitation/copy";
import { getRsvpAvailability, validateRsvp, type RsvpAttendance, type RsvpErrors, type RsvpInput } from "@/lib/invitation/rsvp";
import { cn } from "@/lib/utils";
import type { RSVPSettings } from "@/types/invitation";

const copy = invitationCopy.rsvp;

const field =
  "h-11 w-full rounded-(--inv-radius-image) border border-inv-line bg-inv-bg px-3 font-inv-body text-sm text-inv-ink outline-none focus-visible:ring-2 focus-visible:ring-inv-accent";

/**
 * Isla cliente de la confirmación de asistencia. Aplica los `RSVPSettings` de la invitación
 * (habilitado, plazo, "tal vez", acompañantes, restricciones) con `lib/invitation/rsvp.ts`. Es
 * GENÉRICA: no sabe qué plantilla la contiene, solo recibe el estilo del botón.
 * Todavía no hay persistencia (sin BD ni servidor): al enviar solo muestra el agradecimiento en
 * modo demostración. TODO: conectar con la acción de servidor cuando exista el backend de RSVP.
 */
export function RsvpPanel({
  settings,
  serverNowMs,
  buttonVariant,
}: {
  settings: RSVPSettings;
  serverNowMs: number;
  buttonVariant: "solid" | "outline";
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<RsvpInput | null>(null);
  const [errors, setErrors] = useState<RsvpErrors>({});
  const [input, setInput] = useState<RsvpInput>({ name: "", attendance: "", companions: 0, dietaryNotes: "" });

  const availability = getRsvpAvailability(settings, serverNowMs);
  const demoNote = (
    <p className="max-w-[20rem] font-inv-body text-[0.6875rem] leading-relaxed tracking-[0.12em] text-balance text-inv-ink-muted uppercase">
      {copy.demoBadge} · {copy.demoNote}
    </p>
  );
  if (availability === "disabled") return <p className="text-center font-inv-body text-sm text-inv-ink-muted">{copy.disabled}</p>;
  if (availability === "closed") return <p className="text-center font-inv-body text-sm text-inv-ink-muted">{copy.closed}</p>;

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-1 text-center">
        <p className="font-inv-display text-2xl text-inv-ink italic">{copy.thanks}</p>
        {demoNote}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-4">
        <button type="button" aria-expanded={false} aria-controls={formId} onClick={() => setOpen(true)} className={invButtonClass(buttonVariant, "lg")}>
          {settings.ctaLabel?.trim() || copy.cta}
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </button>
        {demoNote}
      </div>
    );
  }

  const options: { value: RsvpAttendance; label: string }[] = [
    { value: "yes", label: copy.yes },
    { value: "no", label: copy.no },
    ...(settings.allowMaybe ? [{ value: "maybe" as const, label: copy.maybe }] : []),
  ];

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const found = validateRsvp(settings, input);
        setErrors(found);
        if (Object.keys(found).length === 0) setSent(input);
      }}
      className="flex w-full flex-col gap-4 text-left"
    >
      <label className="flex flex-col gap-1.5 font-inv-body text-xs text-inv-ink-muted">
        {copy.name}
        <input
          className={field}
          value={input.name}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
        />
        {errors.name ? <span className="text-inv-ink">{errors.name}</span> : null}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-inv-body text-xs text-inv-ink-muted">{copy.attendance}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "inline-flex h-10 cursor-pointer items-center rounded-(--inv-radius-button) border px-4 font-inv-body text-sm text-inv-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inv-accent",
                input.attendance === option.value ? "border-inv-button-bg bg-inv-button-bg text-inv-button-fg" : "border-inv-line bg-inv-bg",
              )}
            >
              <input
                type="radio"
                name={`${formId}-attendance`}
                value={option.value}
                checked={input.attendance === option.value}
                onChange={() => setInput({ ...input, attendance: option.value })}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {errors.attendance ? <span className="font-inv-body text-xs text-inv-ink">{errors.attendance}</span> : null}
      </fieldset>

      {settings.maxCompanions > 0 ? (
        <label className="flex flex-col gap-1.5 font-inv-body text-xs text-inv-ink-muted">
          {copy.companions}
          <input
            type="number"
            min={0}
            max={settings.maxCompanions}
            className={field}
            value={input.companions}
            aria-invalid={errors.companions ? true : undefined}
            onChange={(e) => setInput({ ...input, companions: Number(e.target.value) })}
          />
          {errors.companions ? <span className="text-inv-ink">{errors.companions}</span> : null}
        </label>
      ) : null}

      {settings.askDietaryNotes ? (
        <label className="flex flex-col gap-1.5 font-inv-body text-xs text-inv-ink-muted">
          {copy.dietary}
          <input className={field} value={input.dietaryNotes ?? ""} onChange={(e) => setInput({ ...input, dietaryNotes: e.target.value })} />
        </label>
      ) : null}

      {demoNote}

      <div className="flex gap-3">
        <button type="submit" className={invButtonClass(buttonVariant)}>
          {copy.submit}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={invButtonClass("outline")}>
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}
