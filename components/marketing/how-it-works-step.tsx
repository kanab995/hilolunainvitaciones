import type { ReactNode } from "react";
import { Heading, Numeral, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type HowItWorksStepProps = {
  number: string;
  title: string;
  description: string;
  /** Composición ilustrativa a la derecha del numeral (decorativa: `aria-hidden`). */
  visual: ReactNode;
  className?: string;
};

/**
 * Paso de "Así de fácil" (mockup 01): numeral grande y ligero, composición ilustrativa, título
 * serif y descripción. Numeral y composición comparten fila (≈ 176 px de alto); el texto va debajo.
 */
export function HowItWorksStep({ number, title, description, visual, className }: HowItWorksStepProps) {
  return (
    <li className={cn("flex flex-col gap-7", className)}>
      <div className="flex items-center justify-between gap-3">
        <Numeral size="lg" aria-hidden="true" className="font-normal text-lu-brown-500/75">
          {number}
        </Numeral>
        <div aria-hidden="true" className="relative flex h-44 min-w-0 flex-1 items-center justify-end">
          {visual}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Heading as="h3" size="title-md">
          <span className="sr-only">{number}. </span>
          {title}
        </Heading>
        <Text size="base" tone="muted" className="max-w-[22rem]">
          {description}
        </Text>
      </div>
    </li>
  );
}
