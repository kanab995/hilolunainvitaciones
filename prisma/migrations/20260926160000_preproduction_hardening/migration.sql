-- Preproducción (D-34). Migración ADITIVA: una tabla nueva, índices y restricciones. No borra, renombra ni actualiza datos.
-- Las restricciones CHECK se añaden `NOT VALID`: se exigen para toda fila NUEVA o modificada, sin recorrer (ni rechazar) lo ya guardado.

-- DropIndex (sustituido por una restricción única sobre (provider, providerPaymentIntentId): un pago pertenece a UNA sesión de cobro)
DROP INDEX "EventPurchase_providerPaymentIntentId_idx";

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_idx" ON "AdminAuditLog"("adminUserId");

-- CreateIndex
CREATE INDEX "Event_paidAccessEndsAt_idx" ON "Event"("paidAccessEndsAt");

-- CreateIndex
CREATE INDEX "EventPurchase_createdAt_idx" ON "EventPurchase"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventPurchase_provider_providerPaymentIntentId_key" ON "EventPurchase"("provider", "providerPaymentIntentId");

-- CreateIndex
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridad en la BASE DE DATOS (no solo en TypeScript). Prisma no modela CHECK ni índices parciales: no aparecen en schema.prisma y
-- no provocan deriva en `migrate diff`.
ALTER TABLE "EventPurchase" ADD CONSTRAINT "EventPurchase_amount_nonnegative" CHECK ("amount" >= 0) NOT VALID;
ALTER TABLE "EventPurchase" ADD CONSTRAINT "EventPurchase_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$') NOT VALID;
ALTER TABLE "EventPurchase" ADD CONSTRAINT "EventPurchase_paid_has_paidAt" CHECK ("status" <> 'PAID' OR "paidAt" IS NOT NULL) NOT VALID;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_maxCompanions_nonnegative" CHECK ("maxCompanions" >= 0) NOT VALID;
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_attendeeCount_nonnegative" CHECK ("attendeeCount" IS NULL OR "attendeeCount" >= 0) NOT VALID;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_revisions_valid" CHECK ("draftRevision" >= 1 AND "publishedRevision" >= 0 AND "publishedVersion" >= 0) NOT VALID;
ALTER TABLE "InvitationPublication" ADD CONSTRAINT "InvitationPublication_version_positive" CHECK ("version" >= 1) NOT VALID;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sizeBytes_nonnegative" CHECK ("sizeBytes" >= 0) NOT VALID;
ALTER TABLE "Event" ADD CONSTRAINT "Event_endsAt_after_startsAt" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt") NOT VALID;

-- A lo sumo UNA publicación vigente por invitación (la lectura pública toma `isCurrent`).
CREATE UNIQUE INDEX "InvitationPublication_one_current_per_invitation" ON "InvitationPublication"("invitationId") WHERE "isCurrent";
