import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser } from "@/server/auth/admin";

const repo = vi.hoisted(() => ({
  countTotals: vi.fn(),
  countEventsForPlan: vi.fn(),
  sumPaidRevenue: vi.fn(),
  countPaidPurchasesByPlanAndKind: vi.fn(),
  countPaidAccessWindows: vi.fn(),
  getMediaTotals: vi.fn(),
  listRecentUsers: vi.fn(),
  listRecentEvents: vi.fn(),
  listRecentPublications: vi.fn(),
  listRecentPurchases: vi.fn(),
  listRecentWebhookEvents: vi.fn(),
  countUsers: vi.fn(),
  listUsers: vi.fn(),
  findUser: vi.fn(),
  countEvents: vi.fn(),
  listEvents: vi.fn(),
  findEvent: vi.fn(),
  countPurchases: vi.fn(),
  listPurchases: vi.fn(),
  findPurchase: vi.fn(),
  listTemplates: vi.fn(),
  updateTemplateSettings: vi.fn(),
  countWebhookEvents: vi.fn(),
  listWebhookEvents: vi.fn(),
  listAuditLog: vi.fn(),
  listRecentAuditLog: vi.fn(),
}));
vi.mock("@/server/repositories/admin", () => repo);

import { adminHref, ADMIN_PAGE_SIZE, pageWindow, parseChoice, parsePage, parseSearch } from "@/lib/admin/query";
import { maskExternalId } from "@/lib/admin/mask";
import { getAdminEvent, listAdminEvents } from "@/server/admin/events";
import { getSystemHealth } from "@/server/admin/health";
import { getAdminOverview, summarizeRevenue } from "@/server/admin/overview";
import { getAdminPurchase, listAdminPurchases } from "@/server/admin/purchases";
import { listAdminTemplates, updateAdminTemplate } from "@/server/admin/templates";
import { getAdminUser, listAdminUsers } from "@/server/admin/users";
import { listAdminWebhookEvents } from "@/server/admin/webhooks";

const admin = { id: "usr_admin", email: "admin@example.com", name: "Admin", role: "ADMIN" } as AdminUser;
const NOW = new Date("2026-09-26T12:00:00Z");
const at = (iso: string) => new Date(iso);

const purchaseRow = (over: Record<string, unknown> = {}) => ({ id: "pur_1", kind: "INITIAL", plan: "ESSENTIAL", status: "PAID", amount: 49900, currency: "MXN", provider: "STRIPE", createdAt: at("2026-09-12T10:00:00Z"), paidAt: at("2026-09-12T10:01:00Z"), ...over });

beforeEach(() => vi.clearAllMocks());

describe("(52) resumen: cifras reales por plan, ingresos solo PAID, monedas separadas", () => {
  const seed = () => {
    repo.countTotals.mockResolvedValue({ users: 12, events: 9, publishedInvitations: 5, guests: 140, rsvps: 61, paidPurchases: 4 });
    repo.countEventsForPlan.mockImplementation(async (plan: string) => ({ FREE: 5, ESSENTIAL: 3, PREMIUM: 1 })[plan]);
    repo.sumPaidRevenue.mockImplementation(async (since?: Date) => (since ? [{ currency: "MXN", amountMinor: 49900, count: 1 }] : [{ currency: "MXN", amountMinor: 129700, count: 3 }, { currency: "USD", amountMinor: 1000, count: 1 }]));
    repo.countPaidPurchasesByPlanAndKind.mockResolvedValue([
      { plan: "ESSENTIAL", kind: "INITIAL", count: 2 },
      { plan: "PREMIUM", kind: "INITIAL", count: 1 },
      { plan: "PREMIUM", kind: "UPGRADE", count: 1 },
    ]);
    repo.countPaidAccessWindows.mockResolvedValue({ expiringSoon: 2, expired: 1 });
    repo.getMediaTotals.mockResolvedValue({ count: 30, sizeBytes: 9_000_000, stalePending: 1, unreferencedReady: 4 });
    repo.listRecentUsers.mockResolvedValue([]);
    repo.listRecentEvents.mockResolvedValue([]);
    repo.listRecentPublications.mockResolvedValue([]);
    repo.listRecentPurchases.mockResolvedValue([{ ...purchaseRow(), event: { id: "evt_1", title: "Boda" }, user: { id: "usr_1", name: "Ana", email: "ana@example.com" } }]);
    repo.listRecentAuditLog.mockResolvedValue([]);
    repo.listRecentWebhookEvents.mockResolvedValue([{ id: "wh_1", provider: "STRIPE", externalEventId: "evt_1Nabcdefghijklmn9xyz", type: "checkout.session.completed", processedAt: NOW }]);
  };

  it("(52.1/52.5) los conteos y el plan efectivo por evento salen del repositorio (uno por plan) y los tipos de compra se separan", async () => {
    seed();
    const overview = await getAdminOverview(admin, NOW);
    expect(overview.totals).toEqual({ users: 12, events: 9, publishedInvitations: 5, guests: 140, rsvps: 61, paidPurchases: 4 });
    expect(overview.eventsByPlan).toEqual({ FREE: 5, ESSENTIAL: 3, PREMIUM: 1 });
    expect(repo.countEventsForPlan.mock.calls.map(([plan]) => plan)).toEqual(["FREE", "ESSENTIAL", "PREMIUM"]);
    expect(overview.purchaseMix).toEqual({ essential: 2, premium: 1, upgrades: 1 });
    expect(overview.access).toEqual({ windowDays: 30, expiringSoon: 2, expired: 1 });
    expect(overview.media).toMatchObject({ count: 30, sizeBytes: 9_000_000, stalePending: 1, unreferencedReady: 4 });
  });

  it("(7/30) los ingresos: total y últimos 30 días; lo que no es MXN va aparte y NO se suma", async () => {
    seed();
    const { revenue } = await getAdminOverview(admin, NOW);
    expect(revenue.total).toEqual({ currency: "MXN", amountMinor: 129700, count: 3, other: [{ currency: "USD", amountMinor: 1000, count: 1 }] });
    expect(revenue.last30Days).toEqual({ currency: "MXN", amountMinor: 49900, count: 1, other: [] });
    // La ventana de 30 días parte de la hora del servidor.
    expect(repo.sumPaidRevenue).toHaveBeenCalledWith(new Date("2026-08-27T12:00:00Z"));
  });

  it("(52.4) summarizeRevenue: solo MXN es el total; sin compras en MXN el total es 0, no otra moneda", () => {
    expect(summarizeRevenue([{ currency: "USD", amountMinor: 5000, count: 2 }])).toEqual({ currency: "MXN", amountMinor: 0, count: 0, other: [{ currency: "USD", amountMinor: 5000, count: 2 }] });
    expect(summarizeRevenue([])).toEqual({ currency: "MXN", amountMinor: 0, count: 0, other: [] });
  });

  it("la actividad reciente enmascara los ids de webhook y no incluye contenido", async () => {
    seed();
    const { activity } = await getAdminOverview(admin, NOW);
    expect(activity.webhooks[0]).toEqual({ id: "wh_1", provider: "STRIPE", maskedExternalEventId: "evt_••••••9xyz", type: "checkout.session.completed", processedAt: NOW });
    expect(activity.purchases[0]).toMatchObject({ amountMinor: 49900, status: "PAID", event: { title: "Boda" } });
  });
});

describe("(14/16/17/18/19) eventos: plan efectivo, acceso, historial y solo conteos de invitados", () => {
  const eventRow = (over: Record<string, unknown> = {}) => ({
    id: "evt_1",
    title: "Andrea & Fernando",
    type: "WEDDING",
    startsAt: at("2027-05-17T18:00:00Z"),
    timezone: "America/Mexico_City",
    createdAt: at("2026-09-01T00:00:00Z"),
    updatedAt: at("2026-09-20T00:00:00Z"),
    paidAccessEndsAt: at("2027-06-16T18:00:00Z"),
    owner: { id: "usr_1", name: "Ana", email: "ana@example.com" },
    invitation: { slug: "andrea-y-fernando", template: { name: "Magnolia", slug: "magnolia" }, columns: { status: "PUBLISHED", draftRevision: 6, publishedRevision: 4, publishedVersion: 2 } },
    purchases: [purchaseRow(), purchaseRow({ id: "pur_2", kind: "UPGRADE", plan: "PREMIUM", amount: 30000, createdAt: at("2026-09-20T10:00:00Z") })],
    counts: { guests: 40, rsvps: 22, galleryImages: 6, mediaAssets: 8, mediaBytes: 2048 },
    guestStatus: [{ status: "ATTENDING", count: 15 }, { status: "DECLINED", count: 4 }, { status: "PENDING", count: 18 }, { status: "MAYBE", count: 3 }],
    ...over,
  });

  it("(16/17/18) el detalle muestra plan efectivo (Premium tras la mejora), historial completo, acceso activo y RSVP con «Tal vez» como pendiente", async () => {
    repo.findEvent.mockResolvedValue(eventRow());
    const event = await getAdminEvent(admin, "evt_1", NOW);
    expect(event).toMatchObject({ plan: "PREMIUM", accessState: "active", accessActive: true, publication: "changes", publishedVersion: 2, invitationSlug: "andrea-y-fernando", guestCount: 40, galleryCount: 6, mediaCount: 8 });
    expect(event?.rsvp).toEqual({ received: 22, confirmed: 15, declined: 4, pending: 21 });
    // El historial NO se sobrescribe: dos filas, en el orden en que llegan (antigua → reciente).
    expect(event?.purchases.map((purchase) => [purchase.kind, purchase.plan, purchase.amountMinor, purchase.status])).toEqual([
      ["INITIAL", "ESSENTIAL", 49900, "PAID"],
      ["UPGRADE", "PREMIUM", 30000, "PAID"],
    ]);
  });

  it("(18) expirado cuando paidAccessEndsAt ya pasó; «sin compra» para un evento Gratis (no expira)", async () => {
    repo.findEvent.mockResolvedValue(eventRow({ paidAccessEndsAt: at("2026-09-01T00:00:00Z") }));
    expect(await getAdminEvent(admin, "evt_1", NOW)).toMatchObject({ accessState: "expired", accessActive: false });
    repo.findEvent.mockResolvedValue(eventRow({ purchases: [], paidAccessEndsAt: null }));
    expect(await getAdminEvent(admin, "evt_1", NOW)).toMatchObject({ plan: "FREE", accessState: "free", accessActive: true });
  });

  it("un pago pendiente, fallido o reembolsado no cambia el plan efectivo que muestra la consola", async () => {
    repo.findEvent.mockResolvedValue(eventRow({ purchases: [purchaseRow({ status: "REFUNDED" }), purchaseRow({ id: "pur_3", status: "PENDING", plan: "PREMIUM" })], paidAccessEndsAt: null }));
    expect((await getAdminEvent(admin, "evt_1", NOW))?.plan).toBe("FREE");
  });

  it("(5) el administrador inspecciona CUALQUIER evento: la consulta no exige ser propietario; un id inexistente devuelve null", async () => {
    repo.findEvent.mockResolvedValue(eventRow({ owner: { id: "usr_otro", name: null, email: "otro@example.com" } }));
    expect((await getAdminEvent(admin, "evt_ajeno", NOW))?.owner.id).toBe("usr_otro");
    expect(repo.findEvent).toHaveBeenCalledWith("evt_ajeno");
    repo.findEvent.mockResolvedValue(null);
    expect(await getAdminEvent(admin, "nada", NOW)).toBeNull();
  });

  it("(19) el DTO del evento no tiene ningún campo de datos personales de invitados", async () => {
    repo.findEvent.mockResolvedValue(eventRow());
    const keys = JSON.stringify(Object.keys((await getAdminEvent(admin, "evt_1", NOW)) as object));
    expect(keys).not.toMatch(/inviteToken|phone|guests"|messages|answers|dietary/i);
  });

  it("(14/15) la lista deriva el plan y la publicación de cada fila y envía los filtros y la ventana al repositorio", async () => {
    repo.countEvents.mockResolvedValue(60);
    repo.listEvents.mockResolvedValue([
      { id: "evt_1", title: "A", type: "WEDDING", startsAt: NOW, createdAt: NOW, paidAccessEndsAt: null, owner: { id: "u", name: null, email: "a@example.com" }, template: null, publication: null, purchases: [] },
      { id: "evt_2", title: "B", type: "BIRTHDAY", startsAt: NOW, createdAt: NOW, paidAccessEndsAt: null, owner: { id: "u", name: null, email: "a@example.com" }, template: { name: "Ivory", slug: "ivory" }, publication: { status: "PUBLISHED", draftRevision: 1, publishedRevision: 1, publishedVersion: 1 }, purchases: [{ plan: "ESSENTIAL", status: "PAID" }] },
    ]);
    const page = await listAdminEvents(admin, { page: 3, plan: "ESSENTIAL", publication: "published", sort: "newest" });
    expect(page.rows.map((row) => [row.plan, row.publication])).toEqual([["FREE", "draft"], ["ESSENTIAL", "published"]]);
    expect(page.window).toMatchObject({ page: 3, pageCount: 3, skip: 50, take: 25, total: 60 });
    expect(repo.listEvents).toHaveBeenCalledWith({ plan: "ESSENTIAL", publication: "published", sort: "newest", skip: 50, take: 25 });
    expect(repo.countEvents).toHaveBeenCalledWith({ plan: "ESSENTIAL", publication: "published", sort: "newest" });
  });
});

describe("(10-13) usuarios", () => {
  it("(11) la lista pagina en el servidor (25 por defecto) y acota una página fuera de rango a la última", async () => {
    repo.countUsers.mockResolvedValue(51);
    repo.listUsers.mockResolvedValue([]);
    const page = await listAdminUsers(admin, { page: 99, q: "ana", sort: "newest" });
    expect(page.window).toMatchObject({ page: 3, pageCount: 3, pageSize: ADMIN_PAGE_SIZE, skip: 50 });
    expect(repo.listUsers).toHaveBeenCalledWith({ q: "ana", sort: "newest", skip: 50, take: 25 });
  });

  it("(12/13) el detalle lista los eventos con su plan efectivo y compras; el rol se muestra, sin secretos ni id de Clerk", async () => {
    repo.findUser.mockResolvedValue({
      id: "usr_1",
      name: "Ana",
      email: "ana@example.com",
      role: "USER",
      clerkLinked: true,
      createdAt: at("2026-08-01T00:00:00Z"),
      eventCount: 2,
      hasBillingCustomer: true,
      events: [
        { id: "evt_1", title: "Boda", startsAt: NOW, paidAccessEndsAt: null, publication: { status: "DRAFT", draftRevision: 1, publishedRevision: 0, publishedVersion: 0 }, purchases: [purchaseRow(), purchaseRow({ id: "pur_2", status: "FAILED", plan: "PREMIUM", kind: "UPGRADE" })] },
        { id: "evt_2", title: "XV", startsAt: NOW, paidAccessEndsAt: null, publication: null, purchases: [] },
      ],
    });
    const user = await getAdminUser(admin, "usr_1");
    expect(user).toMatchObject({ role: "USER", clerkLinked: true, hasBillingCustomer: true });
    expect(user?.events.map((event) => [event.plan, event.publication, event.purchases.length])).toEqual([["ESSENTIAL", "draft", 2], ["FREE", "draft", 0]]);
    expect(JSON.stringify(user)).not.toMatch(/clerkUserId|password|token|secret/i);
  });
});

describe("(25-31) compras: solo lectura, con ids enmascarados", () => {
  it("(26/55.1/55.2/55.3) lista con filtros; INITIAL y UPGRADE conservan importe y moneda", async () => {
    repo.countPurchases.mockResolvedValue(2);
    repo.listPurchases.mockResolvedValue([
      { ...purchaseRow(), event: { id: "evt_1", title: "Boda" }, user: { id: "usr_1", name: "Ana", email: "ana@example.com" } },
      { ...purchaseRow({ id: "pur_2", kind: "UPGRADE", plan: "PREMIUM", amount: 30000 }), event: { id: "evt_1", title: "Boda" }, user: { id: "usr_1", name: "Ana", email: "ana@example.com" } },
    ]);
    const page = await listAdminPurchases(admin, { page: 1, status: "PAID", sort: "newest" });
    expect(page.rows.map((row) => [row.kind, row.plan, row.amountMinor, row.currency, row.status])).toEqual([["INITIAL", "ESSENTIAL", 49900, "MXN", "PAID"], ["UPGRADE", "PREMIUM", 30000, "MXN", "PAID"]]);
    expect(repo.listPurchases).toHaveBeenCalledWith({ status: "PAID", sort: "newest", skip: 0, take: 25 });
  });

  it("(27/28) el detalle enmascara sesión, pago y cliente del proveedor (cs_••••••wxyz) y no expone los ids completos", async () => {
    repo.findPurchase.mockResolvedValue({
      ...purchaseRow(),
      updatedAt: NOW,
      accessStartsAt: NOW,
      accessEndsAt: NOW,
      providerCheckoutSessionId: "cs_test_a1B2c3D4e5F6g7H8wxyz",
      providerPaymentIntentId: "pi_3Nabcdefghijklmnopq1234",
      providerCustomerId: "cus_Nabcdefghijkl1234",
      event: { id: "evt_1", title: "Boda", startsAt: NOW },
      user: { id: "usr_1", name: "Ana", email: "ana@example.com" },
    });
    const purchase = await getAdminPurchase(admin, "pur_1");
    expect(purchase).toMatchObject({ maskedCheckoutSessionId: "cs_test_••••••wxyz", maskedPaymentIntentId: "pi_••••••1234", maskedProviderCustomerId: "cus_••••••1234", hasProviderCustomer: true });
    const text = JSON.stringify(purchase);
    for (const secret of ["a1B2c3D4e5F6g7H8", "Nabcdefghijklmnopq", "Nabcdefghijkl1234".slice(0, 12)]) expect(text).not.toContain(secret);
  });

  it("(29) la consola no expone funciones que muten compras (PAID manual, Premium, reembolso, cancelar, editar importe)", async () => {
    const purchases = await import("@/server/admin/purchases");
    expect(Object.keys(purchases).sort()).toEqual(["getAdminPurchase", "listAdminPurchases", "toPurchaseLine", "toPurchaseListItem"]);
    const repositoryFunctions = Object.keys(repo);
    expect(repositoryFunctions.filter((name) => /(create|update|set|mark|refund|cancel|delete|save)/i.test(name))).toEqual(["updateTemplateSettings"]);
  });

  it("(32/33) webhooks: id enmascarado, sin contenido ni firma", async () => {
    repo.countWebhookEvents.mockResolvedValue(1);
    repo.listWebhookEvents.mockResolvedValue([{ id: "wh_1", provider: "STRIPE", externalEventId: "evt_1Nabcdefghijklmn9xyz", type: "charge.refunded", processedAt: NOW }]);
    const page = await listAdminWebhookEvents(admin, { page: 1 });
    expect(page.rows).toEqual([{ id: "wh_1", provider: "STRIPE", maskedExternalEventId: "evt_••••••9xyz", type: "charge.refunded", processedAt: NOW }]);
    expect(JSON.stringify(page)).not.toMatch(/payload|body|signature|whsec/i);
  });
});

describe("(20-24) plantillas: solo visibilidad y plan mínimo", () => {
  it("(54.1/54.2) el administrador cambia publicationStatus y minimumPlan", async () => {
    repo.updateTemplateSettings.mockResolvedValue({ id: "tpl_1", slug: "magnolia", name: "Magnolia", eventType: "WEDDING", designStatus: "IMPLEMENTED", publicationStatus: "DRAFT", minimumPlan: "PREMIUM", invitationCount: 3 });
    const result = await updateAdminTemplate(admin, { templateId: "tpl_1", publicationStatus: "DRAFT", minimumPlan: "PREMIUM" });
    expect(result).toMatchObject({ ok: true, template: { publicationStatus: "DRAFT", minimumPlan: "PREMIUM" } });
    expect(repo.updateTemplateSettings).toHaveBeenCalledWith("tpl_1", { publicationStatus: "DRAFT", minimumPlan: "PREMIUM" }, "usr_admin");
  });

  it("(54.4) designStatus, slug y name no se reenvían aunque lleguen en la entrada", async () => {
    repo.updateTemplateSettings.mockResolvedValue({ id: "tpl_1", name: "Magnolia" });
    await updateAdminTemplate(admin, { templateId: "tpl_1", minimumPlan: "ESSENTIAL", designStatus: "CONCEPT", slug: "x", name: "Otro" } as never);
    expect(repo.updateTemplateSettings).toHaveBeenCalledWith("tpl_1", { minimumPlan: "ESSENTIAL" }, "usr_admin");
  });

  it("valida la entrada: id vacío, valores fuera de lista, sin cambios y plantilla inexistente", async () => {
    expect(await updateAdminTemplate(admin, { templateId: "", minimumPlan: "PREMIUM" })).toEqual({ ok: false, code: "invalid" });
    expect(await updateAdminTemplate(admin, { templateId: 5, minimumPlan: "PREMIUM" })).toEqual({ ok: false, code: "invalid" });
    expect(await updateAdminTemplate(admin, { templateId: "t", publicationStatus: "OCULTA" })).toEqual({ ok: false, code: "invalid" });
    expect(await updateAdminTemplate(admin, { templateId: "t", minimumPlan: "GOLD" })).toEqual({ ok: false, code: "invalid" });
    expect(await updateAdminTemplate(admin, { templateId: "t", publicationStatus: "", minimumPlan: "" })).toEqual({ ok: false, code: "invalid" });
    expect(repo.updateTemplateSettings).not.toHaveBeenCalled();
    repo.updateTemplateSettings.mockResolvedValue(null);
    expect(await updateAdminTemplate(admin, { templateId: "no-existe", minimumPlan: "FREE" })).toEqual({ ok: false, code: "not_found" });
  });

  it("(22) cambiar el plan mínimo NO toca eventos: no existe ninguna escritura sobre Event ni EventPurchase en el servicio", async () => {
    const source = readFileSync("server/admin/templates.ts", "utf8");
    const used = [...source.matchAll(/repo\.(\w+)\(/g)].map((match) => match[1]);
    expect(new Set(used)).toEqual(new Set(["listTemplates", "updateTemplateSettings"]));
    expect(source).not.toMatch(/prisma/);
    repo.listTemplates.mockResolvedValue([]);
    expect(await listAdminTemplates(admin)).toEqual([]);
  });
});

describe("(35/57) salud del sistema: solo booleanos y nombres de variables", () => {
  const FULL = {
    DATABASE_URL: "postgresql://usuario:CONTRASENA_SECRETA@host/db",
    S3_ENDPOINT: "https://cuenta.r2.example.com",
    S3_BUCKET: "bucket-secreto",
    S3_ACCESS_KEY_ID: "AKIA_CLAVE_ACCESO",
    S3_SECRET_ACCESS_KEY: "SECRETO_S3_MUY_LARGO",
    S3_PUBLIC_BASE_URL: "https://media.example.com",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_CLERK_PUBLICA",
    CLERK_SECRET_KEY: "sk_test_CLERK_SECRETA",
    STRIPE_SECRET_KEY: "sk_test_STRIPE_SECRETA",
    STRIPE_WEBHOOK_SECRET: "whsec_STRIPE_WEBHOOK",
    STRIPE_PRICE_ESSENTIAL_ONE_TIME: "price_ESENCIAL",
    STRIPE_PRICE_PREMIUM_ONE_TIME: "price_PREMIUM",
    STRIPE_PRICE_ESSENTIAL_TO_PREMIUM: "price_MEJORA",
  };

  it("todo configurado → cuatro servicios «configured» y nada que falte", () => {
    expect(getSystemHealth(FULL)).toEqual([
      { id: "database", configured: true, missing: [] },
      { id: "storage", configured: true, missing: [] },
      { id: "clerk", configured: true, missing: [] },
      { id: "stripe", configured: true, missing: [] },
    ]);
  });

  it("nunca devuelve el CONTENIDO de una variable, ni parcial: la salida completa no contiene ningún valor", () => {
    const partial = { ...FULL, STRIPE_WEBHOOK_SECRET: "", STRIPE_PRICE_PREMIUM_ONE_TIME: "  ", S3_SECRET_ACCESS_KEY: undefined };
    const health = getSystemHealth(partial);
    const text = JSON.stringify(health);
    for (const value of Object.values(FULL)) expect(text).not.toContain(value);
    expect(health.find((item) => item.id === "stripe")).toEqual({ id: "stripe", configured: false, missing: ["STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PREMIUM_ONE_TIME"] });
    expect(health.find((item) => item.id === "storage")).toEqual({ id: "storage", configured: false, missing: ["S3_SECRET_ACCESS_KEY"] });
    for (const item of health) expect(Object.keys(item).sort()).toEqual(["configured", "id", "missing"]);
  });

  it("Stripe se considera configurado con la clave secreta, el secreto del webhook y los tres precios de pago único", () => {
    const { missing } = getSystemHealth({}).find((item) => item.id === "stripe") ?? { missing: [] };
    expect(missing).toEqual(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ESSENTIAL_ONE_TIME", "STRIPE_PRICE_PREMIUM_ONE_TIME", "STRIPE_PRICE_ESSENTIAL_TO_PREMIUM"]);
  });
});

describe("utilidades puras de la consola", () => {
  it("(40/41) los parámetros de la URL se validan: página, búsqueda y listas blancas", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["7", "9"])).toBe(7);
    expect(parseSearch("   ")).toBeUndefined();
    expect(parseSearch("  ana   maría ")).toBe("ana maría");
    expect(parseSearch("x".repeat(500))).toHaveLength(80);
    expect(parseChoice("PAID", ["PAID", "FAILED"] as const)).toBe("PAID");
    expect(parseChoice("'; DROP TABLE", ["PAID", "FAILED"] as const)).toBeUndefined();
    expect(parseChoice(undefined, ["PAID"] as const)).toBeUndefined();
  });

  it("la ventana de paginación acota la página y calcula skip/take", () => {
    expect(pageWindow(1, 0)).toMatchObject({ page: 1, pageCount: 1, skip: 0 });
    expect(pageWindow(2, 26)).toMatchObject({ page: 2, pageCount: 2, skip: 25, take: 25 });
    expect(pageWindow(50, 26).page).toBe(2);
  });

  it("los enlaces de lista omiten valores vacíos y la página 1", () => {
    expect(adminHref("/admin/users", { q: "ana", page: 1, sort: undefined, plan: "" })).toBe("/admin/users?q=ana");
    expect(adminHref("/admin/users", { page: 3, status: "PAID" })).toBe("/admin/users?page=3&status=PAID");
    expect(adminHref("/admin/users", {})).toBe("/admin/users");
  });

  it("(27) las máscaras conservan el prefijo y los últimos cuatro caracteres de un id largo, y ocultan uno corto", () => {
    expect(maskExternalId("cus_Nabcdefghijkl1234")).toBe("cus_••••••1234");
    expect(maskExternalId("cs_test_a1B2c3D4e5F6g7H8wxyz")).toBe("cs_test_••••••wxyz");
    expect(maskExternalId("evt_corto")).toBe("evt_••••••");
    expect(maskExternalId(null)).toBe("—");
    expect(maskExternalId("")).toBe("—");
  });
});
