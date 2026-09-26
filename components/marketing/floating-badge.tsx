import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FloatingBadgeProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  className?: string;
};

/** Tarjeta flotante sobre el teléfono del hero (mockup 01): ícono + título + subtítulo. */
export function FloatingBadge({ icon, title, subtitle, className }: FloatingBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lu-button-lg border border-lu-border-subtle bg-lu-surface px-3.5 py-2.5 shadow-lu-float",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-6 shrink-0 items-center justify-center text-lu-text [&_svg]:size-[1.125rem] [&_svg]:stroke-[1.5]"
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-lu-sm leading-tight font-medium text-lu-text">{title}</span>
        <span className="text-lu-xs leading-tight text-lu-text-muted">{subtitle}</span>
      </span>
    </div>
  );
}
