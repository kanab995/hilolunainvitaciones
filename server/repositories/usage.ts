import { getServerNow } from "@/lib/invitation/server-time";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { getDemoRows } from "@/server/repositories/demo-store";

/**
 * USO ACTUAL DE UN EVENTO, para comparar con los límites del plan de ESE evento (D-32). Toda consulta parte del `userId` de la
 * sesión: un evento ajeno cuenta como 0 (nunca se revela nada). Solo lecturas.
 *  - Invitados: filas `Guest` del evento CON `source = HOST` (los acompañantes permitidos no cuentan como invitados; los
 *    autorregistrados por el enlace general, D-40, tienen su PROPIA cuota — `countPublicRsvpResponses` — y nunca cuentan aquí).
 *  - Galería: filas `GalleryImage` del evento (la portada y las imágenes de sedes no cuentan).
 * No existe conteo de eventos por cuenta: el plan es de cada evento y no hay límite de eventos.
 */
export async function countEventGuests(userId: string, eventId: string): Promise<number> {
  if (getDataSource() === "demo") {
    const { ownerId, event, guestRecords } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId && event.id === eventId ? guestRecords.filter((guest) => guest.source === "HOST").length : 0;
  }
  return prisma.guest.count({ where: { eventId, source: "HOST", event: { ownerId: userId } } });
}

/**
 * Respuestas autorregistradas por el enlace general de ESTE evento (D-40, `Guest.source = PUBLIC_RSVP`). Sin `userId`
 * a propósito: la llama el flujo PÚBLICO del RSVP general (sin sesión), ya con un `eventId` resuelto de forma
 * autoritativa desde la invitación PUBLICADA (nunca uno enviado por el cliente sin verificar).
 */
export async function countPublicRsvpResponses(eventId: string): Promise<number> {
  if (getDataSource() === "demo") return 0;
  return prisma.guest.count({ where: { eventId, source: "PUBLIC_RSVP" } });
}

export async function countEventGalleryImages(userId: string, eventId: string): Promise<number> {
  if (getDataSource() === "demo") {
    const { ownerId, event, invitation } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId && event.id === eventId ? invitation.event.galleryImages.length : 0;
  }
  return prisma.galleryImage.count({ where: { eventId, event: { ownerId: userId } } });
}
