"use client";

import { ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { CalendarActions } from "@/components/share/calendar-actions";
import { QrCodePanel } from "@/components/share/qr-code-panel";
import { isShareCancelled, useCanWebShare } from "@/components/share/use-web-share";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { displayShareUrl } from "@/lib/dashboard/share";
import { publishCopy } from "@/lib/publishing/copy";
import { routes } from "@/lib/routes";
import { resolveShare, webSharePayload } from "@/lib/share/target";
import type { PublicationState } from "@/types/published";

/**
 * MODAL «Compartir invitación» (D-30) — UN solo componente para el dashboard, el editor y la lista de eventos.
 *  - En borrador: «Publica tu invitación para poder compartirla.» (sin enlace, QR ni calendario).
 *  - Publicada: URL pública, «Copiar enlace», «Compartir» (Web Share API si existe), «Código QR» (+ descarga PNG/SVG)
 *    y «Agregar al calendario» (`.ics` de lo publicado).
 *  - Con «Cambios sin publicar» se sigue compartiendo la ÚLTIMA versión publicada (la URL no cambia al publicar).
 * Web Share cancelado no es un error; si el portapapeles se rechaza, el enlace queda seleccionado para copiarlo a mano.
 */
export function ShareInvitationDialog({
  open,
  onOpenChange,
  title,
  slug,
  state,
  eventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  slug: string;
  state: PublicationState;
  eventId: string;
}) {
  const target = resolveShare({ slug, title, state });
  const canShare = useCanWebShare();
  const input = useRef<HTMLInputElement>(null);
  const [shareError, setShareError] = useState<string>();

  const share = async () => {
    if (!target.available) return;
    setShareError(undefined);
    try {
      await navigator.share(webSharePayload(target));
    } catch (error) {
      // Cerrar la hoja de compartir no es un error; cualquier otra cosa, sí (con el enlace como alternativa).
      if (!isShareCancelled(error)) setShareError("No pudimos abrir el menú de compartir. Copia el enlace.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Compartir invitación</DialogTitle>
          <DialogDescription>{target.available ? `Cualquier persona con este enlace podrá ver la invitación de ${title}.` : publishCopy.share.draftDescription}</DialogDescription>
        </DialogHeader>

        {!target.available ? (
          <div className="flex flex-col gap-4">
            <p className="text-lu-sm text-lu-text-muted">Tu invitación es un borrador: solo tú puedes verla en la vista previa del editor.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={routes.eventEdit(eventId)}>{publishCopy.share.draftAction}</Link>
              </Button>
              <DialogClose asChild>
                <Button variant="ghost">Cerrar</Button>
              </DialogClose>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {state === "changes" ? <p className="rounded-lu-input bg-lu-surface-tint px-4 py-3 text-lu-sm text-lu-text-secondary">Compartes la última versión publicada. Tus cambios nuevos se verán cuando los publiques.</p> : null}

            <div className="grid items-start gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
              <QrCodePanel url={target.url} filename={target.qrFilename} svgFilename={target.qrSvgFilename} />

              <div className="flex min-w-0 flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="share-link" className="text-lu-sm font-medium text-lu-text">
                    Enlace público
                  </label>
                  <Input ref={input} id="share-link" readOnly value={displayShareUrl(slug)} onFocus={(event) => event.currentTarget.select()} />
                  <div className="flex flex-wrap items-center gap-3">
                    <CopyLinkButton
                      text={target.url}
                      variant="labelled"
                      onResult={(copied) => {
                        // Sin permiso para copiar: el enlace queda seleccionado para copiarlo a mano.
                        if (!copied) input.current?.select();
                      }}
                    />
                    {canShare ? (
                      <Button variant="secondary" onClick={() => void share()}>
                        <Share2 aria-hidden="true" />
                        Compartir
                      </Button>
                    ) : null}
                    <Button asChild variant="ghost">
                      <a href={routes.invitation(slug)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden="true" />
                        Abrir invitación
                        <span className="sr-only"> (se abre en una pestaña nueva)</span>
                      </a>
                    </Button>
                  </div>
                  {shareError ? (
                    <p role="alert" className="text-lu-sm text-lu-error">
                      {shareError}
                    </p>
                  ) : null}
                </div>

                <hr className="border-lu-divider" />
                <CalendarActions calendarPath={target.calendarPath} />
              </div>
            </div>

            <DialogClose asChild>
              <Button variant="ghost" className="self-end">
                Cerrar
              </Button>
            </DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
