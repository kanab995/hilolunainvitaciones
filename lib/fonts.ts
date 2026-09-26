import { Cormorant_Garamond, Inter } from "next/font/google";

/**
 * Tipografía (política del propietario, docs/ASSET_LICENSES.md §1.1):
 * solo fuentes open-source con uso comercial, auto-alojadas por next/font.
 *  - Display: Cormorant Garamond
 *  - UI:      Inter
 * Cualquier fuente nueva se registra primero en docs/ASSET_LICENSES.md.
 */
export const fontDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

export const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/** Clases que exponen las variables CSS de fuente; se aplican en <html>. */
export const fontVariables = `${fontDisplay.variable} ${fontSans.variable}`;
