-- Ilustración PROPIA del código de vestimenta, gestionada igual que la portada (`coverMediaId`/`coverAlt`). Migración ADITIVA: dos
-- columnas anulables/con valor por defecto y su llave foránea. No toca eventos, contenido, publicaciones, compras ni precios; las
-- invitaciones existentes quedan sin ilustración propia (columna nula) y se dibujan exactamente igual que antes.

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "dressCodeAlt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dressCodeMediaId" TEXT;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_dressCodeMediaId_fkey" FOREIGN KEY ("dressCodeMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
