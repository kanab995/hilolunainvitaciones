"use client";

import { useActionState, useEffect } from "react";
import { deleteGuest } from "@/app/(site)/dashboard/(workspace)/events/[id]/guests/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { guestsCopy } from "@/lib/guests/copy";
import type { GuestRow } from "@/types/guests";

/** Confirmación para eliminar un invitado (Dialog del Design System, con foco atrapado y Escape). */
export function DeleteGuestDialog({ eventId, guest, onClose }: { eventId: string; guest: GuestRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(deleteGuest, null);
  const copy = guestsCopy.delete;

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{copy.title(guest.name)}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="guestId" value={guest.id} />
          {state && !state.ok ? (
            <p role="alert" className="rounded-lu-input border border-lu-error bg-lu-error-bg px-3.5 py-2.5 text-lu-sm text-lu-text">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{guestsCopy.form.cancel}</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
