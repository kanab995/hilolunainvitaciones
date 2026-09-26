"use client";

import { Share2 } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ShareInvitationDialog } from "@/components/share/share-invitation-dialog";
import { Button } from "@/components/ui/button";
import type { PublicationState } from "@/types/published";

interface ShareDialogContextValue {
  open: () => void;
  /** ¿La invitación está publicada? Sin publicar no hay enlace, QR ni calendario que compartir (D-29/D-30). */
  published: boolean;
}

const ShareDialogContext = createContext<ShareDialogContextValue | null>(null);

export function useShareDialog(): ShareDialogContextValue {
  const value = useContext(ShareDialogContext);
  if (!value) throw new Error("useShareDialog debe usarse dentro de <ShareDialogProvider>.");
  return value;
}

/**
 * Proveedor del modal «Compartir invitación» del panel del evento: un único modal por página (D-30,
 * `components/share/share-invitation-dialog.tsx`, el mismo que usa el editor). Cualquier botón «Compartir» lo abre con
 * `useShareDialog().open()`. El estado de publicación decide qué se ofrece (borrador: publicar primero).
 */
export function ShareDialogProvider({ slug, title, state, eventId, children }: { slug: string; title: string; state: PublicationState; eventId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const published = state !== "draft";
  const value = useMemo<ShareDialogContextValue>(() => ({ open: () => setOpen(true), published }), [published]);

  return (
    <ShareDialogContext.Provider value={value}>
      {children}
      <ShareInvitationDialog open={open} onOpenChange={setOpen} title={title} slug={slug} state={state} eventId={eventId} />
    </ShareDialogContext.Provider>
  );
}

/** Botón "Compartir" (encabezado del evento): abre el modal. */
export function ShareButton({ className }: { className?: string }) {
  const { open } = useShareDialog();
  return (
    <Button variant="secondary" size="lg" className={className} onClick={open}>
      <Share2 aria-hidden="true" />
      Compartir
    </Button>
  );
}
