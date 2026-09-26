import { createCn } from "cn/config";

/**
 * Tamaños de fuente propios (`text-lu-*`, definidos en app/(site)/site.css).
 * Sin declararlos, el fusionador de clases los confunde con colores de texto
 * (`text-lu-lg` vs `text-lu-on-ink`) y descarta uno de los dos.
 * Mantener en sincronía con los `--text-lu-*`, `--radius-lu-*`, `--shadow-lu-*` y `--font-lu-*` de site.css.
 */
const fontSizeTokens = [
  "lu-display-xl",
  "lu-display-lg",
  "lu-display-md",
  "lu-display-sm",
  "lu-title-xl",
  "lu-h2",
  "lu-h3",
  "lu-title-lg",
  "lu-title-md",
  "lu-title-sm",
  "lu-numeral-lg",
  "lu-numeral",
  "lu-wordmark",
  "lu-lg",
  "lu-md",
  "lu-base",
  "lu-ui",
  "lu-sm",
  "lu-xs",
  "lu-caps",
];

/** Radios, sombras y familias tipográficas propios (mismo motivo: sin declararlos no se fusionan). */
const radiusTokens = [
  "lu-xs",
  "lu-input",
  "lu-button",
  "lu-button-lg",
  "lu-button-xl",
  "lu-image",
  "lu-card",
  "lu-modal",
  "lu-banner",
  "lu-pill",
];
const shadowTokens = ["lu-card", "lu-card-hover", "lu-float", "lu-modal", "lu-device"];
const fontFamilyTokens = ["lu-display", "lu-sans", "inv-display", "inv-body"];

/** Une clases condicionales y resuelve conflictos de Tailwind (equivale a clsx + tailwind-merge). */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: fontSizeTokens }],
      rounded: [{ rounded: radiusTokens }],
      shadow: [{ shadow: shadowTokens }],
      "font-family": [{ font: fontFamilyTokens }],
    },
  },
});
