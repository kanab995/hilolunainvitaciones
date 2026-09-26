import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { clerkAppearance } from "@/lib/auth-appearance";
import { fontVariables } from "@/lib/fonts";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import { getSiteUrl } from "@/lib/site-url";
import { isClerkConfigured } from "@/server/auth/mode";
import "./site.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
};

/**
 * Layout raíz #1 — lenguaje visual del PRODUCTO (marketing, auth, dashboard, editor).
 * Tokens --lu-*. Ver docs/ARCHITECTURE.md D-01.
 * Clerk (identidad y sesiones, D-24) envuelve solo este layout —nunca las invitaciones públicas— y solo
 * si hay claves configuradas. Sin `dynamic`: el proveedor no vuelve dinámicas las páginas estáticas.
 */
export default function SiteRootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang={siteConfig.locale} className={fontVariables}>
      <body>{children}</body>
    </html>
  );
  if (!isClerkConfigured()) return page;

  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl={routes.signIn}
      signUpUrl={routes.signUp}
      signInFallbackRedirectUrl={routes.dashboard}
      signUpFallbackRedirectUrl={routes.dashboard}
      afterSignOutUrl={routes.home}
    >
      {page}
    </ClerkProvider>
  );
}
