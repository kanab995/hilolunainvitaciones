import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Pruebas unitarias y de invariantes (docs/ARCHITECTURE.md §11, D-18). Entorno Node: los
 * componentes se renderizan a HTML con `react-dom/server`, sin navegador.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Pruebas HERMÉTICAS: el cliente de Prisma (y Next) cargan el `.env` local, con la base de datos y las
    // claves de Clerk reales de quien desarrolla. Se fijan vacías (una variable ya definida no se
    // sobrescribe) para que ninguna prueba toque una base de datos ni una cuenta ni un bucket reales.
    env: { DATABASE_URL: "", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "", NEXT_PUBLIC_SITE_URL: "", S3_ENDPOINT: "", S3_REGION: "", S3_BUCKET: "", S3_ACCESS_KEY_ID: "", S3_SECRET_ACCESS_KEY: "", S3_PUBLIC_BASE_URL: "", STRIPE_SECRET_KEY: "", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_PRICE_ESSENTIAL_ONE_TIME: "", STRIPE_PRICE_PREMIUM_ONE_TIME: "", STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "" },
  },
});
