"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { submitPublicRsvp } from "@/app/(invitation)/i/[slug]/actions";
import { invButtonClass } from "@/components/invitation/primitives/inv-button";
import { invitationCopy } from "@/lib/invitation/copy";
import { getRsvpAvailability } from "@/lib/invitation/rsvp";
import { cn } from "@/lib/utils";
import type { RSVPSettings } from "@/types/invitation";
import type { Personalization, PublicCurrentRsvp, PublicRsvpQuestion, PublicRsvpResult, PublicRsvpStatus } from "@/types/public-rsvp";

const copy = invitationCopy.guestRsvp;
const MESSAGE_MAX = 500;

const field =
  "min-h-12 w-full rounded-(--inv-radius-image) border border-inv-line bg-inv-bg px-3.5 font-inv-body text-base text-inv-ink outline-none focus-visible:ring-2 focus-visible:ring-inv-accent aria-[invalid=true]:border-inv-ink";
const legend = "mb-1 font-inv-body text-sm text-inv-ink-muted";
const errorText = "font-inv-body text-sm text-inv-ink";

type GuestPersonalization = Extract<Personalization, { kind: "guest" }>;

function summaryText(current: PublicCurrentRsvp): string {
  return current.status === "ATTENDING" ? copy.currentAttending(current.attendeeCount) : current.status === "DECLINED" ? copy.currentDeclined : copy.currentMaybe;
}

/** Opción de respuesta en forma de "chip" táctil (radio real, accesible por teclado). */
function ChoiceChip({ name, value, label, checked, onChange }: { name: string; value: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-(--inv-radius-button) border px-5 text-center font-inv-body text-base text-inv-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inv-accent",
        checked ? "border-inv-button-bg bg-inv-button-bg text-inv-button-fg" : "border-inv-line bg-inv-bg",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

function QuestionField({ question, value, onChange, error, describedBy }: { question: PublicRsvpQuestion; value: string; onChange: (value: string) => void; error: boolean; describedBy?: string }) {
  const id = useId();
  const name = `answer:${question.id}`;
  if (question.type === "TEXT") {
    return (
      <label className="flex flex-col gap-1.5 font-inv-body text-sm text-inv-ink-muted" htmlFor={id}>
        {question.label}
        <input id={id} name={name} className={field} value={value} maxLength={500} required={question.required} aria-invalid={error || undefined} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  const options = question.type === "BOOLEAN" ? [{ value: "yes", label: copy.yesNo.yes }, { value: "no", label: copy.yesNo.no }] : question.options.map((option) => ({ value: option, label: option }));
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={describedBy}>
      <legend className={legend}>{question.label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ChoiceChip key={option.value} name={name} value={option.value} label={option.label} checked={value === option.value} onChange={() => onChange(option.value)} />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Confirmación de asistencia PERSISTENTE de una invitación personalizada (`?guest=<token>` válido). Isla
 * cliente con los tokens `--inv-*` de la plantilla (no usa componentes del dashboard). Sin cuenta ni
 * Clerk: la acción de servidor recibe el `slug` y el `token` que la propia URL ya contiene y es ella quien
 * decide a quién se responde, el máximo de asistentes, las preguntas y el plazo.
 * Estados: resumen de la respuesta actual → formulario (precargado) → agradecimiento.
 */
export function PersonalizedRsvp({
  personalization,
  settings,
  serverNowMs,
  buttonVariant,
}: {
  personalization: GuestPersonalization;
  settings: RSVPSettings;
  serverNowMs: number;
  buttonVariant: "solid" | "outline";
}) {
  const { guest, questions, invitationSlug, token } = personalization;
  const uid = useId();
  const [state, formAction, pending] = useActionState(submitPublicRsvp, null);
  const [editing, setEditing] = useState(false);
  const doneRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  // La respuesta más reciente: la que ya estaba guardada o la última que se guardó en esta sesión.
  const [saved, setSaved] = useState<PublicCurrentRsvp | undefined>(guest.currentRsvp);

  const [status, setStatus] = useState<PublicRsvpStatus | "">(saved?.status ?? "");
  const [attendees, setAttendees] = useState(Math.min(Math.max(saved?.attendeeCount ?? 1, 1), 1 + guest.maxCompanions));
  const [message, setMessage] = useState(guest.currentRsvp?.message ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({ ...(guest.currentRsvp?.answers ?? {}) });

  // Un resultado nuevo y correcto: lo enviado pasa a ser la respuesta vigente (se ajusta durante el render,
  // el patrón recomendado por React para derivar estado de un valor que cambia).
  const [handled, setHandled] = useState<PublicRsvpResult | null>(null);
  if (state?.ok && state !== handled) {
    setHandled(state);
    setSaved({ status: state.status, attendeeCount: state.attendeeCount, message: message.trim() || null, answers });
    setEditing(false);
  }
  // Tras guardar, el foco va al mensaje de confirmación (lo anuncian los lectores de pantalla).
  useEffect(() => {
    if (state?.ok) doneRef.current?.focus();
  }, [state]);

  const availability = getRsvpAvailability(settings, serverNowMs);
  const open = availability === "open";
  const firstName = guest.displayName.trim().split(" ")[0] ?? guest.displayName;
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const maxPeople = 1 + guest.maxCompanions;

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-2 text-center font-inv-body text-sm text-inv-ink-muted">
        {saved ? <p className="text-inv-ink">{summaryText(saved)}</p> : null}
        <p>{availability === "closed" ? invitationCopy.rsvp.closed : invitationCopy.rsvp.disabled}</p>
      </div>
    );
  }

  // Agradecimiento tras guardar.
  if (state?.ok && !editing) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" data-rsvp-done className="flex flex-col items-center gap-3 text-center outline-none">
        <p className="font-inv-display text-2xl text-inv-ink italic">{copy.thanks(firstName)}</p>
        <p className="font-inv-body text-base text-inv-ink-muted">{state.message}</p>
        {saved ? <p className="font-inv-body text-sm text-inv-ink">{summaryText(saved)}</p> : null}
        <button type="button" onClick={() => setEditing(true)} className={invButtonClass("outline")}>
          {copy.change}
        </button>
      </div>
    );
  }

  // Resumen de la respuesta que ya estaba guardada.
  if (saved && !editing) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" data-rsvp-current>
        <p className="font-inv-body text-xs tracking-[0.2em] text-inv-ink-muted uppercase">{copy.currentTitle}</p>
        <p ref={summaryRef} className="font-inv-display text-2xl text-inv-ink italic">
          {summaryText(saved)}
        </p>
        <button type="button" onClick={() => setEditing(true)} className={invButtonClass(buttonVariant)}>
          {copy.change}
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  const describedBy = (key: string, has: boolean) => (has ? `${uid}-${key}-error` : undefined);
  const statusOptions: { value: PublicRsvpStatus; label: string }[] = [
    { value: "ATTENDING", label: copy.yes },
    { value: "DECLINED", label: copy.no },
    ...(settings.allowMaybe ? [{ value: "MAYBE" as const, label: copy.maybe }] : []),
  ];

  return (
    <form action={formAction} noValidate data-rsvp-form className="flex w-full flex-col gap-5 text-left">
      <input type="hidden" name="slug" value={invitationSlug} />
      <input type="hidden" name="guest" value={token} />

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy("status", Boolean(errors.status))}>
        <legend className={legend}>{copy.question}</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {statusOptions.map((option) => (
            <ChoiceChip key={option.value} name="status" value={option.value} label={option.label} checked={status === option.value} onChange={() => setStatus(option.value)} />
          ))}
        </div>
        {errors.status ? (
          <p id={`${uid}-status-error`} className={errorText}>
            {errors.status}
          </p>
        ) : null}
      </fieldset>

      {status === "ATTENDING" && guest.maxCompanions > 0 ? (
        <label className="flex flex-col gap-1.5 font-inv-body text-sm text-inv-ink-muted" htmlFor={`${uid}-attendees`}>
          {copy.attendees}
          <select id={`${uid}-attendees`} name="attendeeCount" className={field} value={attendees} aria-invalid={errors.attendeeCount ? true : undefined} aria-describedby={describedBy("attendees", Boolean(errors.attendeeCount))} onChange={(event) => setAttendees(Number(event.target.value))}>
            {Array.from({ length: maxPeople }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {copy.person(count)}
              </option>
            ))}
          </select>
          <span className="text-xs">{copy.attendeesHint}</span>
          {errors.attendeeCount ? (
            <span id={`${uid}-attendees-error`} className={errorText}>
              {errors.attendeeCount}
            </span>
          ) : null}
        </label>
      ) : null}

      {questions.map((question) => (
        <QuestionField key={question.id} question={question} value={answers[question.id] ?? ""} error={Boolean(errors.answers)} describedBy={describedBy("answers", Boolean(errors.answers))} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
      ))}
      {errors.answers ? (
        <p id={`${uid}-answers-error`} className={errorText}>
          {errors.answers}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 font-inv-body text-sm text-inv-ink-muted" htmlFor={`${uid}-message`}>
        <span>
          {copy.message} <span className="text-xs">{copy.messageOptional}</span>
        </span>
        <textarea
          id={`${uid}-message`}
          name="message"
          rows={4}
          maxLength={MESSAGE_MAX}
          value={message}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy("message", Boolean(errors.message))}
          onChange={(event) => setMessage(event.target.value)}
          className={cn(field, "py-3 leading-relaxed")}
        />
        <span className="text-right text-xs tabular-nums">
          {message.length} / {MESSAGE_MAX}
        </span>
        {errors.message ? (
          <span id={`${uid}-message-error`} className={errorText}>
            {errors.message}
          </span>
        ) : null}
      </label>

      {state && !state.ok && Object.keys(errors).length === 0 ? (
        <p role="alert" className={errorText}>
          {state.message}
        </p>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {pending ? copy.submitting : ""}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(invButtonClass(buttonVariant, "lg"), "w-full sm:w-auto", pending && "opacity-70")}>
          {pending ? copy.submitting : copy.submit}
        </button>
        {saved ? (
          <button type="button" onClick={() => setEditing(false)} disabled={pending} className={cn(invButtonClass("outline", "lg"), "w-full sm:w-auto")}>
            {copy.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
