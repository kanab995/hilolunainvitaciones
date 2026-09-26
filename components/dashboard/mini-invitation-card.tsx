import { cn } from "@/lib/utils";

/**
 * Mini tarjeta de invitación inclinada (banner y "Editar invitación", mockup 05). Es una ilustración
 * ligera hecha con tipografía del producto y datos reales del evento: NO renderiza la invitación ni
 * usa el mockup como imagen.
 */
export function MiniInvitationCard({
  eyebrow,
  names,
  dateLabel,
  size = "md",
  className,
}: {
  eyebrow?: string;
  names: readonly string[];
  /** "17 · MAYO · 2027". */
  dateLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const lines = names.flatMap((name, index) => (index === 0 ? [name] : ["y", name]));
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lu-image border border-lu-border-subtle bg-lu-surface text-center shadow-lu-float",
        size === "md" ? "aspect-[4/5] w-44 rotate-[5deg] px-4 py-5" : "aspect-[4/5] w-24 -rotate-[4deg] px-2 py-3",
        className,
      )}
    >
      {eyebrow ? (
        <span className={cn("font-lu-sans tracking-[0.24em] text-lu-eyebrow uppercase", size === "md" ? "text-[0.5rem]" : "text-[0.4375rem]")}>{eyebrow}</span>
      ) : null}
      <span className={cn("flex flex-col font-lu-display leading-[1.05] text-lu-brown-600 italic", size === "md" ? "text-[1.75rem]" : "text-[1.0625rem]")}>
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} className={line === "y" ? "text-[0.7em]" : undefined}>
            {line}
          </span>
        ))}
      </span>
      <span className={cn("font-lu-sans tracking-[0.2em] text-lu-text-secondary uppercase", size === "md" ? "mt-1 text-[0.5rem]" : "mt-0.5 text-[0.375rem]")}>{dateLabel}</span>
    </div>
  );
}
