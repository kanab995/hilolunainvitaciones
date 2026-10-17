import { parsePrintOptions } from "@/lib/print/options";
import { resolveOwnedEvent } from "@/server/auth/ownership";
import { getPrintFile } from "@/server/services/print-service";

/**
 * `GET /dashboard/events/[id]/print/file?format=…` — el PDF de imprenta (D-47). Privado: sesión + propiedad + autorización de descarga
 * (`canDownloadPrintFile`; con la compra apagada solo la prueba interna de ADMIN). Sin permiso responde 404, igual que un evento ajeno.
 * Se genera en cada petición desde la versión publicada vigente y no se guarda en ningún almacenamiento (el bucket es público).
 */
export const dynamic = "force-dynamic";

const notFound = () => new Response("No encontrado", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const owned = await resolveOwnedEvent(id);
  if (owned.status !== "ok") return notFound();

  const file = await getPrintFile(owned.user, owned.event.id, parsePrintOptions(new URL(request.url).searchParams));
  if (!file.ok) return notFound();
  return new Response(new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
