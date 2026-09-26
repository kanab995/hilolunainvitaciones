/**
 * `GET /api/health` — comprobación de vida para el alojamiento. Sin sesión ni base de datos: solo responde que el proceso atiende peticiones.
 * NO expone versiones, variables de entorno, URLs ni nada interno.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
