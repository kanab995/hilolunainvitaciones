import { bebasSpaceGrotesk } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.9). */
const assets = "/templates/nova-grad";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * NOVA GRAD — graduación nocturna y juvenil: negro, oro y champán, destellos y reflectores, con
 * sensación de logro y fiesta. SOLO presentación; ningún dato de usuario ni lógica. Se distingue por
 * la portada `editorial` (imagen a sangre y nombre gigante sobre ella, sin tarjeta), el itinerario
 * horizontal (línea de tiempo de noche, con el scroll lateral en móvil), los bloques de
 * ángulos rectos (botones y tarjetas cuadrados), la tipografía condensada Bebas Neue + Space Grotesk
 * y un fondo oscuro negro y dorado.
 */
export const novaGradTemplate: InvitationTemplate = {
  slug: "nova-grad",
  name: "Nova Grad",
  colors: {
    bg: "#0b0b0f",
    bgAlt: "#14141b",
    surface: "#1d1d27",
    ink: "#f5efe0",
    inkMuted: "#b9b3a3",
    accent: "#e0b84f",
    line: "#34343f",
    buttonBg: "#e0b84f",
    buttonFg: "#0b0b0f",
  },
  fonts: bebasSpaceGrotesk,
  layout: { hero: "editorial", locations: "stacked", gallery: "grid", timeline: "horizontal" },
  // El código de vestimenta es una fotografía clara (mármol): con `screen` sobre este fondo oscuro se lavaría; sin mezcla (D-45).
  effects: { photoMask: "none", illustrationBlend: "none" },
  decor: {
    // Graduada con birrete y diploma celebrando en una fiesta nocturna entre confeti dorado y luces.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 1122, height: 1402 },
    // Cuatro esquinas (laurel dorado, birretes, diplomas, globos y destellos) en una sola hoja con transparencia.
    sectionTopLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tl" },
    sectionTopRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tr" },
    sectionBottomLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "bl" },
    sectionBottomRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "br" },
  },
  background: { page: "solid", sections: "banded" },
  componentStyles: {
    button: { variant: "solid", shape: "square" },
    card: { radius: "none", border: true, shadow: false },
    divider: "line",
    heading: { emphasis: "none", eyebrowCase: "upper" },
    image: { radius: "none" },
  },
  animations: { reveal: "rise", staggerMs: 70 },
};
