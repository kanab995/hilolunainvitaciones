import { handleBillingWebhook } from "@/server/services/billing-webhook";

/**
 * `POST /api/webhooks/stripe` — webhook de Stripe (D-32), la FUENTE DE VERDAD de las compras por evento (pago único).
 * Sin Clerk ni sesión: se autentica con la firma (`Stripe-Signature`) sobre el cuerpo CRUDO, por eso se lee con `request.text()`
 * (nunca `json()`: alteraría los bytes firmados). Toda la lógica vive en `handleBillingWebhook`; aquí solo se traduce a HTTP.
 * Respuestas: 200 procesado / repetido / ignorado · 400 firma inválida · 500 fallo al aplicar (Stripe reintenta) · 503 sin configurar o base de datos
 * temporalmente no disponible (con `Retry-After`; Stripe reintenta). Un evento solo queda registrado si su efecto se aplicó en la MISMA transacción.
 * No se registran cuerpos ni cabeceras. Siempre dinámica y sin caché.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const { status, body } = await handleBillingWebhook({ rawBody, signature: request.headers.get("stripe-signature") });
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...(status === 503 ? { "Retry-After": "60" } : {}) } });
}
