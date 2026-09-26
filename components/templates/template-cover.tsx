import Image from "next/image";
import { SampleInvitation } from "@/components/templates/template-card";
import { MediaSlot } from "@/components/ui/media-slot";
import { eventTypeLabels } from "@/lib/content/templates";
import { cn } from "@/lib/utils";
import type { Template } from "@/types/templates";

/**
 * Miniatura grande de la plantilla para el detalle de las que aún no tienen vista previa
 * (`status = "comingSoon"`): la imagen de la tarjeta de galería (`thumbnail`) o su placeholder.
 * No es una invitación ni un teléfono: no se asume ningún diseño más allá de la tarjeta.
 * TODO(asset): replace with approved Hilo Luna asset (escena de la plantilla).
 */
export function TemplateCover({ template, className }: { template: Template; className?: string }) {
  const { thumbnail } = template;
  return (
    <div className={cn("relative aspect-[4/3] w-full max-w-[36rem] overflow-hidden rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint shadow-lu-card", className)}>
      {thumbnail.src ? (
        <Image src={thumbnail.src} alt={thumbnail.alt} fill priority sizes="(min-width: 1024px) 576px, 100vw" className="object-cover" />
      ) : (
        <MediaSlot tone={thumbnail.tone} scene="roses" className="size-full">
          <SampleInvitation name={template.name} category={eventTypeLabels[template.eventType]} flip={false} />
        </MediaSlot>
      )}
    </div>
  );
}
