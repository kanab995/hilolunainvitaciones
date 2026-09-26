import { cormorantInter } from "@/lib/invitation/templates/fonts";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * IVORY — tema PROVISIONAL (solo existe su tarjeta en [02]; sin mockup de invitación). Minimalista:
 * marfil y verde oliva, fondo continuo, sedes apiladas e itinerario vertical. Demuestra que la
 * misma invitación cambia de aspecto solo cambiando de plantilla. Sin pulir visualmente.
 */
export const ivoryTemplate: InvitationTemplate = {
  slug: "ivory",
  name: "Ivory",
  colors: {
    bg: "#fcfaf5",
    bgAlt: "#f6f2e8",
    surface: "#efe9da",
    ink: "#33402f",
    inkMuted: "#4a4f44",
    accent: "#7a8a5e",
    line: "#d8d3c2",
    buttonBg: "#2c3527",
    buttonFg: "#f7f8f3",
  },
  fonts: cormorantInter,
  layout: { hero: "centered", locations: "stacked", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "none" },
  decor: {
    sectionTopRight: { kind: "placeholder", tone: "line" },
  },
  background: { page: "solid", sections: "continuous" },
  componentStyles: {
    button: { variant: "outline", shape: "rounded" },
    card: { radius: "soft", border: true, shadow: false },
    divider: "dots",
    heading: { emphasis: "italic", eyebrowCase: "upper" },
    image: { radius: "none" },
  },
  animations: { reveal: "fade", staggerMs: 60 },
};
