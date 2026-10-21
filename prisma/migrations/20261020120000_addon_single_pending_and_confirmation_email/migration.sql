-- D-48, etapa 4: compra del complemento «Archivo listo para imprimir». Migración ADITIVA: un valor de enum nuevo y un índice parcial
-- sobre la tabla de complementos. No toca EventPurchase (planes), precios, invitaciones, invitados, RSVP ni publicaciones.

-- AlterEnum: correo de confirmación de la compra del complemento (idempotente por `(kind, purchaseId)`, como los de planes).
ALTER TYPE "EmailDeliveryKind" ADD VALUE 'ADDON_PURCHASE_CONFIRMATION';

-- A lo sumo UNA compra PENDIENTE por evento y complemento: dos pestañas que abren el pago a la vez nunca dejan dos sesiones de cobro
-- abiertas registradas; la segunda inserción no ocurre y el servicio caduca su sesión y reutiliza la primera. Prisma no modela índices
-- parciales: no aparece en schema.prisma ni provoca deriva en `migrate diff` (mismo patrón que
-- `InvitationPublication_one_current_per_invitation`). La tabla nace en la migración anterior (aún sin desplegar), así que está vacía.
CREATE UNIQUE INDEX "EventAddonPurchase_one_pending_per_event_addon" ON "EventAddonPurchase"("eventId", "addon") WHERE "status" = 'PENDING';
