import { headers } from "next/headers";

/**
 * Identidad de red del cliente para el límite de tasa. Detrás de un proxy/CDN, la dirección real llega en `x-forwarded-for` (primer
 * valor), `cf-connecting-ip` (Cloudflare) o `x-real-ip`. IMPORTANTE (docs/DEPLOYMENT.md): solo son fiables si el host las fija él mismo;
 * un cliente puede falsificarlas si el proveedor no las sobrescribe. Sin ninguna se devuelve `unknown` (todos comparten cubo: más estricto,
 * nunca más laxo). La identidad se reduce con hash al consultar el limitador; aquí no se registra.
 */
export function pickClientAddress(get: (name: string) => string | null): string {
  const forwarded = get("cf-connecting-ip") ?? get("x-forwarded-for")?.split(",")[0] ?? get("x-real-ip");
  const value = forwarded?.trim().slice(0, 64);
  return value ? value : "unknown";
}

export async function getClientAddress(): Promise<string> {
  try {
    const list = await headers();
    return pickClientAddress((name) => list.get(name));
  } catch {
    return "unknown";
  }
}
