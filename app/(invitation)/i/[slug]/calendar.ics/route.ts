import { getPublishedCalendar } from "@/server/services/calendar-service";

/**
 * `GET /i/[slug]/calendar.ics` — evento de calendario de la invitación PUBLICADA (D-30). Público (sin Clerk) y barato.
 * Solo existe para invitaciones publicadas (borrador o slug desconocido → 404). Sin caché compartida: al republicar
 * cambia. No indexable. El nombre del archivo sale del slug ya validado (`invitacion-<slug>.ics`).
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const calendar = await getPublishedCalendar(slug);
  if (!calendar) return new Response("No encontrado", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });

  return new Response(calendar.body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendar.filename}"`,
      "Cache-Control": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
