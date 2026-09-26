import { fontStacks } from "@/lib/invitation/fonts";
import type { TemplateFonts } from "@/types/invitation-template";

/** Familias registradas en docs/ASSET_LICENSES.md (variables de `next/font`, ver `lib/fonts.ts`). */
export const cormorantInter: TemplateFonts = {
  display: fontStacks.cormorant,
  body: fontStacks.inter,
};
