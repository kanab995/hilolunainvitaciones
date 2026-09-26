import { cn } from "@/lib/utils";

/** Divisor ornamental. El tipo lo decide la plantilla (`componentStyles.divider`). */
export function Divider({
  kind,
  align = "center",
  className,
}: {
  kind: "line" | "dots" | "none";
  /** Alineación del divisor (ajuste del usuario en la portada). */
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const margin = align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";
  if (kind === "none") return null;
  if (kind === "dots") {
    return (
      <span aria-hidden="true" className={cn("flex items-center gap-1.5", justify, className)}>
        <span className="size-1 rounded-full bg-inv-accent/70" />
        <span className="size-1 rounded-full bg-inv-accent/70" />
        <span className="size-1 rounded-full bg-inv-accent/70" />
      </span>
    );
  }
  return <span aria-hidden="true" className={cn("block h-px w-12 bg-inv-accent/60", margin, className)} />;
}
