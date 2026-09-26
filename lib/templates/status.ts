import { routes } from "@/lib/routes";
import type { Template } from "@/types/templates";

/**
 * Qué puede mostrar y hacer la interfaz con una plantilla según su `status`. Única fuente de esta
 * regla: el detalle, los enlaces y los tests la consultan aquí en vez de comparar el estado a mano.
 *
 *  - `preview`: `"full"` = teléfono con todas las pantallas y miniaturas; `"basic"` = solo la portada
 *    (no se asume que el resto de la invitación esté diseñado); `"none"` = solo la miniatura de galería.
 *  - `showFeatures`: lista "Incluye en tu invitación" (solo si el diseño está aprobado).
 *  - `canUse`: "Usar esta plantilla" habilitado. SOLO `implemented`: crear un evento exige un diseño aprobado (D-28).
 *  - `demoHref`: enlace público a la invitación de demostración. SOLO `implemented`: las demos de
 *    `concept` (`/i/demo-ivory`, `/i/demo-etoile`) existen temporalmente en el motor pero no se enlazan.
 *  - `notice`: clave del aviso de estado que se muestra ("Próximamente", "Vista conceptual").
 */
export interface TemplateCapabilities {
  preview: "full" | "basic" | "none";
  showFeatures: boolean;
  canUse: boolean;
  demoHref: string | undefined;
  notice: "comingSoon" | "concept" | undefined;
}

export function getTemplateCapabilities(template: Pick<Template, "slug" | "status">): TemplateCapabilities {
  switch (template.status) {
    case "implemented":
      return { preview: "full", showFeatures: true, canUse: true, demoHref: routes.templateDemo(template.slug), notice: undefined };
    case "concept":
      return { preview: "basic", showFeatures: false, canUse: false, demoHref: undefined, notice: "concept" };
    case "comingSoon":
      return { preview: "none", showFeatures: false, canUse: false, demoHref: undefined, notice: "comingSoon" };
  }
}
