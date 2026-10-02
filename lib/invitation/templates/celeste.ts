import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.4). */
const assets = "/templates/celeste";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * CELESTE — plantilla tierna y luminosa para bautizo (brief de texto del propietario, D-43). SOLO
 * presentación: paleta marfil cálido/blanco perla/azul cielo muy suave/dorado suave, variantes de
 * layout, efectos, decoración y estilo de componentes. Ningún dato de usuario ni lógica: eso son las
 * secciones genéricas del renderizador (igual que cualquier otra plantilla).
 */
export const celesteTemplate: InvitationTemplate = {
  slug: "celeste",
  name: "Celeste",
  colors: {
    bg: "#fbf8f2",
    bgAlt: "#f6f1e6",
    surface: "#e9f1f5",
    ink: "#3e4a52",
    inkMuted: "#7d8d94",
    accent: "#b8975e",
    line: "#dbe7ec",
    buttonBg: "#3e5a6b",
    buttonFg: "#fbf8f2",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "split", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
  decor: {
    // Composición de la portada: bebé/detalles de bautizo, cruz delicada, velas y flores blancas.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 1122, height: 1402 },
    // Cuatro esquinas (flores blancas, hojas doradas y perlas) en una sola hoja con transparencia.
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
