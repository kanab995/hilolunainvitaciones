import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/**
 * Logotipo de la marca (rotulado «Hilo ✦ Luna» del propietario, `public/brand/hiloluna-wordmark.png`,
 * docs/ASSET_LICENSES.md §5.0). El alt es el nombre de marca: es lo que lee un lector de pantalla.
 */
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
  const image = (
    <Image
      src="/brand/hiloluna-wordmark.png"
      alt={siteConfig.name}
      width={1269}
      height={310}
      sizes={size === "md" ? "164px" : "115px"}
      className={cn("w-auto", size === "md" ? "h-10" : "h-7")}
    />
  );

  if (href) {
    return (
      <Link href={href} className={cn("inline-flex rounded-lu-xs outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas", className)}>
        {image}
      </Link>
    );
  }

  return <span className={cn("inline-flex", className)}>{image}</span>;
}
