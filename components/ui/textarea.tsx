import type { ComponentProps } from "react";
import { controlStyles } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TextareaProps = ComponentProps<"textarea"> & {
  tone?: "sans" | "serif";
  invalid?: boolean;
};

export function Textarea({ className, tone = "sans", invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        controlStyles,
        "min-h-28 resize-y py-3",
        tone === "serif"
          ? "font-lu-display text-lu-title-sm leading-normal"
          : "font-lu-sans text-lu-base",
        className,
      )}
      {...props}
    />
  );
}
