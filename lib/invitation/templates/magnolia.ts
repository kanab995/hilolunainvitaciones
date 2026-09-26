import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.1). */
const assets = "/templates/magnolia";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * MAGNOLIA — la plantilla diseñada (mockup 06). SOLO presentación: colores muestreados de [06]
 * (`app/(invitation)/invitation.css`), variantes de layout, efectos, decoración y estilo de
 * componentes. Ni un solo dato de usuario ni lógica (RSVP, cuenta regresiva, ubicación…): eso
 * son secciones genéricas del renderizador.
 */
export const magnoliaTemplate: InvitationTemplate = {
  slug: "magnolia",
  name: "Magnolia",
  colors: {
    bg: "#faf6f1",
    bgAlt: "#f9f5f1",
    surface: "#f3e6dc",
    ink: "#492512",
    inkMuted: "#39342f",
    accent: "#907058",
    line: "#d3c9c0",
    buttonBg: "#231a0f",
    buttonFg: "#f7f8f3",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "split", gallery: "grid", timeline: "horizontal" },
  effects: { paperTexture: true, photoMask: "fade" },
  decor: {
    // Composición de la portada: pared cálida con magnolias y centro despejado para el texto.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 941, height: 1672 },
    // Cuatro esquinas florales en una hoja: cada posición muestra su cuadrante (sin archivos nuevos).
    sectionTopLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tl" },
    sectionTopRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tr" },
    sectionBottomLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "bl" },
    sectionBottomRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "br" },
  },
  background: { page: "paper", sections: "banded" },
  componentStyles: {
    button: { variant: "solid", shape: "pill" },
    card: { radius: "rounded", border: true, shadow: false },
    divider: "line",
    heading: { emphasis: "italic", eyebrowCase: "upper" },
    image: { radius: "soft" },
  },
  animations: { reveal: "rise", staggerMs: 90 },
};
