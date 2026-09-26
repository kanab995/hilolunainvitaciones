/**
 * TEMPLATE — presentación de una invitación (cómo se ve, nunca qué dice).
 *
 * Contrato de separación (CLAUDE.md reglas 15–17, docs/ARCHITECTURE.md §4.3, D-17):
 *  - Una plantilla controla colores, fuentes, layout, decoraciones, fondo, estilo de componentes y
 *    animaciones. NO contiene nombres, fechas, textos del usuario, sedes, fotos ni ajustes de RSVP.
 *  - Una plantilla nunca añade ni quita secciones, ni cambia su orden: eso es contenido
 *    (`Invitation.sections`).
 *  - Las secciones son las mismas para todas las plantillas; solo cambian estas variantes visuales.
 *  - Este archivo NO importa nada de `types/invitation.ts` (lo comprueba `tests/invitation/separation.test.ts`).
 */

/** Colores del tema: se publican como variables `--inv-*` sobre el contenedor de la invitación. */
export interface TemplateColors {
  bg: string;
  bgAlt: string;
  surface: string;
  ink: string;
  inkMuted: string;
  accent: string;
  line: string;
  buttonBg: string;
  buttonFg: string;
}

/** Fuentes del tema. Solo familias registradas en docs/ASSET_LICENSES.md (variables de `next/font`). */
export interface TemplateFonts {
  display: string;
  body: string;
}

/** Variantes de bloque que elige la plantilla (docs/ARCHITECTURE.md D-17; DESIGN_SYSTEM §5). */
export type HeroLayout = "centered" | "split" | "editorial";
export type LocationsLayout = "split" | "stacked";
export type GalleryLayout = "grid" | "masonry" | "carousel";
export type TimelineLayout = "horizontal" | "vertical";

export interface TemplateLayout {
  hero: HeroLayout;
  locations: LocationsLayout;
  gallery: GalleryLayout;
  timeline: TimelineLayout;
}

export type PhotoMask = "none" | "fade" | "arch";

export interface TemplateEffects {
  /** Textura de papel (requiere un asset con licencia registrada; sin él no produce efecto). */
  paperTexture?: boolean;
  vignette?: boolean;
  photoMask?: PhotoMask;
}

/**
 * Zonas decorativas que una plantilla puede rellenar (flores, marcos, ornamentos).
 *  - `heroBackdrop`: composición de fondo de la portada (imagen completa).
 *  - `heroCorner*`: esquinas de la portada.
 *  - `section{Top,Bottom}{Left,Right}`: esquinas de cualquier sección; cada sección elige cuáles usa.
 */
export type DecorSlot =
  | "heroBackdrop"
  | "heroCornerLeft"
  | "heroCornerRight"
  | "sectionTopLeft"
  | "sectionTopRight"
  | "sectionBottomLeft"
  | "sectionBottomRight";

/** Cuadrante de una hoja de esquinas (`tl` = arriba-izquierda…). */
export type DecorFragment = "tl" | "tr" | "bl" | "br";

/**
 * Decoración de plantilla. Es de la PLANTILLA, no del contenido (docs/ARCHITECTURE.md §4.3).
 *  - `image`: archivo aprobado. Con `fragment`, `src` es una hoja de cuatro esquinas (2 × 2) y solo se
 *    muestra ese cuadrante, por posicionamiento CSS: nunca se crean archivos derivados.
 *  - `placeholder`: mancha difusa del propio tema mientras no hay asset aprobado.
 * TODO(asset): replace with approved Hilo Luna asset.
 */
export type DecorAsset =
  | { kind: "image"; src: string; alt: ""; width: number; height: number; fragment?: DecorFragment }
  | { kind: "placeholder"; tone: "accent" | "surface" | "line" };

/** Fondo de la página y de las secciones. */
export interface TemplateBackground {
  /** `solid` = color liso; `paper` = usa la textura de papel si `effects.paperTexture`. */
  page: "solid" | "paper";
  /** `banded` alterna `bg`/`bgAlt` entre secciones; `continuous` usa siempre `bg`. */
  sections: "banded" | "continuous";
}

/** Estilo de los componentes compartidos (botones, tarjetas, divisores, titulares). */
export interface TemplateComponentStyles {
  button: {
    /** `solid` = relleno; `outline` = solo contorno. */
    variant: "solid" | "outline";
    shape: "pill" | "rounded" | "square";
  };
  card: {
    radius: "none" | "soft" | "rounded";
    border: boolean;
    shadow: boolean;
  };
  divider: "line" | "dots" | "none";
  heading: {
    /** Cursiva en la palabra marcada del titular. */
    emphasis: "italic" | "none";
    /** Mayúsculas en etiquetas superiores. */
    eyebrowCase: "upper" | "normal";
  };
  /** Redondeo de las fotografías. */
  image: { radius: "none" | "soft" | "rounded" };
}

export interface TemplateAnimations {
  /** Cómo aparece cada sección al entrar en pantalla. */
  reveal: "rise" | "fade" | "none";
  /** Escalonado entre elementos (ms). */
  staggerMs: number;
}

export interface InvitationTemplate {
  slug: string;
  name: string;
  colors: TemplateColors;
  fonts: TemplateFonts;
  layout: TemplateLayout;
  effects: TemplateEffects;
  decor: Partial<Record<DecorSlot, DecorAsset>>;
  background: TemplateBackground;
  componentStyles: TemplateComponentStyles;
  animations: TemplateAnimations;
}
