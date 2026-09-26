"use client";

import type { ComponentProps } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Tabs con dos presentaciones:
 *  - underline: navegación con subrayado tostado (enlace activo de la navbar, mockup 02)
 *  - segmented: control en píldora ("Móvil / Escritorio", mockup 04)
 */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-6", className)} {...props} />;
}

type TabsListProps = ComponentProps<typeof TabsPrimitive.List> & {
  variant?: "underline" | "segmented";
};

export function TabsList({ className, variant = "underline", ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        "group/tabs-list inline-flex items-center",
        variant === "underline" && "w-full gap-7 border-b border-lu-border-subtle",
        variant === "segmented" &&
          "gap-1 self-start rounded-lu-pill border border-lu-border-subtle bg-lu-surface p-1 shadow-lu-card",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-lu-sans outline-none",
        "transition-colors duration-150 ease-lu-standard",
        "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        // underline
        "group-data-[variant=underline]/tabs-list:h-11 group-data-[variant=underline]/tabs-list:rounded-lu-xs group-data-[variant=underline]/tabs-list:text-lu-base group-data-[variant=underline]/tabs-list:text-lu-text-muted",
        "group-data-[variant=underline]/tabs-list:hover:text-lu-text group-data-[variant=underline]/tabs-list:data-[state=active]:text-lu-text",
        "group-data-[variant=underline]/tabs-list:after:absolute group-data-[variant=underline]/tabs-list:after:inset-x-0 group-data-[variant=underline]/tabs-list:after:-bottom-px group-data-[variant=underline]/tabs-list:after:h-0.5 group-data-[variant=underline]/tabs-list:after:bg-lu-brown-400 group-data-[variant=underline]/tabs-list:after:opacity-0 group-data-[variant=underline]/tabs-list:data-[state=active]:after:opacity-100",
        // segmented
        "group-data-[variant=segmented]/tabs-list:h-9 group-data-[variant=segmented]/tabs-list:rounded-lu-pill group-data-[variant=segmented]/tabs-list:px-4 group-data-[variant=segmented]/tabs-list:text-lu-sm group-data-[variant=segmented]/tabs-list:text-lu-text-muted",
        "group-data-[variant=segmented]/tabs-list:hover:text-lu-text group-data-[variant=segmented]/tabs-list:data-[state=active]:bg-lu-selected group-data-[variant=segmented]/tabs-list:data-[state=active]:text-lu-text",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
        className,
      )}
      {...props}
    />
  );
}
