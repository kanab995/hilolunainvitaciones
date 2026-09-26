import type { Metadata, Viewport } from "next";
import { EditorShell } from "@/components/editor/editor-shell";
import { loadEditorPage } from "@/lib/editor/load-event";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Editor", robots: { index: false, follow: false } };

/** `viewport-fit=cover`: permite usar `env(safe-area-inset-bottom)` en la barra fija «Vista previa» del móvil. */
export const viewport: Viewport = { viewportFit: "cover" };

/**
 * Editor de invitación (mockup 04). LEE el evento y su invitación de la base de datos; la ESCRITURA
 * sigue simulada (autoguardado local, sin persistir, sin auth). `/dashboard/events/demo/edit` redirige
 * a la URL canónica con el id. El editor recibe el evento por props y no conoce la BD.
 */
export default async function EventEditPage(props: PageProps<"/dashboard/events/[id]/edit">) {
  const { id } = await props.params;
  const event = await loadEditorPage(id, routes.eventEdit);
  return <EditorShell event={event} />;
}
