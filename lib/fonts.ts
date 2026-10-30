import { Bebas_Neue, Cinzel, Cormorant_Garamond, Fredoka, Inter, Jost, Lora, Nunito, Playfair_Display, Space_Grotesk } from "next/font/google";

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

/*
 * Familias de PLANTILLAS de invitación (docs/ASSET_LICENSES.md §3, D-45). Solo las usan las plantillas
 * Luz de Fe, Mar de Amor, Nova Grad y Bosque de Aventuras: no son opciones del selector del editor ni del producto.
 * `preload: false`: el navegador solo descarga el archivo cuando una invitación las usa de verdad, así
 * que el resto del sitio no paga por ellas.
 */
/** Luz de Fe — titulares ceremoniales (mayúsculas romanas; sin cursiva propia). */
export const fontCinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: false, variable: "--font-cinzel" });
/** Luz de Fe — texto de cuerpo (serif humanista cálido). */
export const fontLora = Lora({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], display: "swap", preload: false, variable: "--font-lora" });
/** Mar de Amor — titulares editoriales de alto contraste (con cursiva propia). */
export const fontPlayfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], display: "swap", preload: false, variable: "--font-playfair" });
/** Mar de Amor — texto de cuerpo geométrico y ligero. */
export const fontJost = Jost({ subsets: ["latin"], weight: ["300", "400", "500"], display: "swap", preload: false, variable: "--font-jost" });
/** Nova Grad — titulares condensados y contundentes (solo mayúsculas; sin cursiva propia). */
export const fontBebas = Bebas_Neue({ subsets: ["latin"], weight: "400", display: "swap", preload: false, variable: "--font-bebas" });
/** Nova Grad — texto de cuerpo moderno. */
export const fontSpaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: false, variable: "--font-space-grotesk" });
/** Bosque de Aventuras — titulares redondeados y amables, con personalidad infantil (sin cursiva propia). */
export const fontFredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: false, variable: "--font-fredoka" });
/** Bosque de Aventuras — texto de cuerpo redondeado y muy legible para la información importante. */
export const fontNunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap", preload: false, variable: "--font-nunito" });

/** Clases que exponen las variables CSS de fuente; se aplican en <html>. */
export const fontVariables = [
  fontDisplay,
  fontSans,
  fontCinzel,
  fontLora,
  fontPlayfair,
  fontJost,
  fontBebas,
  fontSpaceGrotesk,
  fontFredoka,
  fontNunito,
]
  .map((font) => font.variable)
  .join(" ");
