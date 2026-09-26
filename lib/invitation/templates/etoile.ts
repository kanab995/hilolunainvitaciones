import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * ÉTOILE — tema PROVISIONAL (solo existe su tarjeta en [02]; sin mockup de invitación). Rosa suave
 * con acento dorado y viñeta. Sin pulir visualmente.
 */
export const etoileTemplate: InvitationTemplate = {
  slug: "etoile",
  name: "Étoile",
  colors: {
    bg: "#fff7f5",
    bgAlt: "#fbede9",
    surface: "#f6dad5",
    ink: "#6e2f3a",
    inkMuted: "#4a3a3c",
    accent: "#b4894f",
    line: "#e6cfc6",
    buttonBg: "#5b2a34",
    buttonFg: "#fff7f5",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "split", gallery: "grid", timeline: "horizontal" },
  effects: { vignette: true, photoMask: "arch" },
  decor: {
    heroCornerLeft: { kind: "placeholder", tone: "accent" },
    heroCornerRight: { kind: "placeholder", tone: "surface" },
    sectionTopLeft: { kind: "placeholder", tone: "accent" },
    sectionBottomRight: { kind: "placeholder", tone: "surface" },
  },
  background: { page: "solid", sections: "banded" },
  componentStyles: {
    button: { variant: "solid", shape: "pill" },
    card: { radius: "rounded", border: false, shadow: true },
    divider: "line",
    heading: { emphasis: "italic", eyebrowCase: "upper" },
    image: { radius: "rounded" },
  },
  animations: { reveal: "rise", staggerMs: 120 },
};
