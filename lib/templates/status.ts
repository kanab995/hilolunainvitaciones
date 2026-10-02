import { getInvitationTemplate } from "@/lib/invitation/templates";
import { routes } from "@/lib/routes";
import type { Template } from "@/types/templates";

/**
 * Posición de la imagen real (`object-position`) cuando el recorte por defecto ("center") no
 * encuadra bien el foco de la foto en la proporción 8:5 de la tarjeta de catálogo. Hoy solo
 * Level 12 lo necesita (el festejado queda fuera de cuadro con el recorte centrado); el resto se
 * ve bien centrado. Configuración de presentación, no una rama del motor de invitaciones.
 */
const COVER_IMAGE_FOCAL_POINT: Partial<Record<string, "center" | "top">> = {
  "level-12": "top",
};

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

/**
 * ¿Se le muestra esta plantilla a un usuario cualquiera en el catálogo público (`/templates`, la
 * galería filtrada, precios)? Única fuente de esta regla, igual que `getTemplateCapabilities`: solo
 * `implemented` tiene diseño aprobado. No se borra nada de `concept`/`comingSoon`: su fila y su
 * página de detalle (`/templates/[slug]`) siguen existiendo, solo no aparecen listadas.
 */
export function isTemplateReady(template: Pick<Template, "status">): boolean {
  return template.status === "implemented";
}

/**
 * Imagen real de portada de una plantilla, ya aprobada y en uso en su invitación pública
 * (`decor.heroBackdrop` del motor de invitaciones, `docs/ASSET_LICENSES.md` §5). No se duplica la
 * ruta en `lib/content/templates.ts`: se resuelve aquí, por `slug`, igual que ya hace el asistente
 * de alta de evento (`app/.../events/new/page.tsx`). `undefined` para `concept`/`comingSoon` (Ivory
 * y Étoile no tienen `heroBackdrop` todavía): la tarjeta cae de vuelta al placeholder con degradado.
 */
export function getTemplateCoverImage(slug: string): { src: string; position: "center" | "top" } | undefined {
  const backdrop = getInvitationTemplate(slug)?.decor.heroBackdrop;
  if (backdrop?.kind !== "image") return undefined;
  return { src: backdrop.src, position: COVER_IMAGE_FOCAL_POINT[slug] ?? "center" };
}
