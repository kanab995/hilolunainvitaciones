"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { submitGeneralRsvp } from "@/app/(invitation)/i/[slug]/actions";
import { invButtonClass } from "@/components/invitation/primitives/inv-button";
import { invitationCopy } from "@/lib/invitation/copy";
import { getRsvpAvailability } from "@/lib/invitation/rsvp";
import { cn } from "@/lib/utils";
import type { RSVPSettings } from "@/types/invitation";
import type { PublicRsvpStatus } from "@/types/public-rsvp";

const copy = invitationCopy.rsvp;

const field =
  "h-11 w-full rounded-(--inv-radius-image) border border-inv-line bg-inv-bg px-3 font-inv-body text-sm text-inv-ink outline-none focus-visible:ring-2 focus-visible:ring-inv-accent";

/**
 * Confirmación de asistencia PERSISTENTE del enlace GENERAL (D-40: `/i/<slug>`, SIN `?guest=`). A
 * diferencia de `PersonalizedRsvp` (identifica a un invitado que ya existía) y de `RsvpPanel` (demo,
 * nunca guarda nada), esta SÍ guarda de verdad: autorregistra un invitado nuevo en el servidor
 * (`submitGeneralRsvp` → `server/services/general-rsvp.ts`). Mismos tokens `--inv-*` de la plantilla
 * que los otros dos; sin cuenta ni Clerk. Sin identidad entre envíos: no hay "tu respuesta actual" que
 * recuperar (sería necesaria una cookie u otro mecanismo, fuera de alcance de D-40).
 */
export function GeneralRsvpForm({
  invitationSlug,
  settings,
  serverNowMs,
  buttonVariant,
}: {
  invitationSlug: string;
  settings: RSVPSettings;
  serverNowMs: number;
  buttonVariant: "solid" | "outline";
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitGeneralRsvp, null);
  const [status, setStatus] = useState<PublicRsvpStatus | "">("");
  const [companions, setCompanions] = useState(0);
  const [dietaryNotes, setDietaryNotes] = useState("");
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.ok) doneRef.current?.focus();
  }, [state]);

  const availability = getRsvpAvailability(settings, serverNowMs);
  if (availability === "disabled") return <p className="text-center font-inv-body text-sm text-inv-ink-muted">{copy.disabled}</p>;
  if (availability === "closed") return <p className="text-center font-inv-body text-sm text-inv-ink-muted">{copy.closed}</p>;

  if (state?.ok) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" data-rsvp-done className="flex flex-col items-center gap-1 text-center outline-none">
        <p className="font-inv-display text-2xl text-inv-ink italic">{copy.thanks}</p>
        <p className="font-inv-body text-sm text-inv-ink-muted">{state.message}</p>
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
      </div>
    );
  }

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const options: { value: PublicRsvpStatus; label: string }[] = [
    { value: "ATTENDING", label: copy.yes },
    { value: "DECLINED", label: copy.no },
    ...(settings.allowMaybe ? [{ value: "MAYBE" as const, label: copy.maybe }] : []),
  ];

  return (
    <form id={formId} action={formAction} data-rsvp-form className="flex w-full flex-col gap-4 text-left">
      <input type="hidden" name="slug" value={invitationSlug} />

      <label className="flex flex-col gap-1.5 font-inv-body text-xs text-inv-ink-muted">
        {copy.name}
        <input name="name" className={field} autoComplete="name" aria-invalid={errors.name ? true : undefined} />
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
                status === option.value ? "border-inv-button-bg bg-inv-button-bg text-inv-button-fg" : "border-inv-line bg-inv-bg",
              )}
            >
              <input type="radio" name="status" value={option.value} checked={status === option.value} onChange={() => setStatus(option.value)} className="sr-only" />
              {option.label}
            </label>
          ))}
        </div>
        {errors.status ? <span className="font-inv-body text-xs text-inv-ink">{errors.status}</span> : null}
      </fieldset>

      {status === "ATTENDING" && settings.maxCompanions > 0 ? (
        <label className="flex flex-col gap-1.5 font-inv-body text-xs text-inv-ink-muted">
          {copy.companions}
          <input
            type="number"
            name="companions"
            min={0}
            max={settings.maxCompanions}
            className={field}
            value={companions}
            aria-invalid={errors.attendeeCount ? true : undefined}
            onChange={(event) => setCompanions(Number(event.target.value))}
          />
          {errors.attendeeCount ? <span className="text-inv-ink">{errors.attendeeCount}</span> : null}
        </label>
      ) : null}

      {settings.askDietaryNotes ? (
        <label className="flex flex-col gap-1.5 font-inv-body text-xs text-inv-ink-muted">
          {copy.dietary}
          <input name="dietaryNotes" className={field} value={dietaryNotes} onChange={(event) => setDietaryNotes(event.target.value)} />
        </label>
      ) : null}

      {state && !state.ok && Object.keys(errors).length === 0 ? (
        <p role="alert" className="font-inv-body text-xs text-inv-ink">
          {state.message}
        </p>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {pending ? copy.submitting : ""}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(invButtonClass(buttonVariant), pending && "opacity-70")}>
          {pending ? copy.submitting : copy.submit}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className={invButtonClass("outline")}>
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}
