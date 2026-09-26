import type { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

/**
 * Apariencia de los componentes de Clerk (formularios y menú de cuenta) con los tokens de Hilo Luna.
 * Solo el sistema de personalización oficial de Clerk (`appearance`): variables con tokens `--lu-*` y
 * clases del propio diseño; nunca CSS que dependa del DOM interno del formulario (frágil).
 */
export const clerkAppearance: NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]> = {
  options: { logoPlacement: "none", socialButtonsVariant: "blockButton" },
  variables: {
    colorPrimary: "var(--lu-ink)",
    colorForeground: "var(--lu-text)",
    colorPrimaryForeground: "var(--lu-on-ink)",
    colorBackground: "var(--lu-surface)",
    colorInputForeground: "var(--lu-text)",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-lu-card border border-lu-border-subtle",
  },
};
