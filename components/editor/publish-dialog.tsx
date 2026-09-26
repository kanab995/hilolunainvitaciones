"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { displayShareUrl, shareUrl } from "@/lib/dashboard/share";
import { publishCopy } from "@/lib/publishing/copy";
import type { PublicationState } from "@/types/published";

/**
 * Diálogo de PUBLICACIÓN del editor (D-29). Cuatro casos, con el texto acordado:
 *  - primera vez (`draft`): «Tu invitación estará disponible públicamente.» + URL + «Publicar invitación»;
 *  - con cambios (`changes`): «¿Publicar los cambios?» + «Publicar cambios»;
 *  - recién publicada (`justPublished`): enlace y «Abrir invitación»;
 *  - sin base de datos (`demo`): aviso de demostración.
 * El botón pasa a «Publicando...» y se desactiva mientras dura la petición. Un error no cierra el diálogo.
 */
export function PublishDialog({
  open,
  onOpenChange,
  state,
  slug,
  demo,
  publishing,
  justPublished,
  error,
  onConfirm,
  onShare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PublicationState;
  slug: string;
  demo: boolean;
  publishing: boolean;
  justPublished: boolean;
  error?: string;
  onConfirm: () => void;
  /** Abre el modal «Compartir invitación» (el mismo del panel del evento). */
  onShare?: () => void;
}) {
  const url = shareUrl(slug);

  if (demo) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{publishCopy.demo.title}</DialogTitle>
            <DialogDescription>{publishCopy.demo.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button>{publishCopy.demo.ok}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const alreadyPublished = justPublished || state === "published";
  const copy = justPublished ? publishCopy.done : state === "draft" ? publishCopy.first : state === "changes" ? publishCopy.republish : publishCopy.published;
  const description = justPublished && state !== "draft" ? publishCopy.done.description : copy.description;

  return (
    <Dialog open={open} onOpenChange={(next) => (publishing ? undefined : onOpenChange(next))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="publish-url" className="text-lu-sm font-medium text-lu-text">
            {publishCopy.urlLabel}
          </label>
          <Input id="publish-url" readOnly value={displayShareUrl(slug)} onFocus={(event) => event.currentTarget.select()} />
        </div>

        <p className="text-lu-sm text-lu-text-muted">{publishCopy.savedNotPublished}</p>

        {error ? (
          <p role="alert" className="text-lu-sm text-lu-error">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {alreadyPublished ? (
            <>
              <DialogClose asChild>
                <Button variant="ghost">{publishCopy.close}</Button>
              </DialogClose>
              {onShare ? (
                <Button variant="secondary" onClick={onShare}>
                  Compartir
                </Button>
              ) : null}
              <Button asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {publishCopy.open}
                </a>
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" disabled={publishing} onClick={() => onOpenChange(false)}>
                {publishCopy.cancel}
              </Button>
              <Button loading={publishing} onClick={onConfirm}>
                {publishing ? publishCopy.publishing : "confirm" in copy ? copy.confirm : publishCopy.first.confirm}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
