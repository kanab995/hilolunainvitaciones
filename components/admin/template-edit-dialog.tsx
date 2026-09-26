"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { controlStyles } from "@/components/ui/input";
import { updateTemplateAction, type TemplateActionState } from "@/app/(site)/admin/templates/actions";
import { adminCopy } from "@/lib/admin/copy";
import { TEMPLATE_PUBLICATION_VALUES, type TemplatePublicationValue } from "@/lib/admin/options";
import { PLAN_IDS, planLabel, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import type { AdminTemplateDto } from "@/server/admin/dto";

const copy = adminCopy.templates;
const initial: TemplateActionState = { status: "idle" };

/** ¿Qué confirmaciones exige el cambio? Ocultar (salir de «Visible») y cambiar el plan mínimo; hacer visible una plantilla no pide confirmación. */
export function requiredConfirmations(template: Pick<AdminTemplateDto, "publicationStatus" | "minimumPlan" | "name">, next: { publicationStatus: TemplatePublicationValue; minimumPlan: PlanId }): string[] {
  const notes: string[] = [];
  if (template.publicationStatus === "PUBLISHED" && next.publicationStatus !== "PUBLISHED") notes.push(copy.hideNote);
  if (next.minimumPlan !== template.minimumPlan) notes.push(copy.planNote);
  return notes;
}

/**
 * Edición de UNA plantilla: visibilidad en el catálogo y plan mínimo del evento (nada más). Los cambios que afectan al catálogo pasan por una
 * confirmación dentro del diálogo («¿Ocultar Magnolia del catálogo?»: «Las invitaciones ya existentes seguirán funcionando.»; «Este cambio solo
 * afectará nuevas selecciones.»): sin `window.confirm`. El servidor vuelve a comprobar el rol ADMIN y valida los valores.
 */
export function TemplateEditDialog({ template }: { template: AdminTemplateDto }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [publicationStatus, setPublicationStatus] = useState<TemplatePublicationValue>(template.publicationStatus);
  const [minimumPlan, setMinimumPlan] = useState<PlanId>(template.minimumPlan);
  const [hint, setHint] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(updateTemplateAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const idBase = `template-${template.id}`;

  // Al guardarse, se cierra el diálogo (patrón «derivar estado del render»: sin efecto).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "saved") setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStep("form");
      setPublicationStatus(template.publicationStatus);
      setMinimumPlan(template.minimumPlan);
      setHint(null);
    }
  }

  const changed = publicationStatus !== template.publicationStatus || minimumPlan !== template.minimumPlan;
  const notes = requiredConfirmations(template, { publicationStatus, minimumPlan });
  const hiding = template.publicationStatus === "PUBLISHED" && publicationStatus !== "PUBLISHED";

  function next() {
    if (!changed) return setHint(copy.noChanges);
    setHint(null);
    if (notes.length > 0) return setStep("confirm");
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" aria-label={copy.editTitle(template.name)}>
            {copy.edit}
          </Button>
        </DialogTrigger>
        <DialogContent size="md">
          <form ref={formRef} action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="publicationStatus" value={publicationStatus} />
            <input type="hidden" name="minimumPlan" value={minimumPlan} />

            {step === "form" ? (
              <>
                <DialogHeader>
                  <DialogTitle>{copy.editTitle(template.name)}</DialogTitle>
                  <DialogDescription>{copy.editDescription}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${idBase}-visibility`} className="text-lu-sm font-medium text-lu-text">
                    {copy.visibilityLabel}
                  </label>
                  <select id={`${idBase}-visibility`} value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as TemplatePublicationValue)} className={cn(controlStyles, "h-(--lu-h-md) font-lu-sans text-lu-base")}>
                    {TEMPLATE_PUBLICATION_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {copy.publicationStatus[value]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${idBase}-plan`} className="text-lu-sm font-medium text-lu-text">
                    {copy.minimumPlanLabel}
                  </label>
                  <select id={`${idBase}-plan`} value={minimumPlan} onChange={(event) => setMinimumPlan(event.target.value as PlanId)} aria-describedby={`${idBase}-plan-hint`} className={cn(controlStyles, "h-(--lu-h-md) font-lu-sans text-lu-base")}>
                    {PLAN_IDS.map((value) => (
                      <option key={value} value={value}>
                        {planLabel(value)}
                      </option>
                    ))}
                  </select>
                  <p id={`${idBase}-plan-hint`} className="text-lu-sm text-lu-text-muted">
                    {copy.minimumPlanHint}
                  </p>
                </div>

                {hint || (state.status === "error" && state.message) ? (
                  <p role="alert" className="text-lu-sm text-lu-error">
                    {hint ?? state.message}
                  </p>
                ) : null}

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">{copy.cancel}</Button>
                  </DialogClose>
                  <Button onClick={next} loading={pending}>
                    {pending ? copy.saving : copy.save}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{hiding ? copy.hideConfirm(template.name) : copy.confirmTitle}</DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex flex-col gap-1.5">
                      {notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </DialogDescription>
                </DialogHeader>
                {state.status === "error" && state.message ? (
                  <p role="alert" className="text-lu-sm text-lu-error">
                    {state.message}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setStep("form")} disabled={pending}>
                    {copy.back}
                  </Button>
                  <Button type="submit" loading={pending}>
                    {pending ? copy.saving : copy.confirm}
                  </Button>
                </DialogFooter>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
      {state.status === "saved" && state.message ? (
        <p role="status" className="text-lu-xs text-lu-text-muted">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
