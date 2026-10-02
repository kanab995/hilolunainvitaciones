import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Assets aprobados de la plantilla (docs/ASSET_LICENSES.md §5.5). */
const assets = "/templates/spider-friends";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;

/**
 * SPIDER FRIENDS — plantilla infantil de superhéroes arácnidos ORIGINALES para cumpleaños (brief de
 * texto del propietario). SOLO presentación: paleta roja/azul héroe/amarillo acento sobre un fondo
 * cálido, variantes de layout, efectos, decoración y estilo de componentes. Ningún dato de usuario
 * ni lógica: eso son las secciones genéricas del renderizador (igual que cualquier otra plantilla).
 *
 * Sin personajes registrados: ni el nombre del producto ni ningún texto de la plantilla usa
 * "Spidey", "Spider-Man", "Marvel" ni "Disney" (comprobado por `tests/invitation/assets.test.ts` y
 * `tests/invitation/spider-friends.test.tsx`); los assets son composición vectorial propia (ver
 * docs/ASSET_LICENSES.md §5.5 para el detalle de qué se evitó a propósito).
 */
export const spiderFriendsTemplate: InvitationTemplate = {
  slug: "spider-friends",
  name: "Spider Friends",
  colors: {
    bg: "#fef9ec",
    bgAlt: "#eaf4fb",
    surface: "#ffffff",
    ink: "#262233",
    inkMuted: "#6b6478",
    accent: "#e33a3a",
    line: "#dbe7f5",
    buttonBg: "#2457c9",
    buttonFg: "#fef9ec",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "stacked", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
  decor: {
    // Composición de la portada: ciudad, globos rojos/azules/amarillos, telarañas genéricas y arañitas amigables.
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", width: 1122, height: 1402 },
    // Cuatro esquinas (telaraña, globos, ciudad y rayo) en una sola hoja con transparencia.
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
