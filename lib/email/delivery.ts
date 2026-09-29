/**
 * Identificadores de dominio para el correo transaccional (D-36), independientes de los enums de Prisma (mismo patrón que
 * `lib/billing/purchase.ts`): así ni la interfaz ni `server/email/*` importan `@prisma/client`.
 */
export const EMAIL_DELIVERY_KINDS = ["RSVP_NOTIFICATION", "PURCHASE_CONFIRMATION", "UPGRADE_CONFIRMATION"] as const;
export type EmailDeliveryKindId = (typeof EMAIL_DELIVERY_KINDS)[number];

export const EMAIL_DELIVERY_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
export type EmailDeliveryStatusId = (typeof EMAIL_DELIVERY_STATUSES)[number];
