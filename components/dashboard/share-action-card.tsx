"use client";

import { Link2, Share2 } from "lucide-react";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { FloralCorner } from "@/components/dashboard/floral-corner";
import { useShareDialog } from "@/components/dashboard/share-dialog";
import { ShortcutCard } from "@/components/dashboard/shortcut-card";
import { displayShareUrl, shareUrl } from "@/lib/dashboard/share";

/**
 * Tarjeta "Compartir" (mockup 05). Abre el modal de compartir; en su pie muestra el enlace del evento
 * con un botón «Copiar» funcional. Íconos genéricos: sin logos de WhatsApp ni Instagram hasta decidir
 * el tratamiento de marca.
 */
export function ShareActionCard({ slug }: { slug: string }) {
  const { open, published } = useShareDialog();
  return (
    <ShortcutCard
      icon={<Share2 />}
      title="Compartir"
      description="Comparte tu invitación por WhatsApp, redes sociales o con un enlace directo."
      onClick={open}
      interactiveFooter
      className="overflow-hidden"
    >
      <div className="relative flex flex-col items-center gap-3 rounded-lu-image bg-lu-surface-tint/70 px-3 py-4">
        <FloralCorner corner="tl" className="-top-3 -left-3 size-16" />
        <FloralCorner corner="br" className="-right-3 -bottom-3 size-16" />
        <div aria-hidden="true" className="relative z-10 flex items-center gap-2.5 text-lu-text">
          {[Share2, Link2].map((Icon, index) => (
            <span key={index} className="inline-flex size-8 items-center justify-center rounded-full border border-lu-border-subtle bg-lu-surface">
              <Icon className="size-4" strokeWidth={1.5} />
            </span>
          ))}
        </div>
        {published ? (
          <div className="relative z-10 flex w-full items-center justify-between gap-1 rounded-lu-input border border-lu-border-subtle bg-lu-surface py-1 pr-1 pl-2.5">
            <span className="min-w-0 py-1 text-lu-xs leading-snug tracking-tight break-words text-lu-text-secondary">{displayShareUrl(slug)}</span>
            <CopyLinkButton text={shareUrl(slug)} />
          </div>
        ) : (
          <p className="relative z-10 w-full rounded-lu-input border border-lu-border-subtle bg-lu-surface px-2.5 py-2 text-center text-lu-xs leading-snug text-lu-text-secondary">Publica tu invitación para poder compartirla.</p>
        )}
      </div>
    </ShortcutCard>
  );
}
