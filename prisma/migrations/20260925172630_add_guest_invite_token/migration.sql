-- Enlace personalizado por invitado: token público opaco (docs/DATABASE_SCHEMA.md §12).
-- Migración ADITIVA y segura para filas existentes: la columna nace anulable, se rellena con un token
-- aleatorio por fila (dos UUID v4 sin guiones = 64 caracteres hex, 244 bits; `gen_random_uuid()` es
-- nativo desde PostgreSQL 13) y solo entonces pasa a NOT NULL con índice único.
ALTER TABLE "Guest" ADD COLUMN "inviteToken" TEXT;

UPDATE "Guest"
SET "inviteToken" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE "inviteToken" IS NULL;

ALTER TABLE "Guest" ALTER COLUMN "inviteToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Guest_inviteToken_key" ON "Guest"("inviteToken");
