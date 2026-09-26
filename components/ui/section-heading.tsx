import type { ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { EmphasisText, Eyebrow, Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

const wrapperVariants = cva("flex flex-col", {
  variants: {
    align: {
      left: "items-start text-left",
      center: "items-center text-center",
    },
    spacing: {
      tight: "gap-2",
      normal: "gap-3",
    },
  },
  defaultVariants: { align: "left", spacing: "normal" },
});

type SectionHeadingProps = VariantProps<typeof wrapperVariants> & {
  /** Etiqueta superior en MAYÚSCULAS. */
  eyebrow?: string;
  /** Titular. Marca la palabra en cursiva con asteriscos: "Nuestros *momentos*". */
  title: string;
  description?: string;
  size?: "display-lg" | "display-md" | "title-xl" | "h2" | "h3";
  /** Etiqueta HTML del titular (independiente del tamaño visual). */
  as?: ElementType;
  /** `id` del titular, para rotular su sección con `aria-labelledby`. */
  headingId?: string;
  className?: string;
};

/**
 * Encabezado de sección editorial (firma del producto): eyebrow opcional, titular serif con
 * una palabra en cursiva y subtítulo en sans. Mockups 01 ("Así de fácil"), 02, 03, 05.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  size = "h2",
  as = "h2",
  headingId,
  align,
  spacing,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(wrapperVariants({ align, spacing }), className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading as={as} id={headingId} size={size}>
        <EmphasisText>{title}</EmphasisText>
      </Heading>
      {description ? (
        <Text size={size === "h3" ? "sm" : "md"} tone="muted" className="max-w-(--lu-prose-max)">
          {description}
        </Text>
      ) : null}
    </div>
  );
}
