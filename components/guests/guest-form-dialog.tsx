"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createGuest, updateGuest } from "@/app/(site)/dashboard/(workspace)/events/[id]/guests/actions";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, fieldErrorId, fieldHintId } from "@/components/ui/field";
import { controlStyles, Input } from "@/components/ui/input";
import { guestsCopy, maybeOption, statusOptions } from "@/lib/guests/copy";
import { GUEST_LIMITS, NEW_GROUP_VALUE } from "@/lib/guests/limits";
import { cn } from "@/lib/utils";
import type { GuestGroupOption, GuestRow } from "@/types/guests";

/**
 * Formulario ÚNICO de alta y edición de invitados (mismos campos, mismo mensaje de error, misma
 * validación —la real es la del servidor—). Con `guest` edita; sin él, crea. El formulario solo envía
 * los campos del invitado y la referencia del evento: el propietario lo decide el servidor.
 */
export function GuestFormDialog({ eventId, groups, guest, onClose }: { eventId: string; groups: readonly GuestGroupOption[]; guest?: GuestRow; onClose: () => void }) {
  const editing = guest !== undefined;
  const [state, formAction, pending] = useActionState(editing ? updateGuest : createGuest, null);
  const uid = useId();
  const [groupValue, setGroupValue] = useState(guest?.groupId ?? "");
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const copy = guestsCopy.form;

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  const id = (name: string) => `${uid}-${name}`;
  const describedBy = (name: string, hint?: boolean) => [hint ? fieldHintId(id(name)) : undefined, errors[name as keyof typeof errors] ? fieldErrorId(id(name)) : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? copy.editTitle : copy.createTitle}</DialogTitle>
          <DialogDescription>{editing ? copy.editDescription : copy.createDescription}</DialogDescription>
        </DialogHeader>

        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="eventId" value={eventId} />
          {editing ? <input type="hidden" name="guestId" value={guest.id} /> : null}

          {/* Cupo del plan del evento lleno (D-32): aviso sereno con «Mejorar evento» en lugar de un error genérico. */}
          {state && !state.ok && state.code === "limit_reached" ? <UpgradePrompt message={state.message} eventId={eventId} /> : null}

          {state && !state.ok && !state.fieldErrors && state.code !== "limit_reached" ? (
            <p role="alert" className="rounded-lu-input border border-lu-error bg-lu-error-bg px-3.5 py-2.5 text-lu-sm text-lu-text">
              {state.message}
            </p>
          ) : null}

          <Field htmlFor={id("name")} label={copy.name} error={errors.name}>
            <Input id={id("name")} name="name" required maxLength={GUEST_LIMITS.name} defaultValue={guest?.name ?? ""} invalid={Boolean(errors.name)} aria-describedby={describedBy("name")} autoComplete="off" autoFocus />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor={id("email")} label={copy.email} optional error={errors.email}>
              <Input id={id("email")} name="email" type="email" inputMode="email" defaultValue={guest?.email ?? ""} invalid={Boolean(errors.email)} aria-describedby={describedBy("email")} autoComplete="off" />
            </Field>
            <Field htmlFor={id("phone")} label={copy.phone} optional error={errors.phone}>
              <Input id={id("phone")} name="phone" type="tel" inputMode="tel" defaultValue={guest?.phone ?? ""} invalid={Boolean(errors.phone)} aria-describedby={describedBy("phone")} autoComplete="off" />
            </Field>
          </div>

          <Field htmlFor={id("groupId")} label={copy.group} optional error={errors.groupId}>
            <select
              id={id("groupId")}
              name="groupId"
              value={groupValue}
              onChange={(event) => setGroupValue(event.target.value)}
              aria-invalid={errors.groupId ? true : undefined}
              aria-describedby={describedBy("groupId")}
              className={cn(controlStyles, "h-(--lu-h-md) font-lu-sans text-lu-base")}
            >
              <option value="">{copy.noGroup}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
              <option value={NEW_GROUP_VALUE}>{copy.newGroup}</option>
            </select>
          </Field>

          {groupValue === NEW_GROUP_VALUE ? (
            <Field htmlFor={id("newGroupName")} label={copy.newGroupName} error={errors.newGroupName}>
              <Input id={id("newGroupName")} name="newGroupName" maxLength={GUEST_LIMITS.groupName} placeholder={copy.newGroupPlaceholder} invalid={Boolean(errors.newGroupName)} aria-describedby={describedBy("newGroupName")} autoComplete="off" />
            </Field>
          ) : null}

          <div className={cn("grid gap-4", editing && "sm:grid-cols-2")}>
            <Field htmlFor={id("maxCompanions")} label={copy.companions} hint={copy.companionsHint} error={errors.maxCompanions}>
              <Input
                id={id("maxCompanions")}
                name="maxCompanions"
                type="number"
                inputMode="numeric"
                min={0}
                max={GUEST_LIMITS.maxCompanions}
                step={1}
                defaultValue={guest?.maxCompanions ?? 0}
                invalid={Boolean(errors.maxCompanions)}
                aria-describedby={describedBy("maxCompanions", true)}
              />
            </Field>
            {editing ? (
              <Field htmlFor={id("status")} label={copy.status} error={errors.status}>
                <select id={id("status")} name="status" defaultValue={guest.status} aria-describedby={describedBy("status")} className={cn(controlStyles, "h-(--lu-h-md) font-lu-sans text-lu-base")}>
                  {[...statusOptions, ...(guest.status === "MAYBE" ? [maybeOption] : [])].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{copy.cancel}</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {editing ? copy.save : copy.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
