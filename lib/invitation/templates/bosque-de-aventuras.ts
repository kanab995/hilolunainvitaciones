import { fredokaNunito } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * Assets de la plantilla (docs/ASSET_LICENSES.md §5.10): los aporta el propietario en esta carpeta; el asistente
 * no genera ni sustituye ninguno. Las medidas (`width`/`height`) deben coincidir con los archivos reales:
 * `tests/invitation/bosque-de-aventuras.test.tsx` lo comprueba en cuanto los archivos están presentes.
 */
const assets = "/templates/bosque-de-aventuras";
const coverBackdrop = `${assets}/cover-bg.png`;
const cornerSheet = `${assets}/decor-corners.png`;
/** Medidas reales de los archivos (verificadas el 2026-10-30, juego final). */
const COVER = { width: 1254, height: 1254 } as const;
const CORNERS = { width: 1254, height: 1254 } as const;

/**
 * BOSQUE DE AVENTURAS — plantilla infantil premium de cumpleaños en un bosque encantado (brief de texto del
 * propietario, sin mockup de imagen). SOLO presentación: paleta campirana (crema, verdes de bosque, miel, café
 * madera, rosa y frambuesa), titulares redondeados, cuenta regresiva en tarjetas de madera, decoraciones que se
 * mecen con suavidad y botones que responden al tocarlos (opciones genéricas D-50). Ningún dato de usuario ni
 * lógica: las secciones son las genéricas del renderizador, igual que en cualquier otra plantilla.
 *
 * Identidad ORIGINAL: ni el nombre del producto ni ningún texto de la plantilla o de su demo usa nombres, logos ni
 * referencias de franquicias (lo comprueba `tests/invitation/bosque-de-aventuras.test.tsx`). Los personajes de los
 * assets se revisan a mano antes de habilitarla (docs/ASSET_LICENSES.md §5.10).
 *
 * Contraste (AA, texto normal ≥ 4.5:1): tinta 10.7:1 y cuerpo (café madera) 6.1:1 sobre crema; acento y botón en
 * frambuesa oscurecida #A4434F (5.0:1 sobre el fondo verde claro; crema sobre el botón 5.6:1) porque la frambuesa
 * de la paleta (#B95360) se queda en 3.9:1 sobre ese fondo; cifras crema sobre madera 6.1:1.
 */
export const bosqueDeAventurasTemplate: InvitationTemplate = {
  slug: "bosque-de-aventuras",
  name: "Bosque de Aventuras",
  colors: {
    bg: "#fff5e7", // crema
    bgAlt: "#efebd7", // crema con un 22 % de verde suave (#b7c99d): bandas de bosque claro
    surface: "#fffcf6",
    ink: "#4a3526", // café madera profundo (titulares)
    inkMuted: "#78563d", // café madera (texto)
    accent: "#a4434f", // frambuesa (#b95360) oscurecida para AA
    line: "#ddae60", // miel
    buttonBg: "#a4434f",
    buttonFg: "#fff5e7",
    counterBg: "#78563d", // tarjetas de madera
    counterFg: "#fff5e7",
  },
  fonts: fredokaNunito,
  // `split`: la imagen de portada se ve completa arriba y los datos van en una tarjeta debajo (no tapan rostros);
  // `carousel`: galería que se desliza con imán, suave y sin JavaScript.
  layout: { hero: "split", locations: "stacked", gallery: "carousel", timeline: "vertical" },
  effects: { photoMask: "fade", illustrationBlend: "none" },
  decor: {
    // Bosque encantado de la portada (lo aporta el propietario).
    heroBackdrop: { kind: "image", src: coverBackdrop, alt: "", ...COVER },
    // Cuatro esquinas florales en una sola hoja con transparencia (2 × 2).
    sectionTopLeft: { kind: "image", src: cornerSheet, alt: "", ...CORNERS, fragment: "tl" },
    sectionTopRight: { kind: "image", src: cornerSheet, alt: "", ...CORNERS, fragment: "tr" },
    sectionBottomLeft: { kind: "image", src: cornerSheet, alt: "", ...CORNERS, fragment: "bl" },
    sectionBottomRight: { kind: "image", src: cornerSheet, alt: "", ...CORNERS, fragment: "br" },
  },
  background: { page: "solid", sections: "banded" },
  componentStyles: {
    button: { variant: "solid", shape: "pill", press: "pop" },
    card: { radius: "rounded", border: true, shadow: true },
    divider: "dots",
    heading: { emphasis: "none", eyebrowCase: "upper" },
    image: { radius: "rounded" },
    countdown: "cards",
  },
  animations: { reveal: "rise", staggerMs: 110, decor: "sway" },
};
