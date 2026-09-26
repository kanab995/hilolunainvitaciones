import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Bloque de carga: tinta plana con pulso de opacidad (sin shimmer ni degradados). */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lu-input bg-lu-selected", className)}
      {...props}
    />
  );
}
