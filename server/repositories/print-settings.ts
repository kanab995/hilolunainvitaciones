import type { PrintQrTarget as DbPrintQrTarget } from "@prisma/client";
import { DEFAULT_PRINT_QR_TARGET, type PrintQrTarget } from "@/lib/print/qr-target";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";

/**
 * PREFERENCIAS DE LA VERSIÓN IMPRESA (`PrintSettings`, D-49). Toda lectura y escritura lleva el dueño en la consulta (`event.ownerId`): un
 * evento ajeno se comporta como inexistente. Sin fila = valores por defecto (QR hacia la invitación). Sin `DATABASE_URL` (demostración):
 * lectura por defecto y escritura con `StoreUnavailableError`.
 */
const TO_DB: Record<PrintQrTarget, DbPrintQrTarget> = { invitation: "INVITATION", gifts: "GIFT_REGISTRY", "gift-link": "GIFT_REGISTRY_LINK", none: "NONE" };
const FROM_DB: Record<DbPrintQrTarget, PrintQrTarget> = { INVITATION: "invitation", GIFT_REGISTRY: "gifts", GIFT_REGISTRY_LINK: "gift-link", NONE: "none" };

/** Destino del QR guardado para un evento DEL usuario; `undefined` si el evento no es suyo o no existe. */
export async function findOwnedPrintQrTarget(userId: string, eventId: string): Promise<PrintQrTarget | undefined> {
  if (getDataSource() === "demo") return DEFAULT_PRINT_QR_TARGET;
  const event = await prisma.event.findFirst({ where: { id: eventId, ownerId: userId }, select: { printSettings: { select: { qrTarget: true } } } });
  if (!event) return undefined;
  return event.printSettings ? FROM_DB[event.printSettings.qrTarget] : DEFAULT_PRINT_QR_TARGET;
}

/** Guarda el destino del QR de un evento DEL usuario. `false` si el evento no es suyo (no escribe nada). */
export async function saveOwnedPrintQrTarget(userId: string, eventId: string, target: PrintQrTarget): Promise<boolean> {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
  const owned = await prisma.event.findFirst({ where: { id: eventId, ownerId: userId }, select: { id: true } });
  if (!owned) return false;
  await prisma.printSettings.upsert({ where: { eventId: owned.id }, create: { eventId: owned.id, qrTarget: TO_DB[target] }, update: { qrTarget: TO_DB[target] } });
  return true;
}
