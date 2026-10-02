import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.6). */
const assets = "/templates/baby-bloom";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * BABY BLOOM — plantilla tierna, elegante y luminosa para baby shower (brief de texto del
 * propietario), neutral para niño o niña. SOLO presentación: paleta marfil cálido/champagne/dorado
 * suave, variantes de layout, efectos, decoración y estilo de componentes. Ningún dato de usuario ni
 * lógica: eso son las secciones genéricas del renderizador (igual que cualquier otra plantilla).
 */
export const babyBloomTemplate: InvitationTemplate = {
  slug: "baby-bloom",
  name: "Baby Bloom",
  colors: {
    bg: "#fdf8f0",
    bgAlt: "#f6ede0",
    surface: "#ffffff",
    ink: "#4a4038",
    inkMuted: "#8a7d6e",
    accent: "#c9a227",
    line: "#e8ddc8",
    buttonBg: "#b8935a",
    buttonFg: "#fdf8f0",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "stacked", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
  decor: {
    // Composición de la portada: mamá embarazada, flores suaves, globos pastel, osito y regalos, luz natural.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 1122, height: 1402 },
    // Cuatro esquinas (luna, estrellas, nubes, flores, globos, osito, listones y dorado) en una sola hoja con transparencia.
    sectionTopLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tl" },
    sectionTopRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "tr" },
    sectionBottomLeft: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "bl" },
    sectionBottomRight: { kind: "image", src: cornerSheet, alt: "", width: 1254, height: 1254, fragment: "br" },
  },
  background: { page: "solid", sections: "banded" },
  componentStyles: {
    button: { variant: "solid", shape: "pill" },
    card: { radius: "rounded", border: true, shadow: true },
    divider: "line",
    heading: { emphasis: "italic", eyebrowCase: "upper" },
    image: { radius: "soft" },
  },
  animations: { reveal: "rise", staggerMs: 100 },
};
