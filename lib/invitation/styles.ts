import { fontStacks } from "@/lib/invitation/fonts";
import type { StyleOverrides } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * Traduce un `InvitationTemplate` (presentación declarativa) a lo que el renderizador aplica:
 * variables CSS `--inv-*` sobre el contenedor y unas pocas decisiones de clase. Función pura,
 * sin conocer ninguna plantilla por nombre (docs/ARCHITECTURE.md §4.4).
 */

const RADIUS = { none: "0px", soft: "0.5rem", rounded: "1rem" } as const;
const BUTTON_RADIUS = { pill: "9999px", rounded: "0.75rem", square: "0px" } as const;

export type CssVars = Record<`--inv-${string}`, string>;

/** Solo acepta "#RGB" o "#RRGGBB": un override inválido se ignora en vez de romper el tema. */
function isHexColor(value: string | undefined): value is string {
  return value !== undefined && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * Variables CSS del tema. La cascada de estilo es: tema de la plantilla → personalización del usuario
 * para ESA plantilla (`overrides`, solo acento) → ajustes de sección (aplicados en cada sección).
 */
export function templateToCssVars(template: InvitationTemplate, overrides?: StyleOverrides): CssVars {
  const { colors, fonts, componentStyles, animations } = template;
  return {
    "--inv-bg": colors.bg,
    "--inv-bg-alt": colors.bgAlt,
    "--inv-surface": colors.surface,
    "--inv-ink": colors.ink,
    "--inv-ink-muted": colors.inkMuted,
    "--inv-accent": isHexColor(overrides?.accent) ? overrides.accent : colors.accent,
    "--inv-line": colors.line,
    "--inv-button-bg": colors.buttonBg,
    "--inv-button-fg": colors.buttonFg,
    "--inv-font-display": fonts.display,
    "--inv-font-body": fonts.body,
    "--inv-radius-card": RADIUS[componentStyles.card.radius],
    "--inv-radius-image": RADIUS[componentStyles.image.radius],
    "--inv-radius-button": BUTTON_RADIUS[componentStyles.button.shape],
    "--inv-stagger": `${animations.staggerMs}ms`,
    // Fuentes elegidas por el usuario para la portada; sin elección, las secciones usan las del tema.
    ...(overrides?.fonts?.names ? { "--inv-font-names": fontStacks[overrides.fonts.names] } : {}),
    ...(overrides?.fonts?.tagline ? { "--inv-font-tagline": fontStacks[overrides.fonts.tagline] } : {}),
  };
}

export interface ResolvedTemplateStyle {
  /** Fondo de una sección según su posición (0-based) entre las visibles. */
  sectionBackground: (index: number) => "bg-inv-bg" | "bg-inv-bg-alt";
  paper: boolean;
  vignette: boolean;
  photoMask: "none" | "fade" | "arch";
  buttonVariant: "solid" | "outline";
  divider: "line" | "dots" | "none";
  emphasis: "italic" | "none";
  eyebrowUpper: boolean;
  cardBorder: boolean;
  cardShadow: boolean;
  reveal: "rise" | "fade" | "none";
}

export function resolveTemplateStyle(template: InvitationTemplate): ResolvedTemplateStyle {
  const { background, effects, componentStyles, animations } = template;
  return {
    sectionBackground: (index) => (background.sections === "banded" && index % 2 === 1 ? "bg-inv-bg-alt" : "bg-inv-bg"),
    paper: background.page === "paper" && effects.paperTexture === true,
    vignette: effects.vignette === true,
    photoMask: effects.photoMask ?? "none",
    buttonVariant: componentStyles.button.variant,
    divider: componentStyles.divider,
    emphasis: componentStyles.heading.emphasis,
    eyebrowUpper: componentStyles.heading.eyebrowCase === "upper",
    cardBorder: componentStyles.card.border,
    cardShadow: componentStyles.card.shadow,
    reveal: animations.reveal,
  };
}
