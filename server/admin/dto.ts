import type { UserRoleId } from "@/lib/admin/roles";
import type { PageWindow } from "@/lib/admin/query";
import type { PlanId } from "@/lib/billing/plans";
import type { BillingProviderId, EventAccessState, PurchaseKindId, PurchaseStatusId } from "@/lib/billing/purchase";
import type { PublicationState } from "@/types/published";

/**
 * DTOs de la consola (D-33): la ÚNICA forma de los datos que llegan a `/admin/**`. Son mínimos a propósito: ningún modelo de Prisma
 * viaja a la interfaz y NINGÚN DTO tiene campos para datos personales de invitados (email, teléfono, mensajes, respuestas), tokens de
 * invitación, identificadores de Clerk ni secretos de ningún proveedor. Los ids del proveedor de pagos solo salen enmascarados.
 */
export interface AdminPageDto<T> {
  rows: T[];
  window: PageWindow;
}

export interface AdminPersonDto {
  id: string;
  name: string | null;
  email: string;
}

/** Una compra en un historial. Importes en unidades menores (centavos). */
export interface AdminPurchaseLineDto {
  id: string;
  kind: PurchaseKindId;
  plan: PlanId;
  status: PurchaseStatusId;
  amountMinor: number;
  currency: string;
  provider: BillingProviderId;
  createdAt: Date;
  paidAt: Date | null;
}

// ───────── Usuarios ─────────

export interface AdminUserListItemDto extends AdminPersonDto {
  role: UserRoleId;
  createdAt: Date;
  eventCount: number;
  paidEventCount: number;
}

export interface AdminUserEventDto {
  id: string;
  title: string;
  startsAt: Date;
  plan: PlanId;
  publication: PublicationState;
  purchases: AdminPurchaseLineDto[];
}

export interface AdminUserDetailDto extends AdminPersonDto {
  role: UserRoleId;
  clerkLinked: boolean;
  hasBillingCustomer: boolean;
  createdAt: Date;
  eventCount: number;
  events: AdminUserEventDto[];
}

// ───────── Eventos ─────────

export interface AdminEventListItemDto {
  id: string;
  title: string;
  type: string;
  owner: AdminPersonDto;
  template: { name: string; slug: string } | null;
  plan: PlanId;
  publication: PublicationState;
  startsAt: Date;
  createdAt: Date;
}

export interface AdminEventDetailDto {
  id: string;
  title: string;
  type: string;
  owner: AdminPersonDto;
  startsAt: Date;
  timezone: string;
  invitationSlug: string | null;
  template: { name: string; slug: string } | null;
  publication: PublicationState;
  publishedVersion: number;
  plan: PlanId;
  paidAccessEndsAt: Date | null;
  accessState: EventAccessState;
  accessActive: boolean;
  guestCount: number;
  rsvp: { received: number; confirmed: number; declined: number; pending: number };
  galleryCount: number;
  mediaCount: number;
  mediaBytes: number;
  createdAt: Date;
  updatedAt: Date;
  purchases: AdminPurchaseLineDto[];
}

// ───────── Compras ─────────

export interface AdminPurchaseListItemDto extends AdminPurchaseLineDto {
  event: { id: string; title: string };
  user: AdminPersonDto;
}

export interface AdminPurchaseDetailDto extends AdminPurchaseListItemDto {
  updatedAt: Date;
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
  /** Identificadores del proveedor ya ENMASCARADOS (`cs_••••••wxyz`). */
  maskedCheckoutSessionId: string;
  maskedPaymentIntentId: string;
  hasProviderCustomer: boolean;
  maskedProviderCustomerId: string;
  eventStartsAt: Date;
}

// ───────── Plantillas ─────────

export interface AdminTemplateDto {
  id: string;
  slug: string;
  name: string;
  eventType: string;
  designStatus: "IMPLEMENTED" | "CONCEPT" | "COMING_SOON";
  publicationStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  minimumPlan: PlanId;
  invitationCount: number;
}

// ───────── Webhooks ─────────

export interface AdminWebhookDto {
  id: string;
  provider: BillingProviderId;
  maskedExternalEventId: string;
  type: string;
  processedAt: Date;
}

// ───────── Auditoría ─────────

export interface AdminAuditEntryDto {
  id: string;
  createdAt: Date;
  actor: AdminPersonDto;
  /** «Plantilla · Magnolia». */
  target: string;
  /** Campos que cambiaron, ya con etiquetas legibles. */
  changes: Array<{ field: string; from: string; to: string }>;
}

// ───────── Salud y resumen ─────────

export interface HealthItemDto {
  id: "database" | "storage" | "clerk" | "stripe";
  configured: boolean;
  /** NOMBRES de las variables que faltan (nunca valores). */
  missing: string[];
}

export interface RevenueSummaryDto {
  currency: string;
  amountMinor: number;
  count: number;
  /** Compras pagadas en otras monedas: se muestran aparte, sin sumar ni convertir. */
  other: Array<{ currency: string; amountMinor: number; count: number }>;
}

export interface AdminOverviewDto {
  generatedAt: Date;
  totals: { users: number; events: number; publishedInvitations: number; guests: number; rsvps: number; paidPurchases: number };
  eventsByPlan: Record<PlanId, number>;
  revenue: { total: RevenueSummaryDto; last30Days: RevenueSummaryDto };
  purchaseMix: { essential: number; premium: number; upgrades: number };
  access: { windowDays: number; expiringSoon: number; expired: number };
  media: { count: number; sizeBytes: number; stalePending: number; staleHours: number; unreferencedReady: number | null };
  health: HealthItemDto[];
  activity: {
    audit: AdminAuditEntryDto[];
    users: Array<AdminPersonDto & { createdAt: Date }>;
    events: Array<{ id: string; title: string; createdAt: Date }>;
    publications: Array<{ id: string; eventId: string; eventTitle: string; version: number; createdAt: Date }>;
    purchases: AdminPurchaseListItemDto[];
    webhooks: AdminWebhookDto[];
  };
}
