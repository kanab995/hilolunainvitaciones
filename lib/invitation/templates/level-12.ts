import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.2). */
const assets = "/templates/level-12";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * LEVEL 12 — plantilla gamer/arcade/neón para cumpleaños de preadolescentes (10-13 años). SOLO
 * presentación: paleta oscura (azul marino, negro, azul eléctrico, morado y verde lima neón),
 * variantes de layout, efectos, decoración y estilo de componentes. Ningún dato de usuario ni
 * lógica: eso son las secciones genéricas del renderizador (igual que cualquier otra plantilla).
 */
export const level12Template: InvitationTemplate = {
  slug: "level-12",
  name: "Level 12",
  colors: {
    bg: "#0a0e1f",
    bgAlt: "#05070f",
    surface: "#141b36",
    ink: "#f5f7ff",
    inkMuted: "#9aa5cc",
    accent: "#39e5ff",
    line: "#2a3568",
    buttonBg: "#8b5cf6",
    buttonFg: "#f8f7ff",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "stacked", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
  decor: {
    // Composición de la portada: piso en perspectiva, resplandores y el "12" como marca de agua luminosa.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 941, height: 1672 },
    // Resplandores suaves en las esquinas de la portada (sin asset: mancha difusa del acento).
    heroCornerLeft: { kind: "placeholder", tone: "accent" },
    heroCornerRight: { kind: "placeholder", tone: "accent" },
    // Cuatro esquinas (destellos, rayos, barras de progreso y trofeo) en una sola hoja con transparencia.
    sectionTopLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tl" },
    sectionTopRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tr" },
    sectionBottomLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "bl" },
    sectionBottomRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "br" },
  },
  background: { page: "solid", sections: "banded" },
  componentStyles: {
    button: { variant: "solid", shape: "rounded" },
    card: { radius: "soft", border: true, shadow: true },
    divider: "line",
    heading: { emphasis: "none", eyebrowCase: "upper" },
    image: { radius: "soft" },
  },
  animations: { reveal: "rise", staggerMs: 100 },
};
