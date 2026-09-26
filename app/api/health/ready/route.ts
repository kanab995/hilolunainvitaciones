import { getReadiness } from "@/server/services/health";

/**
 * `GET /api/health/ready` — preparado para recibir tráfico: la configuración crítica está completa y la base de datos responde. 200 «ready» o 503
 * «not_ready». Solo booleanos por comprobación: nunca URLs, variables ni mensajes de error.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const readiness = await getReadiness();
  return Response.json(readiness, { status: readiness.status === "ready" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
