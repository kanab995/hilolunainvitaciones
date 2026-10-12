import { cinzelLora } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.7). */
const assets = "/templates/luz-de-fe";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * LUZ DE FE — plantilla ceremonial y luminosa para Primera Comunión (y celebraciones religiosas
 * sobrias): blanco cálido, dorado suave y luz natural, con ornamentos mínimos (paloma, lirios,
 * olivo). SOLO presentación; ningún dato de usuario ni lógica. Se distingue de Celeste (bautizo) por
 * la tipografía ceremonial (Cinzel + Lora), la galería en carrusel, el itinerario horizontal, las
 * sedes apiladas con foto en arco y el botón de contorno, no solo por el color.
 *
 * Portada `split` y no `centered`: la foto de portada lleva una cruz grabada en el centro (36–60 % del
 * alto) y el arco centrado de `centered` la tapaba. En `split` la imagen ocupa la parte superior sin
 * texto encima y la tarjeta solo solapa su último tramo, así que la cruz queda visible en móvil y escritorio.
 */
export const luzDeFeTemplate: InvitationTemplate = {
  slug: "luz-de-fe",
  name: "Luz de Fe",
  colors: {
    bg: "#fffdf8",
    bgAlt: "#f7f1e4",
    surface: "#ffffff",
    ink: "#3b3730",
    inkMuted: "#5f594e",
    accent: "#7f5f15",
    line: "#e6dcc3",
    buttonBg: "#7f5f15",
    buttonFg: "#fffdf8",
  },
  fonts: cinzelLora,
  layout: { hero: "split", locations: "stacked", gallery: "carousel", timeline: "horizontal" },
  // Fotografías a todo color en el código de vestimenta: sin mezcla con el fondo (D-45).
  effects: { photoMask: "arch", illustrationBlend: "none" },
  decor: {
    // Arco de piedra con una cruz grabada, flores blancas y olivos, con un jardín luminoso al fondo (941 × 1672).
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 941, height: 1672 },
    // Cuatro esquinas (flores blancas y ramas doradas, paloma, cruz delicada) en una sola hoja con transparencia.
    sectionTopLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tl" },
    sectionTopRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tr" },
    sectionBottomLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "bl" },
    sectionBottomRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "br" },
  },
  background: { page: "solid", sections: "banded" },
  componentStyles: {
    button: { variant: "outline", shape: "pill" },
    card: { radius: "soft", border: true, shadow: false },
    divider: "dots",
    heading: { emphasis: "none", eyebrowCase: "upper" },
    image: { radius: "soft" },
  },
  animations: { reveal: "fade", staggerMs: 140 },
};
