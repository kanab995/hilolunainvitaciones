import type { FontChoice } from "@/types/invitation";

/**
 * Pilas tipográficas de las fuentes aprobadas (variables de `next/font`, `lib/fonts.ts`).
 * Única fuente de estas cadenas: las usan las plantillas y las personalizaciones del usuario.
 */
export const fontStacks: Record<FontChoice, string> = {
  cormorant: 'var(--font-cormorant), Georgia, "Times New Roman", serif',
  inter: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
};

export const fontChoiceLabels: Record<FontChoice, string> = {
  cormorant: "Cormorant Garamond",
  inter: "Inter",
};
