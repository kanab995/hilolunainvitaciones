import { readAppEnv } from "@/server/config/app-env";
import { createEventWithInvitation, deleteEvent } from "@/server/repositories/invitations";
import { upsertTemplates } from "@/server/repositories/templates";
import { prisma } from "@/server/db/client";
import { buildDemoAggregate, buildTemplateRows, DEMO_EVENT_ID, DEMO_USER } from "@/server/seed/demo-data";
import { publishOwnedEvent } from "@/server/services/publish-core";

/**
 * Seed reproducible (`npm run db:seed`). Idempotente: actualiza las plantillas por `slug` y vuelve a
 * crear el evento demo (Andrea & Fernando) desde cero —el borrado en cascada elimina su invitación,
 * secciones, sedes, itinerario, galería, regalos, invitados y respuestas—. No toca otros eventos ni
 * plantillas. Los datos salen de `server/seed/demo-data.ts` (derivados del dominio, sin duplicar).
 * Opcional: `SEED_DEMO_OWNER_EMAIL` asigna el evento demo a una cuenta existente (para probar el flujo completo).
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definida: el seed necesita una base de datos PostgreSQL.");
  // El seed completo BORRA y recrea el evento demo y crea usuarios de demostración: solo para desarrollo. En staging/producción, `npm run db:seed:staging`.
  const appEnv = readAppEnv(process.env);
  if (appEnv === "staging" || appEnv === "production") throw new Error(`El seed completo no puede ejecutarse con APP_ENV=${appEnv}. Usa "npm run db:seed:staging" (solo plantillas).`);

  const templates = buildTemplateRows();
  await upsertTemplates(templates);

  // El seed recrea el evento demo, pero NO regenera los tokens de invitación que ya existen (los
  // enlaces personalizados deben seguir siendo los mismos). Sin token previo se usa el del demo.
  const previousTokens = new Map((await prisma.guest.findMany({ where: { eventId: DEMO_EVENT_ID }, select: { id: true, inviteToken: true } })).map((guest) => [guest.id, guest.inviteToken]));
  const aggregate = buildDemoAggregate(new Date());
  for (const guest of aggregate.guests) guest.inviteToken = previousTokens.get(guest.id) ?? guest.inviteToken;

  await deleteEvent(DEMO_EVENT_ID);
  const { eventId, invitationId } = await createEventWithInvitation(aggregate);

  // La demostración nace PUBLICADA: se genera su snapshot (D-29) para que `/i/andrea-y-fernando` lea lo publicado, como
  // cualquier invitación real. Idempotente: el seed recrea el evento, así que siempre es la versión 1.
  const published = await publishOwnedEvent(DEMO_USER.id, eventId, undefined);
  if (!published.ok) throw new Error(`No se pudo publicar la invitación demo: ${published.code}`);

  // OPCIONAL y explícito (desarrollo): con `SEED_DEMO_OWNER_EMAIL=<tu correo>` el evento demo pasa a ser de ESA
  // cuenta (que ya inició sesión al menos una vez). Nunca se asigna solo a "el primer usuario que se registre".
  const ownerEmail = process.env.SEED_DEMO_OWNER_EMAIL?.trim().toLowerCase();
  if (ownerEmail) {
    const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
    if (owner) {
      await prisma.event.update({ where: { id: eventId }, data: { ownerId: owner.id } });
      console.log("El evento demo se asignó a la cuenta indicada en SEED_DEMO_OWNER_EMAIL.");
    } else {
      console.warn("SEED_DEMO_OWNER_EMAIL no coincide con ninguna cuenta: inicia sesión una vez en la aplicación con ese correo y repite el seed.");
    }
  }

  const [templateCount, guestCount, sectionCount] = await Promise.all([prisma.template.count(), prisma.guest.count({ where: { eventId } }), prisma.invitationSection.count({ where: { invitationId } })]);
  console.log(`Seed listo: ${templateCount} plantillas · evento ${eventId} · ${sectionCount} secciones · ${guestCount} invitados.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
