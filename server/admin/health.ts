import { PRICE_ENV_KEYS } from "@/lib/billing/plans";
import type { HealthItemDto } from "@/server/admin/dto";

/**
 * SALUD DEL SISTEMA (D-33): ¿está configurado cada servicio? Devuelve SOLO booleanos y los NOMBRES de las variables que faltan;
 * nunca un valor del entorno (ni parcial, ni enmascarado, ni la longitud). Lógica pura sobre un objeto de entorno.
 */
type Env = Readonly<Record<string, string | undefined>>;

const REQUIRED: Record<HealthItemDto["id"], readonly string[]> = {
  database: ["DATABASE_URL"],
  storage: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"],
  clerk: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", ...PRICE_ENV_KEYS],
};

const present = (env: Env, name: string): boolean => Boolean(env[name]?.trim());

export function getSystemHealth(env: Env = process.env): HealthItemDto[] {
  return (Object.keys(REQUIRED) as HealthItemDto["id"][]).map((id) => {
    const missing = REQUIRED[id].filter((name) => !present(env, name));
    return { id, configured: missing.length === 0, missing };
  });
}
