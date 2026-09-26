import type { ReactNode } from "react";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/** Sección de la página /design-system. */
export function DsSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-lu-border-subtle py-14 first:border-t-0">
      <div className="mb-10 flex flex-col gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading as="h2" size="h2">
          {title}
        </Heading>
        {description ? (
          <Text size="md" tone="muted" className="max-w-(--lu-prose-max)">
            {description}
          </Text>
        ) : null}
      </div>
      <div className="flex flex-col gap-10">{children}</div>
    </section>
  );
}

/** Bloque rotulado dentro de una sección (variante, estado, tamaño…). */
export function DsBlock({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="text-lu-xs font-medium tracking-wide text-lu-text-subtle uppercase">{label}</p>
      {children}
    </div>
  );
}
