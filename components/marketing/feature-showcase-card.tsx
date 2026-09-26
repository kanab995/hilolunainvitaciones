import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type FeatureShowcaseCardProps = {
  /** Ícono de línea fina (lucide). */
  icon: ReactNode;
  title: string;
  description: string;
  /** Mini-demo visual de la función (decorativa: se marca `aria-hidden` e `inert`). */
  children?: ReactNode;
  /** Decoración de esquina (flores/hojas en el mockup). Va detrás del contenido y se recorta. */
  decor?: ReactNode;
  className?: string;
};

/**
 * Tarjeta de función de "Todo lo que necesitas en una sola invitación" (mockup 01): ícono en
 * cuadrado suave, título serif, descripción y una mini-demo. La demo es solo ilustración: no es
 * interactiva ni implementa la función (RSVP, música y calendario NO existen todavía).
 * Cabecera y demo comparten el mismo padding lateral (24 px) para alinear títulos entre tarjetas.
 */
export function FeatureShowcaseCard({
  icon,
  title,
  description,
  children,
  decor,
  className,
}: FeatureShowcaseCardProps) {
  return (
    <Card padding="lg" className={cn("relative flex h-full flex-col gap-5 overflow-hidden", className)}>
      {decor ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {decor}
        </div>
      ) : null}
      <div className="relative flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lu-button bg-lu-surface-tint text-lu-text [&_svg]:size-5 [&_svg]:stroke-[1.5]"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <Heading as="h3" size="title-md">
            {title}
          </Heading>
          <Text size="sm" tone="muted" className="mt-0.5">
            {description}
          </Text>
        </div>
      </div>
      {children ? (
        <div aria-hidden="true" inert className="relative mt-auto">
          {children}
        </div>
      ) : null}
    </Card>
  );
}
