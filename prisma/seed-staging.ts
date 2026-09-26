import { prisma } from "@/server/db/client";
import { upsertTemplates } from "@/server/repositories/templates";
import { buildTemplateRows } from "@/server/seed/demo-data";

/**
 * Seed de STAGING (`npm run db:seed:staging`): SOLO el catálogo de plantillas (datos no personales), por `slug` e idempotente.
 * NO crea el evento demo (Andrea & Fernando), ni usuarios, ni invitados, ni compras: en staging esos datos los crea quien prueba, con su
 * cuenta real de Clerk. El seed completo (`npm run db:seed`) se niega a correr con `APP_ENV=staging|production` (ver `prisma/seed.ts`).
 * También sirve para producción (mismo contenido: solo plantillas). No se ejecuta automáticamente en ningún despliegue.
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definida: el seed necesita una base de datos PostgreSQL.");
  await upsertTemplates(buildTemplateRows());
  const templateCount = await prisma.template.count();
  console.log(`Seed de staging listo: ${templateCount} plantillas (sin evento demo, usuarios ni compras).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
