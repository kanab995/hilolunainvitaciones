import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LayoutFrame } from "@/components/layout/layout-frame";
import { fontVariables } from "@/lib/fonts";
import { siteConfig } from "@/lib/site-config";
import { getSiteUrl } from "@/lib/site-url";
import "./invitation.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: siteConfig.name,
  // Las invitaciones son privadas por defecto (docs/PROJECT_SPEC.md §8).
  robots: { index: false, follow: false },
};

/**
 * Layout raíz #2 — lenguaje visual INDEPENDIENTE de las invitaciones (regla 7).
 * Tokens --inv-*; no carga estilos del producto. Ver docs/ARCHITECTURE.md D-01.
 */
export default function InvitationRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={siteConfig.locale} className={fontVariables}>
      <body>
        <LayoutFrame name="invitation">{children}</LayoutFrame>
      </body>
    </html>
  );
}
