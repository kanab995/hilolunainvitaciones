-- D-48: compras de COMPLEMENTOS por evento (hoy: «Archivo listo para imprimir»). Migración ADITIVA: una tabla y un enum nuevos;
-- no toca EventPurchase (planes), ni ningún dato de clientes, invitados, RSVP, invitaciones o publicaciones.

-- CreateEnum
CREATE TYPE "AddonProduct" AS ENUM ('PRINT_FILE');

-- CreateTable
CREATE TABLE "EventAddonPurchase" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addon" "AddonProduct" NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "providerCheckoutSessionId" TEXT NOT NULL,
    "providerPaymentIntentId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "paidAt" TIMESTAMPTZ,
    "refundedAt" TIMESTAMPTZ,
    "unlockKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAddonPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventAddonPurchase_unlockKey_key" ON "EventAddonPurchase"("unlockKey");

-- CreateIndex
CREATE INDEX "EventAddonPurchase_eventId_addon_status_idx" ON "EventAddonPurchase"("eventId", "addon", "status");

-- CreateIndex
CREATE INDEX "EventAddonPurchase_userId_idx" ON "EventAddonPurchase"("userId");

-- CreateIndex
CREATE INDEX "EventAddonPurchase_createdAt_idx" ON "EventAddonPurchase"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventAddonPurchase_provider_providerCheckoutSessionId_key" ON "EventAddonPurchase"("provider", "providerCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAddonPurchase_provider_providerPaymentIntentId_key" ON "EventAddonPurchase"("provider", "providerPaymentIntentId");

-- AddForeignKey
ALTER TABLE "EventAddonPurchase" ADD CONSTRAINT "EventAddonPurchase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddonPurchase" ADD CONSTRAINT "EventAddonPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Coherencia que Prisma no expresa: la clave de desbloqueo solo existe en una compra PAGADA, y los importes nunca son negativos.
ALTER TABLE "EventAddonPurchase" ADD CONSTRAINT "EventAddonPurchase_unlock_requires_paid" CHECK ("unlockKey" IS NULL OR "status" = 'PAID');
ALTER TABLE "EventAddonPurchase" ADD CONSTRAINT "EventAddonPurchase_amount_non_negative" CHECK ("amount" >= 0);
