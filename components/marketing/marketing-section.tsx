import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarketingSectionProps = {
  /** Ancla de la sección (`#how-it-works`). */
  id?: string;
  /** `id` del titular que rotula la sección (accesibilidad). */
  labelledBy: string;
  children: ReactNode;
  className?: string;
};

/**
 * Sección de marketing: `<section>` rotulada por su titular, contenedor de página y ritmo
 * vertical del sistema (`lu-section`). El contenido se revela suavemente al entrar en pantalla.
 */
export function MarketingSection({ id, labelledBy, children, className }: MarketingSectionProps) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("lu-section scroll-mt-4", className)}>
      <div className="lu-container lu-reveal">{children}</div>
    </section>
  );
}
