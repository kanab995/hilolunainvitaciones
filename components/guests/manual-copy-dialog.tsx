"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { guestsCopy } from "@/lib/guests/copy";

/**
 * Plan B cuando el navegador no permite copiar solo (permiso denegado o sin contexto seguro): muestra el
 * enlace personalizado en un campo de solo lectura, ya seleccionado, para copiarlo a mano.
 */
export function ManualCopyDialog({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const copy = guestsCopy.manualCopy;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description(name)}</DialogDescription>
        </DialogHeader>
        <Input readOnly aria-label={copy.label(name)} value={url} onFocus={(event) => event.currentTarget.select()} autoFocus />
        <DialogFooter>
          <DialogClose asChild>
            <Button>{copy.close}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
