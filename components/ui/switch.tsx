"use client";

import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Switch de 44 × 26 (medido en "Overlay en imagen", mockup 04). Activo en marrón 600. */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[26px] w-11 shrink-0 items-center rounded-full border border-transparent p-[3px]",
        "transition-colors duration-150 ease-lu-standard outline-none",
        "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
        "data-[state=checked]:bg-lu-brown-600 data-[state=unchecked]:bg-lu-border-strong",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-lu-surface shadow-[0_1px_2px_rgb(40_25_10/0.25)]",
          "transition-transform duration-150 ease-lu-standard",
          "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
