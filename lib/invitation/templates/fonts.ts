import { fontStacks } from "@/lib/invitation/fonts";
import type { TemplateFonts } from "@/types/invitation-template";

/** Familias registradas en docs/ASSET_LICENSES.md (variables de `next/font`, ver `lib/fonts.ts`). */
export const cormorantInter: TemplateFonts = {
  display: fontStacks.cormorant,
  body: fontStacks.inter,
};

/** Luz de Fe: Cinzel (sin cursiva propia) + Lora. */
export const cinzelLora: TemplateFonts = {
  display: 'var(--font-cinzel), "Trajan Pro", Georgia, serif',
  body: 'var(--font-lora), Georgia, "Times New Roman", serif',
  italic: false,
};

/** Mar de Amor: Playfair Display + Jost. */
export const playfairJost: TemplateFonts = {
  display: 'var(--font-playfair), Georgia, "Times New Roman", serif',
  body: 'var(--font-jost), ui-sans-serif, system-ui, sans-serif',
};

/** Nova Grad: Bebas Neue (sin cursiva propia) + Space Grotesk. */
export const bebasSpaceGrotesk: TemplateFonts = {
  display: 'var(--font-bebas), Impact, "Arial Narrow", sans-serif',
  body: 'var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif',
  italic: false,
};
