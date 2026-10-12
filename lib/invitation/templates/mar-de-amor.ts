import { playfairJost } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.8). */
const assets = "/templates/mar-de-amor";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * MAR DE AMOR — boda en playa: arena, mar, lino y atardecer, en tono editorial tropical (nada de
 * floral clásico). SOLO presentación; ningún dato de usuario ni lógica. Se distingue por la portada
 * `split` (imagen completa arriba y tarjeta flotante que la solapa), la galería `masonry`, las sedes
 * en mitades con foto desvanecida, el itinerario vertical, la tipografía Playfair + Jost y la paleta
 * lino/azul marino/terracota.
 */
export const marDeAmorTemplate: InvitationTemplate = {
  slug: "mar-de-amor",
  name: "Mar de Amor",
  colors: {
    bg: "#f7f1e6",
    bgAlt: "#efe5d3",
    surface: "#fffaf0",
    ink: "#1f3b45",
    inkMuted: "#4a5e65",
    accent: "#954625",
    line: "#dccfb6",
    buttonBg: "#1f3b45",
    buttonFg: "#f7f1e6",
  },
  fonts: playfairJost,
  layout: { hero: "split", locations: "split", gallery: "masonry", timeline: "vertical" },
  // Fotografías a todo color en el código de vestimenta: sin mezcla con el fondo (D-45).
  effects: { photoMask: "fade", illustrationBlend: "none" },
  decor: {
    // Pareja de novios abrazada en la playa al atardecer, con flores en primer plano.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 1122, height: 1402 },
    // Cuatro esquinas (flores blancas, conchas, estrellas de mar y listones) en una sola hoja con transparencia.
    sectionTopLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tl" },
    sectionTopRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tr" },
    sectionBottomLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "bl" },
    sectionBottomRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "br" },
  },
  background: { page: "solid", sections: "banded" },
  componentStyles: {
    button: { variant: "solid", shape: "rounded" },
    card: { radius: "rounded", border: false, shadow: true },
    divider: "line",
    heading: { emphasis: "italic", eyebrowCase: "upper" },
    image: { radius: "soft" },
  },
  animations: { reveal: "rise", staggerMs: 90 },
};
