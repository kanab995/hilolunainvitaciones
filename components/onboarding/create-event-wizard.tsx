"use client";

import { Baby, CakeSlice, CalendarHeart, Check, GraduationCap, Gift, Heart, Sparkles, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createEventAction } from "@/app/(site)/dashboard/(workspace)/events/new/actions";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { Field, fieldErrorId, fieldHintId } from "@/components/ui/field";
import { Input, controlStyles } from "@/components/ui/input";
import { Heading, Text } from "@/components/ui/typography";
import { validateCreateEventInput, DEFAULT_TIMEZONE, isInPast, type CreateEventField } from "@/lib/events/create-event-input";
import { onboardingCopy } from "@/lib/events/copy";
import { eventTypeConfigs, onboardingEventTypes, type EventTypeIconKey, type OnboardingEventType } from "@/lib/events/event-types";
import { checkTemplateForEvent, templatesFor } from "@/lib/events/template-compat";
import { timezoneOptions } from "@/lib/events/timezones";
import { formatLongDate } from "@/lib/invitation/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Plantilla que se puede elegir en el alta (solo `implemented`; la miniatura es un asset aprobado). */
export interface WizardTemplate {
  slug: string;
  name: string;
  eventType: OnboardingEventType | string;
  thumbSrc?: string;
}

const icons: Record<EventTypeIconKey, LucideIcon> = { heart: Heart, sparkles: Sparkles, baby: Baby, cake: CakeSlice, gift: Gift, graduation: GraduationCap, calendar: CalendarHeart };

type Step = 1 | 2 | 3;
type Errors = Partial<Record<CreateEventField | "form", string>>;

const STEP_NAMES = onboardingCopy.steps;

/**
 * ASISTENTE de alta de un evento (D-28): 1 Tipo (+ plantilla) → 2 Detalles → 3 Resumen. Todo el estado vive en
 * el navegador y NO se escribe nada hasta el envío final (volver o cancelar no deja registros). El envío llama
 * a la Server Action, que valida de nuevo, crea todo en una transacción y redirige al editor. Doble clic:
 * el botón se desactiva mientras dura la petición.
 */
export function CreateEventWizard({ templates, initialTemplate, notice, planIntent }: { templates: readonly WizardTemplate[]; initialTemplate?: string; notice?: string; planIntent?: string }) {
  const [step, setStep] = useState<Step>(1);
  const [eventType, setEventType] = useState<OnboardingEventType | undefined>();
  const [templateSlug, setTemplateSlug] = useState<string | undefined>(initialTemplate);
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [errors, setErrors] = useState<Errors>({});
  // La plantilla requiere un plan superior a Gratis (D-32): se ofrece ver los planes en vez de un error genérico.
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  // Instante de apertura del asistente (referencia del aviso de fecha pasada; no cambia al escribir).
  const [openedAt] = useState(() => Date.now());

  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    // Al cambiar de paso el foco pasa al encabezado del paso (no en el primer render).
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  const config = eventType ? eventTypeConfigs[eventType] : undefined;
  const selectedTemplate = templates.find((template) => template.slug === templateSlug);
  const candidates = useMemo(() => (eventType ? templatesFor(catalogOf(templates), eventType) : []), [templates, eventType]);
  const eligibility = eventType ? checkTemplateForEvent(selectedTemplate ? catalogOf([selectedTemplate])[0] : undefined, eventType, config?.label ?? "") : undefined;
  const canContinueStep1 = Boolean(eventType && templateSlug && eligibility?.ok);

  const payload = { templateSlug, eventType, name1, name2, date, time, timezone };
  const validation = validateCreateEventInput(payload);
  const past = validation.ok ? isInPast(validation.value.startsAtIso, openedAt) : false;

  const chooseType = (type: OnboardingEventType) => {
    setEventType(type);
    setErrors({});
    // Si la plantilla elegida no sirve para este tipo y solo hay UNA compatible, se elige sola (un clic menos).
    const compatible = templatesFor(catalogOf(templates), type);
    const chosenFits = compatible.some((template) => template.slug === templateSlug);
    if (!chosenFits && compatible.length === 1 && compatible[0]) setTemplateSlug(compatible[0].slug);
  };

  const goToDetails = () => {
    if (canContinueStep1) setStep(2);
  };

  const goToConfirm = () => {
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setStep(3);
  };

  const submit = () => {
    if (submitting.current || pending) return;
    submitting.current = true;
    setNeedsUpgrade(false);
    startTransition(async () => {
      try {
        const result = await createEventAction(payload, planIntent);
        // Solo llega aquí si hubo un error (en éxito la acción redirige al editor).
        if (result.code === "invalid" && "fieldErrors" in result) {
          setErrors(result.fieldErrors);
          setStep(result.fieldErrors.eventType || result.fieldErrors.templateSlug ? 1 : 2);
        } else if (result.code === "plan_required") {
          setErrors({ form: result.message });
          setNeedsUpgrade(true);
        } else if (result.code === "template_unavailable") {
          setErrors({ form: result.message });
          setStep(1);
        } else {
          setErrors({ form: result.message });
        }
      } catch {
        setErrors({ form: onboardingCopy.errors.generic });
      } finally {
        submitting.current = false;
      }
    });
  };

  const formError = errors.form ? (
    needsUpgrade ? (
      <UpgradePrompt message={errors.form} />
    ) : (
      <p role="alert" className="text-lu-sm text-lu-error">
        {errors.form}
      </p>
    )
  ) : null;

  const error = (field: CreateEventField) => errors[field];
  const describedBy = (id: string, field: CreateEventField, hasHint = false) => (error(field) ? fieldErrorId(id) : hasHint ? fieldHintId(id) : undefined);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 md:mx-0">
      <ol aria-label="Progreso" className="flex items-center gap-2 text-lu-sm">
        {STEP_NAMES.map((name, index) => {
          const number = (index + 1) as Step;
          const active = number === step;
          const done = number < step;
          return (
            <li key={name} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full border text-lu-xs font-medium",
                  active && "border-lu-ink bg-lu-ink text-lu-on-ink",
                  done && "border-lu-brown-600 bg-lu-selected text-lu-text",
                  !active && !done && "border-lu-border bg-lu-surface text-lu-text-muted",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-3.5" /> : number}
              </span>
              <span className={cn(active ? "font-medium text-lu-text" : "text-lu-text-muted", "max-sm:sr-only")}>{name}</span>
              <span className="sr-only">{onboardingCopy.progressLabel(number, STEP_NAMES.length, name)}</span>
              {index < STEP_NAMES.length - 1 ? <span aria-hidden="true" className="h-px w-6 bg-lu-border sm:w-10" /> : null}
            </li>
          );
        })}
      </ol>

      <section className="flex flex-col gap-6 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-5 shadow-lu-card md:p-8">
        {notice && step === 1 ? (
          <p role="status" className="rounded-lu-input border border-lu-border-subtle bg-lu-surface-tint px-4 py-3 text-lu-sm text-lu-text-secondary">
            {notice}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-6">
            <Heading as="h2" size="title-lg" ref={headingRef} tabIndex={-1} className="outline-none">
              {onboardingCopy.type.heading}
            </Heading>

            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">{onboardingCopy.type.legend}</legend>
              <div className="grid grid-cols-1 gap-3 min-[26rem]:grid-cols-2">
                {onboardingEventTypes.map((type) => {
                  const item = eventTypeConfigs[type];
                  const Icon = icons[item.icon];
                  return (
                    <label
                      key={type}
                      className={cn(
                        "flex min-h-16 cursor-pointer items-center gap-3 rounded-lu-card border bg-lu-surface p-4 transition-colors duration-150 ease-lu-standard",
                        "hover:bg-lu-selected has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lu-brown-600 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-lu-canvas",
                        eventType === type ? "border-lu-brown-600 bg-lu-selected" : "border-lu-border-subtle",
                      )}
                    >
                      <input type="radio" name="eventType" value={type} checked={eventType === type} onChange={() => chooseType(type)} className="sr-only" />
                      <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lu-input bg-lu-surface-tint text-lu-brown-500">
                        <Icon className="size-5" strokeWidth={1.5} />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-lu-display text-lu-title-md leading-tight text-lu-text">{item.label}</span>
                        <span className="text-lu-xs text-lu-text-muted">{item.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {eventType ? (
              <div className="flex flex-col gap-3 border-t border-lu-border-subtle pt-6">
                <p className="text-lu-sm font-medium text-lu-text">{onboardingCopy.type.templateLabel}</p>

                {selectedTemplate && eligibility?.ok ? (
                  <div className="flex items-center gap-4">
                    <TemplateThumb template={selectedTemplate} />
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <p className="font-lu-display text-lu-title-md text-lu-text">{selectedTemplate.name}</p>
                      <Link href={routes.templates} className="rounded-lu-xs text-lu-sm text-lu-text-muted underline underline-offset-2 outline-none hover:text-lu-text focus-visible:ring-2 focus-visible:ring-lu-brown-600">
                        {onboardingCopy.type.changeTemplate}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedTemplate && eligibility && !eligibility.ok ? (
                      <p role="alert" className="text-lu-sm text-lu-error">
                        {eligibility.message}
                      </p>
                    ) : null}
                    {candidates.length > 0 ? (
                      <fieldset className="flex flex-col gap-3">
                        <legend className="sr-only">{onboardingCopy.type.pickTemplate}</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {candidates.map((candidate) => (
                            <label
                              key={candidate.slug}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-lu-card border bg-lu-surface p-3 transition-colors duration-150 ease-lu-standard hover:bg-lu-selected has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lu-brown-600",
                                templateSlug === candidate.slug ? "border-lu-brown-600 bg-lu-selected" : "border-lu-border-subtle",
                              )}
                            >
                              <input type="radio" name="templateSlug" value={candidate.slug} checked={templateSlug === candidate.slug} onChange={() => setTemplateSlug(candidate.slug)} className="sr-only" />
                              <TemplateThumb template={candidate} />
                              <span className="font-lu-display text-lu-title-md text-lu-text">{candidate.name}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ) : (
                      <div className="flex flex-col items-start gap-3">
                        <Text size="sm" tone="muted">
                          {onboardingCopy.type.noTemplates(config?.label ?? "")}
                        </Text>
                        <Button asChild variant="secondary">
                          <Link href={routes.templates}>{onboardingCopy.type.seeTemplates}</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {formError}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button asChild variant="ghost" size="lg" className="max-sm:w-full">
                <Link href={routes.templates}>{onboardingCopy.actions.backToTemplates}</Link>
              </Button>
              <Button size="lg" arrow disabled={!canContinueStep1} onClick={goToDetails} className="max-sm:w-full">
                {onboardingCopy.actions.next}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 && config ? (
          <form
            noValidate
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              goToConfirm();
            }}
          >
            <Heading as="h2" size="title-lg" ref={headingRef} tabIndex={-1} className="outline-none">
              {onboardingCopy.details.heading}
            </Heading>

            {config.names === "couple" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="ce-name1" label={onboardingCopy.details.name1} error={error("name1")}>
                  <Input id="ce-name1" tone="serif" autoComplete="off" maxLength={40} value={name1} invalid={Boolean(error("name1"))} aria-describedby={describedBy("ce-name1", "name1")} onChange={(event) => setName1(event.target.value)} placeholder="Andrea" />
                </Field>
                <Field htmlFor="ce-name2" label={onboardingCopy.details.name2} error={error("name2")}>
                  <Input id="ce-name2" tone="serif" autoComplete="off" maxLength={40} value={name2} invalid={Boolean(error("name2"))} aria-describedby={describedBy("ce-name2", "name2")} onChange={(event) => setName2(event.target.value)} placeholder="Fernando" />
                </Field>
              </div>
            ) : (
              <Field htmlFor="ce-name1" label={config.singleNameLabel} error={error("name1")}>
                <Input id="ce-name1" tone="serif" autoComplete="off" maxLength={40} value={name1} invalid={Boolean(error("name1"))} aria-describedby={describedBy("ce-name1", "name1")} onChange={(event) => setName1(event.target.value)} placeholder={config.singleNamePlaceholder} />
              </Field>
            )}
            <Text size="sm" tone="muted" className="-mt-3">
              {onboardingCopy.details.namesHint}
            </Text>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="ce-date" label={onboardingCopy.details.date} error={error("date")} hint={past ? onboardingCopy.details.pastDate : undefined}>
                <Input id="ce-date" type="date" value={date} invalid={Boolean(error("date"))} aria-describedby={error("date") ? fieldErrorId("ce-date") : past ? fieldHintId("ce-date") : undefined} onChange={(event) => setDate(event.target.value)} className="h-(--lu-h-md)" />
              </Field>
              <Field htmlFor="ce-time" label={onboardingCopy.details.time} error={error("time")}>
                <Input id="ce-time" type="time" value={time} invalid={Boolean(error("time"))} aria-describedby={describedBy("ce-time", "time")} onChange={(event) => setTime(event.target.value)} className="h-(--lu-h-md)" />
              </Field>
            </div>

            <Field htmlFor="ce-timezone" label={onboardingCopy.details.timezone} error={error("timezone")} hint={onboardingCopy.details.timezoneHint}>
              <select id="ce-timezone" value={timezone} aria-describedby={describedBy("ce-timezone", "timezone", true)} aria-invalid={error("timezone") ? true : undefined} onChange={(event) => setTimezone(event.target.value)} className={cn(controlStyles, "h-(--lu-h-md)")}>
                {timezoneOptions.some((option) => option.value === timezone) ? null : <option value={timezone}>{timezone}</option>}
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" size="lg" onClick={() => setStep(1)} className="max-sm:w-full">
                {onboardingCopy.actions.back}
              </Button>
              <Button type="submit" size="lg" arrow className="max-sm:w-full">
                {onboardingCopy.actions.next}
              </Button>
            </div>
          </form>
        ) : null}

        {step === 3 && validation.ok ? (
          <div className="flex flex-col gap-6">
            <Heading as="h2" size="title-lg" ref={headingRef} tabIndex={-1} className="outline-none">
              {onboardingCopy.confirm.heading}
            </Heading>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {selectedTemplate ? <TemplateThumb template={selectedTemplate} large /> : null}
              <dl aria-label={onboardingCopy.confirm.summaryLabel} className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-lu-base">
                <dt className="text-lu-text-muted">{onboardingCopy.confirm.event}</dt>
                <dd className="font-lu-display text-lu-title-md text-lu-text">{validation.value.title}</dd>
                <dt className="text-lu-text-muted">{onboardingCopy.confirm.date}</dt>
                <dd className="text-lu-text">
                  {formatLongDate(validation.value.startsAtIso, validation.value.timezone)} · {validation.value.time}
                </dd>
                <dt className="text-lu-text-muted">{onboardingCopy.confirm.template}</dt>
                <dd className="text-lu-text">{selectedTemplate?.name}</dd>
                <dt className="text-lu-text-muted">{onboardingCopy.confirm.type}</dt>
                <dd className="text-lu-text">{config?.label}</dd>
              </dl>
            </div>
            <Text size="sm" tone="muted">
              {onboardingCopy.confirm.draftNote}
            </Text>

            {formError}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => setStep(2)} className="max-sm:w-full">
                {onboardingCopy.actions.back}
              </Button>
              <Button type="button" size="lg" loading={pending} arrow onClick={submit} className="max-sm:w-full">
                {pending ? onboardingCopy.actions.creating : onboardingCopy.actions.create}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Adapta las plantillas del asistente (todas `implemented`) al formato que espera la lógica de compatibilidad. */
const catalogOf = (items: readonly WizardTemplate[]) => items.map((item) => ({ ...item, status: "implemented" as const, eventType: item.eventType as OnboardingEventType }));

/** Miniatura de la plantilla (asset aprobado de su portada; sin imagen, un fondo neutro). No renderiza la invitación. */
function TemplateThumb({ template, large = false }: { template: WizardTemplate; large?: boolean }) {
  return (
    <span aria-hidden="true" className={cn("relative shrink-0 overflow-hidden rounded-lu-input border border-lu-border-subtle bg-lu-surface-tint", large ? "h-36 w-24 sm:h-40 sm:w-28" : "h-20 w-14")}>
      {template.thumbSrc ? <Image src={template.thumbSrc} alt="" fill sizes={large ? "112px" : "56px"} className="object-cover object-top" /> : null}
    </span>
  );
}
