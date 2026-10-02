import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Tarjeta decorativa pequeña con la portada real de una plantilla (`getTemplateCoverImage`):
 * usada en composiciones tipo "abanico" (hero de la home, paso 1 de "Así de fácil"). Siempre
 * `aria-hidden` — decorativa, el mensaje va en el texto que la acompaña.
 */
export function TemplateThumbCard({ src, className }: { src: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute overflow-hidden rounded-lu-image border border-lu-border-subtle bg-lu-surface shadow-lu-card",
        className,
      )}
    >
      <Image src={src} alt="" fill sizes="200px" className="object-cover" />
    </div>
  );
}
