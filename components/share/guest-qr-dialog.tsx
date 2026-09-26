"use client";

import Link from "next/link";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { QrCodePanel } from "@/components/share/qr-code-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { publishCopy } from "@/lib/publishing/copy";
import { routes } from "@/lib/routes";
import { resolveGuestShare } from "@/lib/share/target";
import type { PublicationState } from "@/types/published";

/**
 * QR de la invitación PERSONALIZADA de un invitado (D-30): codifica `…/i/<slug>?guest=<token>` (el token opaco, nunca su
 * id) y NO muestra el token como texto. Solo individual (no hay generación masiva) y solo con la invitación publicada.
 * El QR no es una capa de seguridad: la credencial sigue siendo el token. No se descarga solo: la persona elige.
 */
export function GuestQrDialog({
  guest,
  slug,
  state,
  eventId,
  onClose,
}: {
  guest: { name: string; inviteUrl: string };
  slug: string;
  state: PublicationState;
  eventId: string;
  onClose: () => void;
}) {
  const target = resolveGuestShare({ slug, inviteUrl: guest.inviteUrl, guestName: guest.name, state });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Invitación de {guest.name}</DialogTitle>
          <DialogDescription>{target.available ? "Al escanear este código se abre su invitación personalizada." : publishCopy.share.draftDescription}</DialogDescription>
        </DialogHeader>

        {target.available ? (
          <div className="flex flex-col items-center gap-5">
            <QrCodePanel url={target.url} filename={target.qrFilename} label={`Código QR para abrir la invitación de ${guest.name}`} />
            <div className="flex flex-col items-center gap-2">
              <CopyLinkButton text={target.url} variant="labelled" />
              <p className="text-center text-lu-xs text-lu-text-muted">
                El enlace es personal: compártelo solo con {guest.name}.
              </p>
            </div>
          </div>
        ) : (
          <Button asChild className="self-start">
            <Link href={routes.eventEdit(eventId)}>{publishCopy.share.draftAction}</Link>
          </Button>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
