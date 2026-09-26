import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/** Logotipo tipográfico: el nombre de marca en serif (medido ≈ 36 px en escritorio). */
export function Wordmark({
  size = "md",
  href,
  className,
}: {
  size?: "sm" | "md";
  /** Si se indica, el wordmark es un enlace (p. ej. a "/"). */
  href?: string;
  className?: string;
}) {
  const classes = cn(
    "font-lu-display text-lu-text",
    size === "md" ? "text-lu-wordmark" : "text-lu-h3",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(classes, "rounded-lu-xs outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas")}>
        {siteConfig.name}
      </Link>
    );
  }

  return <span className={classes}>{siteConfig.name}</span>;
}
