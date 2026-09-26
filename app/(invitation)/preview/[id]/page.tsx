import type { Metadata } from "next";
import { PreviewSurface } from "@/components/editor/preview-surface";
import { loadPreviewEvent } from "@/lib/editor/load-event";
import { getServerNow } from "@/lib/invitation/server-time";

/** Privada y siempre actual (D-29): muestra el BORRADOR de la base de datos, nunca una versión publicada ni una caché compartida. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vista previa", robots: { index: false, follow: false } };

/**
 * Destino del `<iframe>` de la vista previa del editor (docs/ROUTES.md). Renderiza el MISMO
 * `InvitationRenderer` que `/i/[slug]`; el borrador llega del editor por `postMessage`. Lee la
 * invitación persistida del evento (id, slug o alias `demo`). Cuando haya autenticación será una ruta privada del propietario.
 */
export default async function PreviewPage(props: PageProps<"/preview/[id]">) {
  const { id } = await props.params;
  const event = await loadPreviewEvent(id);
  return <PreviewSurface initial={event.invitation} now={getServerNow()} />;
}
