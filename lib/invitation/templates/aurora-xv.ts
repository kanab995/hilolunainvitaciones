import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.3). */
const assets = "/templates/aurora-xv";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * AURORA XV — plantilla romántica y luminosa para XV años (brief de texto + referencia visual del
 * propietario, D-39). SOLO presentación: paleta marfil/rosa empolvado/champagne/dorado suave,
 * variantes de layout, efectos, decoración y estilo de componentes. Ningún dato de usuario ni
 * lógica: eso son las secciones genéricas del renderizador (igual que cualquier otra plantilla).
 */
export const auroraXvTemplate: InvitationTemplate = {
  slug: "aurora-xv",
  name: "Aurora XV",
  colors: {
    bg: "#fbf5ef",
    bgAlt: "#f6ebe2",
    surface: "#f1dfd8",
    ink: "#5a3240",
    inkMuted: "#7d6056",
    accent: "#bd8a52",
    line: "#e3cdc2",
    buttonBg: "#5a2f3f",
    buttonFg: "#fbf0e6",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "split", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
  decor: {
    // Composición de la portada: quinceañera con corona, flores claras y luces cálidas.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 1122, height: 1402 },
    // Cuatro esquinas (flores, perlas y filigrana dorada) en una sola hoja con transparencia.
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
