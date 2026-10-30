"use server";

import { revalidatePath } from "next/cache";
import { adminCopy } from "@/lib/admin/copy";
import { routes } from "@/lib/routes";
import { updateAdminTemplate } from "@/server/admin/templates";
import { requireAdmin } from "@/server/auth/admin";

/**
 * SERVER ACTION de la consola (D-33): cambia la visibilidad en el catálogo y/o el plan mínimo del evento de UNA plantilla. Fina:
 *  1. `requireAdmin()` PRIMERO (sin sesión → /sign-in; sin rol ADMIN → 404, y no se ejecuta nada: el menú oculto no es una barrera),
 *  2. el servicio valida la entrada (lista blanca de valores) y solo reenvía esas dos claves; el nombre, el `slug` y el `designStatus`
 *     de un formulario se ignoran,
 *  3. se revalidan las páginas que muestran el catálogo (se generan estáticas: sin esto, ocultar una plantilla no surtiría efecto; ver `CATALOG_ROUTE`).
 * Ocultar no rompe las invitaciones ya publicadas (leen su snapshot) y cambiar el plan mínimo solo afecta a nuevas selecciones.
 */
export interface TemplateActionState {
  status: "idle" | "saved" | "error";
  message?: string;
}

/**
 * El tipo `"layout"` compara con las etiquetas que Next deriva del ARCHIVO de la ruta, grupos incluidos (`_N_T_/(site)/(marketing)/templates/layout`), no
 * con la URL: `revalidatePath("/templates", "layout")` no coincide con ninguna página y no invalida nada, sin dar error. Esta forma cubre la galería y
 * todos los detalles, también los generados bajo demanda. Si se mueve la ruta, lo detecta `tests/admin/template-revalidation.test.ts`.
 */
const CATALOG_ROUTE = "/(site)/(marketing)/templates";
const SITEMAP_PATH = "/sitemap.xml";

export async function updateTemplateAction(_previous: TemplateActionState, formData: FormData): Promise<TemplateActionState> {
  const admin = await requireAdmin();
  const result = await updateAdminTemplate(admin, {
    templateId: formData.get("templateId"),
    publicationStatus: formData.get("publicationStatus"),
    minimumPlan: formData.get("minimumPlan"),
  });
  if (!result.ok) return { status: "error", message: adminCopy.templates.errors[result.code] };

  revalidatePath(CATALOG_ROUTE, "layout");
  revalidatePath(SITEMAP_PATH);
  revalidatePath(routes.pricing);
  revalidatePath(routes.home);
  revalidatePath(routes.adminTemplates);
  return { status: "saved", message: adminCopy.templates.saved(result.template.name) };
}
