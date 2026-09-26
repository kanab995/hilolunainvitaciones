import type { EventType, Prisma } from "@prisma/client";
import type { UserRoleId } from "@/lib/admin/roles";
import { FREE_PLAN, PLAN_IDS, planConfigs, type PlanId } from "@/lib/billing/plans";
import type { BillingProviderId, PurchaseKindId, PurchaseStatusId } from "@/lib/billing/purchase";
import type { PublicationColumns } from "@/lib/publishing/state";
import type { PublicationState } from "@/types/published";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";
import { summarizeOrphanCandidates } from "@/server/repositories/media-orphans";

/**
 * LECTURAS DE LA CONSOLA INTERNA (D-33). Único módulo que toca Prisma para `/admin/**`. Reglas:
 *  - MÍNIMO NECESARIO: cada consulta usa `select` explícito y NUNCA trae datos personales de invitados (emails, teléfonos, mensajes,
 *    respuestas, `inviteToken`): de los invitados solo se calculan CONTEOS (`count` / `groupBy`). Tampoco secretos ni cuerpos de webhook.
 *  - Nada se cuenta en JavaScript: `count`, `aggregate` y `groupBy` en la base de datos; las listas se paginan en el servidor.
 *  - Sin SQL con texto del usuario: la búsqueda usa filtros de Prisma (parametrizados). La única consulta cruda (`unreferencedReadyMedia`)
 *    tiene texto fijo y un único parámetro de fecha.
 *  - El plan efectivo de un evento NO se guarda ni se recalcula aparte: los listados devuelven sus compras y quien llama aplica
 *    `getEffectiveEventPlan`; los FILTROS por plan (`eventPlanWhere`) son el mismo criterio («mayor plan de las compras PAID») escrito como
 *    condición SQL, y una prueba lo contrasta con la función.
 *  - Solo lectura, salvo `updateTemplateSettings` (visibilidad y plan mínimo de una plantilla), que deja UNA entrada en `AdminAuditLog` en la
 *    MISMA transacción (D-34). Ninguna función crea, cambia ni borra compras, eventos, invitaciones ni usuarios.
 *  - La tabla `Subscription` (legacy) no se lee.
 */

function requireDatabase(): void {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
}

// ───────── Filtros compartidos ─────────

/**
 * Condición «el plan efectivo del evento es `plan`» (mayor plan de sus compras `PAID`; sin ninguna, FREE): existe una compra pagada de
 * ese plan (salvo FREE) y NO existe una pagada de un plan superior. Mismo criterio que `getEffectiveEventPlan`.
 */
export function eventPlanWhere(plan: PlanId): Prisma.EventWhereInput {
  const higher = PLAN_IDS.filter((id) => planConfigs[id].rank > planConfigs[plan].rank);
  const and: Prisma.EventWhereInput[] = [];
  if (plan !== FREE_PLAN) and.push({ purchases: { some: { status: "PAID", plan } } });
  if (higher.length > 0) and.push({ purchases: { none: { status: "PAID", plan: { in: higher } } } });
  return { AND: and };
}

/**
 * Condición «estado de publicación» (borrador / publicado / cambios sin publicar): las mismas reglas que `derivePublicationState`
 * (lib/publishing/state.ts), comparando columnas de `Invitation`. Un evento sin invitación cuenta como borrador.
 */
export function eventPublicationWhere(state: PublicationState): Prisma.EventWhereInput {
  const fields = prisma.invitation.fields;
  switch (state) {
    case "draft":
      return { OR: [{ invitation: { is: null } }, { invitation: { is: { status: { not: "PUBLISHED" } } } }] };
    case "changes":
      return { invitation: { is: { status: "PUBLISHED", publishedVersion: { gt: 0 }, draftRevision: { gt: fields.publishedRevision } } } };
    case "published":
      return { invitation: { is: { status: "PUBLISHED", OR: [{ publishedVersion: 0 }, { draftRevision: { lte: fields.publishedRevision } }] } } };
  }
}

const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

export type ListSort = "newest" | "oldest";

const byCreated = (sort: ListSort) => [{ createdAt: sort === "oldest" ? ("asc" as const) : ("desc" as const) }, { id: "desc" as const }];

// ───────── Resumen ─────────

export interface AdminTotals {
  users: number;
  events: number;
  publishedInvitations: number;
  guests: number;
  rsvps: number;
  paidPurchases: number;
}

export async function countTotals(): Promise<AdminTotals> {
  requireDatabase();
  const [users, events, publishedInvitations, guests, rsvps, paidPurchases] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.invitation.count({ where: { status: "PUBLISHED" } }),
    prisma.guest.count(),
    prisma.rsvp.count(),
    prisma.eventPurchase.count({ where: { status: "PAID" } }),
  ]);
  return { users, events, publishedInvitations, guests, rsvps, paidPurchases };
}

export async function countEventsForPlan(plan: PlanId): Promise<number> {
  requireDatabase();
  return prisma.event.count({ where: eventPlanWhere(plan) });
}

export interface RevenueRow {
  currency: string;
  amountMinor: number;
  count: number;
}

/** Ingresos brutos registrados: SOLO compras `PAID` (jamás pendientes, fallidas, reembolsadas ni canceladas), por moneda. */
export async function sumPaidRevenue(since?: Date): Promise<RevenueRow[]> {
  requireDatabase();
  const rows = await prisma.eventPurchase.groupBy({
    by: ["currency"],
    where: { status: "PAID", ...(since ? { paidAt: { gte: since } } : {}) },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { currency: "asc" },
  });
  return rows.map((row) => ({ currency: row.currency, amountMinor: row._sum.amount ?? 0, count: row._count._all }));
}

export interface PurchaseMixRow {
  plan: PlanId;
  kind: PurchaseKindId;
  count: number;
}

/** Compras pagadas por plan y tipo (Esencial, Premium, mejoras). */
export async function countPaidPurchasesByPlanAndKind(): Promise<PurchaseMixRow[]> {
  requireDatabase();
  const rows = await prisma.eventPurchase.groupBy({ by: ["plan", "kind"], where: { status: "PAID" }, _count: { _all: true }, orderBy: [{ plan: "asc" }, { kind: "asc" }] });
  return rows.map((row) => ({ plan: row.plan, kind: row.kind, count: row._count._all }));
}

/** Eventos de pago cuyo acceso termina en los próximos `days` días, y eventos de pago con el acceso ya vencido (`paidAccessEndsAt`). */
export async function countPaidAccessWindows(now: Date, days: number): Promise<{ expiringSoon: number; expired: number }> {
  requireDatabase();
  const horizon = new Date(now.getTime() + days * 86_400_000);
  const paid: Prisma.EventWhereInput = { purchases: { some: { status: "PAID" } } };
  const [expiringSoon, expired] = await Promise.all([
    prisma.event.count({ where: { ...paid, paidAccessEndsAt: { gte: now, lte: horizon } } }),
    prisma.event.count({ where: { ...paid, paidAccessEndsAt: { lt: now } } }),
  ]);
  return { expiringSoon, expired };
}

export interface MediaTotals {
  count: number;
  sizeBytes: number;
  /** Subidas pendientes de verificar desde hace más de `staleHours` horas. */
  stalePending: number;
  /** Archivos verificados que ningún borrador ni publicación vigente referencia (posibles huérfanos); `null` = no disponible. */
  unreferencedReady: number | null;
}

export async function getMediaTotals(now: Date, staleHours: number): Promise<MediaTotals> {
  requireDatabase();
  const cutoff = new Date(now.getTime() - staleHours * 3_600_000);
  const [totals, stalePending, unreferencedReady] = await Promise.all([
    prisma.mediaAsset.aggregate({ where: { status: { not: "DELETED" } }, _count: { _all: true }, _sum: { sizeBytes: true } }),
    prisma.mediaAsset.count({ where: { status: "PENDING", createdAt: { lt: cutoff } } }),
    unreferencedReadyMedia(cutoff),
  ]);
  return { count: totals._count._all, sizeBytes: totals._sum.sizeBytes ?? 0, stalePending, unreferencedReady };
}

/**
 * Archivos `READY` anteriores a `cutoff` sin ninguna referencia (borrador, sedes, portada ni publicación VIGENTE). Diagnóstico informativo: nunca
 * borra. La definición SQL de «huérfano» es UNA sola (`media-orphans.ts`), la misma que usa la limpieza manual. Si falla (p. ej. cambió el esquema)
 * devuelve `null` y el resto del resumen sigue funcionando.
 */
async function unreferencedReadyMedia(cutoff: Date): Promise<number | null> {
  try {
    return (await summarizeOrphanCandidates({ pending: cutoff, ready: cutoff })).byReason.unreferenced_ready.count;
  } catch {
    return null;
  }
}

// ───────── Actividad reciente ─────────

export interface RecentUser {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
}

export async function listRecentUsers(take: number): Promise<RecentUser[]> {
  requireDatabase();
  return prisma.user.findMany({ orderBy: byCreated("newest"), take, select: { id: true, name: true, email: true, createdAt: true } });
}

export interface RecentEvent {
  id: string;
  title: string;
  createdAt: Date;
}

export async function listRecentEvents(take: number): Promise<RecentEvent[]> {
  requireDatabase();
  return prisma.event.findMany({ orderBy: byCreated("newest"), take, select: { id: true, title: true, createdAt: true } });
}

export interface RecentPublication {
  id: string;
  version: number;
  createdAt: Date;
  eventId: string;
  eventTitle: string;
}

/** Últimas publicaciones. NUNCA se trae el `snapshot` (contenido completo de la invitación): solo metadatos. */
export async function listRecentPublications(take: number): Promise<RecentPublication[]> {
  requireDatabase();
  const rows = await prisma.invitationPublication.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, version: true, createdAt: true, invitation: { select: { event: { select: { id: true, title: true } } } } },
  });
  return rows.map((row) => ({ id: row.id, version: row.version, createdAt: row.createdAt, eventId: row.invitation.event.id, eventTitle: row.invitation.event.title }));
}

// ───────── Usuarios ─────────

export interface UsersQuery {
  q?: string | undefined;
  sort: ListSort;
  skip: number;
  take: number;
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRoleId;
  createdAt: Date;
  eventCount: number;
  paidEventCount: number;
}

const paidEvents: Prisma.EventWhereInput = { purchases: { some: { status: "PAID" } } };

const usersWhere = (q: string | undefined): Prisma.UserWhereInput => (q ? { OR: [{ name: contains(q) }, { email: contains(q) }] } : {});

export async function countUsers(query: Pick<UsersQuery, "q">): Promise<number> {
  requireDatabase();
  return prisma.user.count({ where: usersWhere(query.q) });
}

export async function listUsers(query: UsersQuery): Promise<AdminUserRow[]> {
  requireDatabase();
  const rows = await prisma.user.findMany({
    where: usersWhere(query.q),
    orderBy: byCreated(query.sort),
    skip: query.skip,
    take: query.take,
    select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { events: true } } },
  });
  // Eventos de pago por usuario: una sola consulta agrupada para la página (no una por fila).
  const paid = rows.length === 0 ? [] : await prisma.event.groupBy({ by: ["ownerId"], where: { ownerId: { in: rows.map((row) => row.id) }, ...paidEvents }, _count: { _all: true } });
  const paidByOwner = new Map(paid.map((row) => [row.ownerId, row._count._all]));
  return rows.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.createdAt, eventCount: row._count.events, paidEventCount: paidByOwner.get(row.id) ?? 0 }));
}

export interface AdminUserEventRow {
  id: string;
  title: string;
  startsAt: Date;
  paidAccessEndsAt: Date | null;
  publication: PublicationColumns | null;
  purchases: AdminPurchaseLine[];
}

/** Línea de compra mínima (historial). */
export interface AdminPurchaseLine {
  id: string;
  kind: PurchaseKindId;
  plan: PlanId;
  status: PurchaseStatusId;
  amount: number;
  currency: string;
  provider: BillingProviderId;
  createdAt: Date;
  paidAt: Date | null;
}

const purchaseLineSelect = { id: true, kind: true, plan: true, status: true, amount: true, currency: true, provider: true, createdAt: true, paidAt: true } as const;

export interface AdminUserDetailRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRoleId;
  /** ¿Tiene identidad de Clerk vinculada? (el id de Clerk NO sale del servidor). */
  clerkLinked: boolean;
  createdAt: Date;
  eventCount: number;
  /** ¿Tiene cliente del proveedor de cobro? (el id NO sale del repositorio). */
  hasBillingCustomer: boolean;
  events: AdminUserEventRow[];
}

const USER_EVENTS_LIMIT = 50;

export async function findUser(id: string): Promise<AdminUserDetailRow | null> {
  requireDatabase();
  const row = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clerkUserId: true,
      createdAt: true,
      _count: { select: { events: true, billingCustomers: true } },
      events: {
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        take: USER_EVENTS_LIMIT,
        select: {
          id: true,
          title: true,
          startsAt: true,
          paidAccessEndsAt: true,
          invitation: { select: { status: true, draftRevision: true, publishedRevision: true, publishedVersion: true } },
          purchases: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: purchaseLineSelect },
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    clerkLinked: row.clerkUserId !== null,
    createdAt: row.createdAt,
    eventCount: row._count.events,
    hasBillingCustomer: row._count.billingCustomers > 0,
    events: row.events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, paidAccessEndsAt: event.paidAccessEndsAt, publication: event.invitation, purchases: event.purchases })),
  };
}

// ───────── Eventos ─────────

export type EventSort = ListSort | "event_date";

export interface EventsQuery {
  q?: string | undefined;
  publication?: PublicationState | undefined;
  type?: EventType | undefined;
  plan?: PlanId | undefined;
  sort: EventSort;
  skip: number;
  take: number;
}

export interface AdminEventRow {
  id: string;
  title: string;
  type: string;
  startsAt: Date;
  createdAt: Date;
  paidAccessEndsAt: Date | null;
  owner: { id: string; name: string | null; email: string };
  template: { name: string; slug: string } | null;
  publication: PublicationColumns | null;
  /** Solo plan y estado: lo justo para resolver el plan efectivo. */
  purchases: Array<{ plan: PlanId; status: PurchaseStatusId }>;
}

function eventsWhere(query: Pick<EventsQuery, "q" | "publication" | "type" | "plan">): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [];
  if (query.q) and.push({ OR: [{ title: contains(query.q) }, { slug: contains(query.q) }, { owner: { is: { email: contains(query.q) } } }, { owner: { is: { name: contains(query.q) } } }] });
  if (query.publication) and.push(eventPublicationWhere(query.publication));
  if (query.type) and.push({ type: query.type });
  if (query.plan) and.push(eventPlanWhere(query.plan));
  return and.length > 0 ? { AND: and } : {};
}

const eventOrder = (sort: EventSort) => (sort === "event_date" ? [{ startsAt: "desc" as const }, { id: "desc" as const }] : byCreated(sort));

export async function countEvents(query: Pick<EventsQuery, "q" | "publication" | "type" | "plan">): Promise<number> {
  requireDatabase();
  return prisma.event.count({ where: eventsWhere(query) });
}

export async function listEvents(query: EventsQuery): Promise<AdminEventRow[]> {
  requireDatabase();
  const rows = await prisma.event.findMany({
    where: eventsWhere(query),
    orderBy: eventOrder(query.sort),
    skip: query.skip,
    take: query.take,
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      createdAt: true,
      paidAccessEndsAt: true,
      owner: { select: { id: true, name: true, email: true } },
      invitation: { select: { status: true, draftRevision: true, publishedRevision: true, publishedVersion: true, template: { select: { name: true, slug: true } } } },
      purchases: { select: { plan: true, status: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    startsAt: row.startsAt,
    createdAt: row.createdAt,
    paidAccessEndsAt: row.paidAccessEndsAt,
    owner: row.owner,
    template: row.invitation?.template ?? null,
    publication: row.invitation ? { status: row.invitation.status, draftRevision: row.invitation.draftRevision, publishedRevision: row.invitation.publishedRevision, publishedVersion: row.invitation.publishedVersion } : null,
    purchases: row.purchases,
  }));
}

export interface AdminEventDetailRow {
  id: string;
  title: string;
  type: string;
  startsAt: Date;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  paidAccessEndsAt: Date | null;
  owner: { id: string; name: string | null; email: string };
  invitation: { slug: string; template: { name: string; slug: string }; columns: PublicationColumns } | null;
  purchases: AdminPurchaseLine[];
  /** Solo conteos: nunca nombres, emails, teléfonos, mensajes ni tokens de invitados. */
  counts: { guests: number; rsvps: number; galleryImages: number; mediaAssets: number; mediaBytes: number };
  guestStatus: Array<{ status: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE"; count: number }>;
}

export async function findEvent(id: string): Promise<AdminEventDetailRow | null> {
  requireDatabase();
  const row = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
      paidAccessEndsAt: true,
      owner: { select: { id: true, name: true, email: true } },
      invitation: { select: { slug: true, status: true, draftRevision: true, publishedRevision: true, publishedVersion: true, publishedAt: true, lastPublishedAt: true, template: { select: { name: true, slug: true } } } },
      purchases: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: purchaseLineSelect },
      _count: { select: { guests: true, rsvps: true, galleryImages: true } },
    },
  });
  if (!row) return null;
  const [status, media] = await Promise.all([
    prisma.guest.groupBy({ by: ["status"], where: { eventId: id }, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.mediaAsset.aggregate({ where: { eventId: id, status: { not: "DELETED" } }, _count: { _all: true }, _sum: { sizeBytes: true } }),
  ]);
  const { invitation } = row;
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    startsAt: row.startsAt,
    timezone: row.timezone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    paidAccessEndsAt: row.paidAccessEndsAt,
    owner: row.owner,
    invitation: invitation
      ? { slug: invitation.slug, template: invitation.template, columns: { status: invitation.status, draftRevision: invitation.draftRevision, publishedRevision: invitation.publishedRevision, publishedVersion: invitation.publishedVersion, publishedAt: invitation.publishedAt, lastPublishedAt: invitation.lastPublishedAt } }
      : null,
    purchases: row.purchases,
    counts: { guests: row._count.guests, rsvps: row._count.rsvps, galleryImages: row._count.galleryImages, mediaAssets: media._count._all, mediaBytes: media._sum.sizeBytes ?? 0 },
    guestStatus: status.map((item) => ({ status: item.status, count: item._count._all })),
  };
}

// ───────── Compras ─────────

export interface PurchasesQuery {
  q?: string | undefined;
  status?: PurchaseStatusId | undefined;
  kind?: PurchaseKindId | undefined;
  plan?: PlanId | undefined;
  sort: ListSort;
  skip: number;
  take: number;
}

export interface AdminPurchaseRow extends AdminPurchaseLine {
  event: { id: string; title: string };
  user: { id: string; name: string | null; email: string };
}

function purchasesWhere(query: Pick<PurchasesQuery, "q" | "status" | "kind" | "plan">): Prisma.EventPurchaseWhereInput {
  const and: Prisma.EventPurchaseWhereInput[] = [];
  if (query.q) and.push({ OR: [{ event: { is: { title: contains(query.q) } } }, { user: { is: { email: contains(query.q) } } }, { user: { is: { name: contains(query.q) } } }] });
  if (query.status) and.push({ status: query.status });
  if (query.kind) and.push({ kind: query.kind });
  if (query.plan) and.push({ plan: query.plan });
  return and.length > 0 ? { AND: and } : {};
}

export async function countPurchases(query: Pick<PurchasesQuery, "q" | "status" | "kind" | "plan">): Promise<number> {
  requireDatabase();
  return prisma.eventPurchase.count({ where: purchasesWhere(query) });
}

export async function listPurchases(query: PurchasesQuery): Promise<AdminPurchaseRow[]> {
  requireDatabase();
  return prisma.eventPurchase.findMany({
    where: purchasesWhere(query),
    orderBy: byCreated(query.sort),
    skip: query.skip,
    take: query.take,
    select: { ...purchaseLineSelect, event: { select: { id: true, title: true } }, user: { select: { id: true, name: true, email: true } } },
  });
}

export interface AdminPurchaseDetailRow extends AdminPurchaseRow {
  updatedAt: Date;
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
  /** Ids del proveedor SIN enmascarar: la capa `server/admin` los enmascara antes de que salgan de ella. */
  providerCheckoutSessionId: string;
  providerPaymentIntentId: string | null;
  providerCustomerId: string | null;
  event: { id: string; title: string; startsAt: Date };
}

export async function findPurchase(id: string): Promise<AdminPurchaseDetailRow | null> {
  requireDatabase();
  const row = await prisma.eventPurchase.findUnique({
    where: { id },
    select: {
      ...purchaseLineSelect,
      updatedAt: true,
      accessStartsAt: true,
      accessEndsAt: true,
      providerCheckoutSessionId: true,
      providerPaymentIntentId: true,
      event: { select: { id: true, title: true, startsAt: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) return null;
  const customer = await prisma.billingCustomer.findUnique({ where: { userId_provider: { userId: row.user.id, provider: row.provider } }, select: { providerCustomerId: true } });
  return { ...row, providerCustomerId: customer?.providerCustomerId ?? null };
}

// ───────── Plantillas ─────────

export interface AdminTemplateRow {
  id: string;
  slug: string;
  name: string;
  eventType: string;
  designStatus: "IMPLEMENTED" | "CONCEPT" | "COMING_SOON";
  publicationStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  minimumPlan: PlanId;
  /** Invitaciones que usan la plantilla. */
  invitationCount: number;
}

const templateSelect = { id: true, slug: true, name: true, eventType: true, designStatus: true, publicationStatus: true, minimumPlan: true, _count: { select: { invitations: true } } } as const;

type TemplateRow = { id: string; slug: string; name: string; eventType: string; designStatus: AdminTemplateRow["designStatus"]; publicationStatus: AdminTemplateRow["publicationStatus"]; minimumPlan: PlanId; _count: { invitations: number } };

const toTemplateRow = ({ _count, ...row }: TemplateRow): AdminTemplateRow => ({ ...row, invitationCount: _count.invitations });

/** Todas las plantillas (también las ocultas), sin los JSON de vista previa. */
export async function listTemplates(): Promise<AdminTemplateRow[]> {
  requireDatabase();
  const rows = await prisma.template.findMany({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], select: templateSelect });
  return rows.map(toTemplateRow);
}

/**
 * Lo ÚNICO que la consola puede cambiar de una plantilla: visibilidad en el catálogo y plan mínimo del EVENTO. El nombre, el `slug`, la
 * madurez del diseño (`designStatus`) y el resto NO son editables desde aquí: esta función solo conoce estas dos claves.
 */
export interface TemplateSettingsUpdate {
  publicationStatus?: AdminTemplateRow["publicationStatus"];
  minimumPlan?: PlanId;
}

/**
 * Aplica el cambio y registra la auditoría en UNA transacción: o quedan las dos cosas o ninguna. La entrada guarda solo los campos que
 * CAMBIARON (antes/después): sin datos personales, sin secretos. Un cambio que no modifica nada no deja entrada.
 */
export async function updateTemplateSettings(id: string, update: TemplateSettingsUpdate, adminUserId: string): Promise<AdminTemplateRow | null> {
  requireDatabase();
  const data: Prisma.TemplateUpdateManyMutationInput = {};
  if (update.publicationStatus) data.publicationStatus = update.publicationStatus;
  if (update.minimumPlan) data.minimumPlan = update.minimumPlan;

  return prisma.$transaction(async (tx) => {
    const before = await tx.template.findUnique({ where: { id }, select: { publicationStatus: true, minimumPlan: true } });
    if (!before) return null;
    const { count } = await tx.template.updateMany({ where: { id }, data });
    if (count === 0) return null;

    const beforeChanged: Record<string, string> = {};
    const afterChanged: Record<string, string> = {};
    for (const key of ["publicationStatus", "minimumPlan"] as const) {
      const next = data[key];
      if (typeof next === "string" && next !== before[key]) {
        beforeChanged[key] = before[key];
        afterChanged[key] = next;
      }
    }
    if (Object.keys(afterChanged).length > 0) {
      await tx.adminAuditLog.create({ data: { adminUserId, action: "template.update", entityType: "Template", entityId: id, before: beforeChanged, after: afterChanged } });
    }
    const row = await tx.template.findUnique({ where: { id }, select: templateSelect });
    return row ? toTemplateRow(row) : null;
  });
}

// ───────── Auditoría ─────────

export interface AdminAuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
  admin: { id: string; name: string | null; email: string };
  /** Nombre de la entidad si se conoce (plantillas). */
  entityName: string | null;
}

export async function listAuditLog(take: number): Promise<AdminAuditRow[]> {
  requireDatabase();
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, action: true, entityType: true, entityId: true, before: true, after: true, createdAt: true, admin: { select: { id: true, name: true, email: true } } },
  });
  const templateIds = [...new Set(rows.filter((row) => row.entityType === "Template").map((row) => row.entityId))];
  const templates = templateIds.length === 0 ? [] : await prisma.template.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } });
  const names = new Map(templates.map((template) => [template.id, template.name]));
  return rows.map((row) => ({ ...row, entityName: row.entityType === "Template" ? (names.get(row.entityId) ?? null) : null }));
}

export async function listRecentAuditLog(take: number): Promise<AdminAuditRow[]> {
  return listAuditLog(take);
}

// ───────── Webhooks ─────────

export interface WebhooksQuery {
  q?: string | undefined;
  skip: number;
  take: number;
}

export interface AdminWebhookRow {
  id: string;
  provider: BillingProviderId;
  externalEventId: string;
  type: string;
  processedAt: Date;
}

const webhooksWhere = (q: string | undefined): Prisma.WebhookEventWhereInput => (q ? { type: contains(q) } : {});

export async function countWebhookEvents(query: Pick<WebhooksQuery, "q">): Promise<number> {
  requireDatabase();
  return prisma.webhookEvent.count({ where: webhooksWhere(query.q) });
}

/** Solo id, tipo y fecha: la tabla nunca guarda cuerpos ni firmas. */
export async function listWebhookEvents(query: WebhooksQuery): Promise<AdminWebhookRow[]> {
  requireDatabase();
  return prisma.webhookEvent.findMany({ where: webhooksWhere(query.q), orderBy: [{ processedAt: "desc" }, { id: "desc" }], skip: query.skip, take: query.take, select: { id: true, provider: true, externalEventId: true, type: true, processedAt: true } });
}

export async function listRecentWebhookEvents(take: number): Promise<AdminWebhookRow[]> {
  requireDatabase();
  return prisma.webhookEvent.findMany({ orderBy: [{ processedAt: "desc" }, { id: "desc" }], take, select: { id: true, provider: true, externalEventId: true, type: true, processedAt: true } });
}

export async function listRecentPurchases(take: number): Promise<AdminPurchaseRow[]> {
  return listPurchases({ sort: "newest", skip: 0, take });
}
