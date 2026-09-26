"use client";

import type { ComponentProps } from "react";
import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Checkbox de 20 px. Activo en marrón 600 (el mismo acento que el switch de los mockups). */
export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer inline-flex size-5 shrink-0 items-center justify-center rounded-lu-xs border border-lu-border-outline bg-lu-surface text-lu-on-ink",
        "transition-[background-color,border-color] duration-150 ease-lu-standard outline-none",
        "hover:border-lu-brown-500",
        "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
        "data-[state=checked]:border-lu-brown-600 data-[state=checked]:bg-lu-brown-600",
        "data-[state=indeterminate]:border-lu-brown-600 data-[state=indeterminate]:bg-lu-brown-600",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-lu-error",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {props.checked === "indeterminate" ? (
          <Minus aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        ) : (
          <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
