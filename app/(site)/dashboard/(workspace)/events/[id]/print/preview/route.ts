import { isPreviewSide, parsePrintOptions } from "@/lib/print/options";
import { resolveOwnedEvent } from "@/server/auth/ownership";
import { getPrintPreview } from "@/server/services/print-service";

/**
 * `GET /dashboard/events/[id]/print/preview?side=front|back|envelope&format=…` — imagen de VISTA PREVIA de la versión para imprimir
 * (D-47): SOLO un PNG con la marca de agua quemada (nunca el PDF ni el SVG vectorial). Privada: sesión + propiedad; un evento ajeno, inexistente, sin publicar
 * o de un tipo sin diseño responde 404, sin distinguirlos. Nunca se cachea (cambia al republicar).
 */
export const dynamic = "force-dynamic";

const notFound = () => new Response("No encontrado", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const side = params.get("side");
  if (!isPreviewSide(side)) return notFound();
  const owned = await resolveOwnedEvent(id);
  if (owned.status !== "ok") return notFound();

  const preview = await getPrintPreview(owned.user, owned.event.id, parsePrintOptions(params), side);
  if (!preview.ok) return notFound();
  return new Response(new Blob([preview.body as Uint8Array<ArrayBuffer>], { type: preview.contentType }), {
    status: 200,
    headers: { "Content-Type": preview.contentType, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" },
  });
}
