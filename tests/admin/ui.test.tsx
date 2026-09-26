import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { visibleText } from "../invitation/helpers";

const requireAdmin = vi.hoisted(() => vi.fn());
const services = vi.hoisted(() => ({
  getAdminOverview: vi.fn(),
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  listAdminEvents: vi.fn(),
  getAdminEvent: vi.fn(),
  listAdminPurchases: vi.fn(),
  getAdminPurchase: vi.fn(),
  listAdminTemplates: vi.fn(),
  listAdminWebhookEvents: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/events", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), redirect: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/server/auth/admin", () => ({ requireAdmin, isCurrentUserAdmin: vi.fn() }));
vi.mock("@/server/admin/overview", () => ({ getAdminOverview: services.getAdminOverview }));
vi.mock("@/server/admin/users", () => ({ listAdminUsers: services.listAdminUsers, getAdminUser: services.getAdminUser }));
vi.mock("@/server/admin/events", () => ({ listAdminEvents: services.listAdminEvents, getAdminEvent: services.getAdminEvent }));
vi.mock("@/server/admin/purchases", () => ({ listAdminPurchases: services.listAdminPurchases, getAdminPurchase: services.getAdminPurchase }));
vi.mock("@/server/admin/templates", () => ({ listAdminTemplates: services.listAdminTemplates }));
vi.mock("@/server/admin/webhooks", () => ({ listAdminWebhookEvents: services.listAdminWebhookEvents }));
vi.mock("@/app/(site)/admin/templates/actions", () => ({ updateTemplateAction: vi.fn() }));
vi.mock("@/app/(site)/admin/actions", () => ({ analyzeOrphansAction: vi.fn() }));
/** Radix pinta el diálogo en un portal (no existe al renderizar en servidor): contenedores planos. */
vi.mock("@/components/ui/dialog", () => {
  const box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Dialog: box, DialogTrigger: box, DialogContent: box, DialogHeader: box, DialogTitle: box, DialogDescription: box, DialogFooter: box, DialogClose: box };
});
vi.mock("@/components/ui/dropdown-menu", () => {
  const box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { DropdownMenu: box, DropdownMenuTrigger: box, DropdownMenuContent: box, DropdownMenuItem: box, DropdownMenuLabel: box, DropdownMenuSeparator: box };
});
vi.mock("@/components/dashboard/sign-out-menu-item", () => ({ SignOutMenuItem: () => <span>Cerrar sesión</span> }));

import AdminEventPage from "@/app/(site)/admin/events/[id]/page";
import AdminEventsPage from "@/app/(site)/admin/events/page";
import AdminOverviewPage from "@/app/(site)/admin/page";
import AdminPurchasePage from "@/app/(site)/admin/purchases/[id]/page";
import AdminPurchasesPage from "@/app/(site)/admin/purchases/page";
import AdminTemplatesPage from "@/app/(site)/admin/templates/page";
import AdminUserPage from "@/app/(site)/admin/users/[id]/page";
import AdminUsersPage from "@/app/(site)/admin/users/page";
import AdminWebhooksPage from "@/app/(site)/admin/webhooks/page";
import { AdminShell } from "@/components/admin/admin-shell";
import { AccessBadge, PlanBadge, PublicationBadge, PurchaseStatusBadge, RoleBadge } from "@/components/admin/badges";
import { AdminTable } from "@/components/admin/data-table";
import { AdminFilters } from "@/components/admin/filters";
import { AdminPagination } from "@/components/admin/pagination";
import { requiredConfirmations, TemplateEditDialog } from "@/components/admin/template-edit-dialog";
import { UserMenu } from "@/components/dashboard/user-menu";
import { adminCopy } from "@/lib/admin/copy";
import { getActiveAdminNavId } from "@/lib/admin/navigation";
import { pageWindow } from "@/lib/admin/query";
import type { AdminOverviewDto, AdminTemplateDto } from "@/server/admin/dto";

const ROOT = process.cwd();
const NOW = new Date("2026-09-26T12:00:00Z");
const admin = { id: "usr_admin", email: "admin@example.com", name: "Admin", role: "ADMIN" };
const render = async (page: Promise<React.ReactNode> | React.ReactNode) => renderToStaticMarkup(<>{await page}</>);
const params = (value: Record<string, string> = {}) => Promise.resolve(value);

const line = (over: Record<string, unknown> = {}) => ({ id: "pur_1", kind: "INITIAL", plan: "ESSENTIAL", status: "PAID", amountMinor: 49900, currency: "MXN", provider: "STRIPE", createdAt: NOW, paidAt: NOW, ...over });
const person = { id: "usr_1", name: "Ana Pérez", email: "ana@example.com" };

const overview: AdminOverviewDto = {
  generatedAt: NOW,
  totals: { users: 12, events: 9, publishedInvitations: 5, guests: 1400, rsvps: 61, paidPurchases: 4 },
  eventsByPlan: { FREE: 5, ESSENTIAL: 3, PREMIUM: 1 },
  revenue: { total: { currency: "MXN", amountMinor: 129700, count: 3, other: [{ currency: "USD", amountMinor: 1000, count: 1 }] }, last30Days: { currency: "MXN", amountMinor: 49900, count: 1, other: [] } },
  purchaseMix: { essential: 2, premium: 1, upgrades: 1 },
  access: { windowDays: 30, expiringSoon: 2, expired: 1 },
  media: { count: 30, sizeBytes: 9_000_000, stalePending: 1, staleHours: 24, unreferencedReady: null },
  health: [
    { id: "database", configured: true, missing: [] },
    { id: "storage", configured: false, missing: ["S3_BUCKET"] },
    { id: "clerk", configured: true, missing: [] },
    { id: "stripe", configured: false, missing: ["STRIPE_WEBHOOK_SECRET"] },
  ],
  activity: {
    audit: [{ id: "aud_1", createdAt: NOW, actor: { id: "usr_admin", name: "Admin", email: "admin@example.com" }, target: "Plantilla · Magnolia", changes: [{ field: "Visibilidad", from: "Visible", to: "Oculta" }] }],
    users: [{ ...person, createdAt: NOW }],
    events: [{ id: "evt_1", title: "Andrea & Fernando", createdAt: NOW }],
    publications: [{ id: "pub_1", eventId: "evt_1", eventTitle: "Andrea & Fernando", version: 2, createdAt: NOW }],
    purchases: [{ ...line(), event: { id: "evt_1", title: "Andrea & Fernando" }, user: person }] as never,
    webhooks: [{ id: "wh_1", provider: "STRIPE", maskedExternalEventId: "evt_••••••9xyz", type: "checkout.session.completed", processedAt: NOW }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(admin);
});

describe("(5/6) marco de la consola", () => {
  const shell = () => renderToStaticMarkup(<AdminShell user={{ name: "Admin", email: "admin@example.com" }} canSignOut>contenido</AdminShell>);

  it("marca «Hilo Luna» + ADMIN, seis secciones y «Volver al panel»; la activa se marca con aria-current", () => {
    const html = shell();
    const text = visibleText(html);
    expect(text).toContain("Hilo Luna");
    expect(text).toContain("ADMIN");
    for (const label of ["Resumen", "Usuarios", "Eventos", "Plantillas", "Compras", "Webhooks", "Volver al panel"]) expect(text, label).toContain(label);
    for (const href of ["/admin", "/admin/users", "/admin/events", "/admin/templates", "/admin/purchases", "/admin/webhooks", "/dashboard/events"]) expect(html, href).toContain(`href="${href}"`);
    expect(html.match(/aria-current="page"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin\/events"|<a[^>]*href="\/admin\/events"[^>]*aria-current="page"/);
    expect(html).toContain('id="main"');
    expect(html).toContain("Saltar al contenido");
  });

  it("es independiente del panel de clientes (marca propia) y usa solo tokens del producto, nunca --inv-*", () => {
    const html = shell();
    expect(html).toContain('data-layout="admin"');
    expect(html).not.toContain("--inv-");
    for (const file of filesUnder(["components/admin", "app/(site)/admin", "lib/admin"])) expect(code(file), file).not.toMatch(/--inv-|#[0-9a-fA-F]{3,8}\b/);
  });

  it("la ruta activa sale de la URL (las páginas de detalle activan su lista)", () => {
    expect(getActiveAdminNavId("/admin")).toBe("overview");
    expect(getActiveAdminNavId("/admin/users/usr_1")).toBe("users");
    expect(getActiveAdminNavId("/admin/purchases")).toBe("purchases");
    expect(getActiveAdminNavId("/dashboard")).toBeUndefined();
  });

  it("(47) el enlace «Administración» solo aparece para administradores", () => {
    const user = { name: "Ana", email: "ana@example.com" };
    expect(visibleText(renderToStaticMarkup(<UserMenu user={user} canSignOut isAdmin />))).toContain("Administración");
    expect(renderToStaticMarkup(<UserMenu user={user} canSignOut isAdmin />)).toContain('href="/admin"');
    for (const html of [renderToStaticMarkup(<UserMenu user={user} canSignOut />), renderToStaticMarkup(<UserMenu user={user} canSignOut isAdmin={false} />)]) {
      expect(html).not.toContain('href="/admin"');
      expect(visibleText(html)).not.toContain("Administración");
    }
  });
});

describe("(6/30/35/36/37/38/39) resumen", () => {
  it("muestra cifras reales, ingresos con MXN separado de otras monedas y sin datos de invitados", async () => {
    services.getAdminOverview.mockResolvedValue(overview);
    const html = await render(AdminOverviewPage());
    const text = visibleText(html);
    expect(requireAdmin).toHaveBeenCalled();
    for (const [label, value] of [["Usuarios", "12"], ["Eventos", "9"], ["Invitaciones publicadas", "5"], ["Invitados", "1,400"], ["RSVP recibidos", "61"], ["Compras pagadas", "4"]]) {
      expect(html, label).toMatch(new RegExp(`data-metric="${label}"[^>]*>[\\s\\S]*?${value}`));
    }
    expect(text).toContain("Ingresos brutos registrados");
    expect(text).toContain("$1,297 MXN");
    expect(text).toContain("$499 MXN");
    expect(text).toContain("Compras en otras monedas (no se suman ni se convierten):");
    expect(text).toContain("$10 USD");
    expect(text).toContain("Solo compras pagadas");
  });

  it("separa los eventos por plan efectivo, las compras por tipo y el acceso próximo a vencer / vencido", async () => {
    services.getAdminOverview.mockResolvedValue(overview);
    const html = await render(AdminOverviewPage());
    for (const [plan, count] of [["FREE", "5"], ["ESSENTIAL", "3"], ["PREMIUM", "1"]]) expect(html).toMatch(new RegExp(`data-plan-count="${plan}"[\\s\\S]*?tabular-nums">${count}<`));
    const text = visibleText(html);
    for (const expected of ["Compras Esencial", "Compras Premium", "Mejoras (Esencial → Premium)", "Acceso termina en los próximos 30 días", "Eventos de pago con acceso vencido", "Todavía no se bloquea la invitación pública al vencer"]) expect(text, expected).toContain(expected);
  });

  it("(35/57) salud: «Configurado» / «No configurado» con los NOMBRES de las variables que faltan, nunca valores", async () => {
    services.getAdminOverview.mockResolvedValue(overview);
    const html = await render(AdminOverviewPage());
    expect(html).toMatch(/data-health="database" data-configured="true"/);
    expect(html).toMatch(/data-health="stripe" data-configured="false"/);
    const text = visibleText(html);
    expect(text).toContain("Configurado");
    expect(text).toContain("No configurado");
    expect(text).toContain("Falta: STRIPE_WEBHOOK_SECRET");
    expect(text).toContain("Falta: S3_BUCKET");
  });

  it("(37) archivos: cantidad, tamaño, huérfanos y «No disponible» si el diagnóstico falla", async () => {
    services.getAdminOverview.mockResolvedValue(overview);
    const text = visibleText(await render(AdminOverviewPage()));
    expect(text).toContain("Archivos guardados");
    expect(text).toContain("8.6 MB");
    expect(text).toContain("Subidas sin verificar (más de 24 h)");
    expect(text).toContain("No disponible");
    expect(text).toContain("no se borra nada automáticamente");
  });

  it("(9) actividad reciente: usuarios, eventos, publicaciones, compras y webhooks (con id enmascarado)", async () => {
    services.getAdminOverview.mockResolvedValue(overview);
    const html = await render(AdminOverviewPage());
    for (const heading of ["Nuevos usuarios", "Eventos creados", "Publicaciones", "Compras", "Webhooks"]) expect(visibleText(html), heading).toContain(heading);
    expect(html).toContain('href="/admin/events/evt_1"');
    expect(html).toContain('href="/admin/purchases/pur_1"');
    expect(html).toContain("evt_••••••9xyz");
    expect(visibleText(html)).toContain("Versión 2");
  });
});

describe("(14/40/50) listas: tablas semánticas, filtros con etiquetas y paginación", () => {
  const eventRow = { id: "evt_1", title: "Andrea & Fernando", type: "WEDDING", owner: person, template: { name: "Magnolia", slug: "magnolia" }, plan: "PREMIUM", publication: "changes", startsAt: NOW, createdAt: NOW };

  it("eventos: <table> con título, cabeceras scope=col, columnas de la especificación, badges con texto y enlaces a detalle", async () => {
    services.listAdminEvents.mockResolvedValue({ rows: [eventRow], window: pageWindow(1, 1) });
    const html = await render(AdminEventsPage({ searchParams: params() }));
    expect(html).toContain("<table");
    expect(html).toMatch(/<caption class="sr-only">Eventos<\/caption>/);
    const headers = [...html.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((match) => match[1]);
    expect(headers).toEqual(["Evento", "Propietario", "Tipo", "Plantilla", "Plan efectivo", "Publicación", "Fecha del evento", "Creado"]);
    expect(visibleText(html)).toContain("Cambios sin publicar");
    expect(visibleText(html)).toContain("Premium");
    expect(visibleText(html)).toContain("Boda");
    expect(html).toContain('href="/admin/events/evt_1"');
    expect(html).toContain('href="/admin/users/usr_1"');
  });

  it("(50) los filtros son un formulario GET con una etiqueta para cada control", async () => {
    services.listAdminEvents.mockResolvedValue({ rows: [], window: pageWindow(1, 0) });
    const html = await render(AdminEventsPage({ searchParams: params({ publication: "changes", type: "WEDDING", plan: "PREMIUM", q: "ana" }) }));
    expect(html).toContain('method="get"');
    expect(html).toContain('role="search"');
    for (const name of ["q", "publication", "type", "plan", "sort"]) {
      expect(html, name).toMatch(new RegExp(`<label for="filter-${name}"`));
      expect(html, name).toMatch(new RegExp(`id="filter-${name}"[^>]*name="${name}"|name="${name}"[^>]*id="filter-${name}"`));
    }
        expect(services.listAdminEvents).toHaveBeenCalledWith(admin, expect.objectContaining({ publication: "changes", type: "WEDDING", plan: "PREMIUM", q: "ana", page: 1 }));
    expect(visibleText(html)).toContain("No hay resultados con estos filtros.");
  });

  it("valores desconocidos en la URL se ignoran (lista blanca) y una página inválida vuelve a la 1", async () => {
    services.listAdminEvents.mockResolvedValue({ rows: [], window: pageWindow(1, 0) });
    await render(AdminEventsPage({ searchParams: params({ publication: "x", type: "'; DROP", plan: "GOLD", page: "-3", sort: "hack" }) }));
    expect(services.listAdminEvents).toHaveBeenCalledWith(admin, { page: 1, q: undefined, publication: undefined, type: undefined, plan: undefined, sort: "newest" });
  });

  it("la paginación conserva los filtros, marca los extremos como desactivados y dice «Página X de Y»", () => {
    const html = renderToStaticMarkup(<AdminPagination path="/admin/events" params={{ plan: "PREMIUM", q: "ana" }} window={pageWindow(2, 80)} />);
    expect(html).toContain('href="/admin/events?plan=PREMIUM&amp;q=ana"');
    expect(html).toContain('href="/admin/events?plan=PREMIUM&amp;q=ana&amp;page=3"');
    expect(visibleText(html)).toContain("Página 2 de 4");
    expect(visibleText(html)).toContain("80 resultados");
    const first = renderToStaticMarkup(<AdminPagination path="/admin/events" params={{}} window={pageWindow(1, 80)} />);
    expect(first).toMatch(/<button[^>]*disabled[^>]*aria-disabled="true"[^>]*>Anterior/);
    expect(renderToStaticMarkup(<AdminPagination path="/admin/events" params={{}} window={pageWindow(1, 3)} />)).not.toContain("Siguiente");
  });

  it("(48) la tabla y las tarjetas comparten contenido y solo una está visible a cada ancho (sin desbordamiento)", () => {
    const html = renderToStaticMarkup(<AdminTable caption="Prueba" rows={[{ id: "a", nombre: "Uno" }]} rowKey={(row) => row.id} empty="vacío" cards="xl" columns={[{ id: "n", header: "Nombre", primary: true, cell: (row) => row.nombre }, { id: "i", header: "Id", cell: (row) => row.id }]} />);
    expect(html).toContain("hidden xl:block");
    expect(html).toContain("xl:hidden");
    expect(html).toContain('<ul aria-label="Prueba"');
    expect(html).toContain("<dt");
    expect(renderToStaticMarkup(<AdminTable caption="P" rows={[] as never[]} rowKey={() => ""} empty="Nada por aquí" columns={[]} />)).toContain("Nada por aquí");
  });

  it("los filtros sin ningún valor no ofrecen «Limpiar»; con alguno, sí", () => {
    const fields = (value: string) => [{ kind: "search" as const, name: "q", label: "Buscar", value }];
    expect(visibleText(renderToStaticMarkup(<AdminFilters path="/admin/users" label="Filtros" fields={fields("")} />))).not.toContain("Limpiar");
    expect(visibleText(renderToStaticMarkup(<AdminFilters path="/admin/users" label="Filtros" fields={fields("ana")} />))).toContain("Limpiar");
  });

  it("usuarios: nombre, correo, eventos, de pago, registro y rol; sin «plan del usuario»", async () => {
    services.listAdminUsers.mockResolvedValue({ rows: [{ ...person, role: "ADMIN", createdAt: NOW, eventCount: 3, paidEventCount: 1 }], window: pageWindow(1, 1) });
    const html = await render(AdminUsersPage({ searchParams: params() }));
    expect([...html.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((match) => match[1])).toEqual(["Usuario", "Correo", "Eventos", "De pago", "Registro", "Rol"]);
    expect(visibleText(html)).toContain("Administrador");
    expect(visibleText(html)).not.toMatch(/Plan del usuario|Suscripci/i);
    expect(html).toContain('href="/admin/users/usr_1"');
  });

  it("compras: columnas, filtros por estado/tipo/plan y badges con texto (el estado no depende solo del color)", async () => {
    services.listAdminPurchases.mockResolvedValue({ rows: [{ ...line({ status: "REFUNDED", kind: "UPGRADE", plan: "PREMIUM", amountMinor: 30000 }), event: { id: "evt_1", title: "Boda" }, user: person }], window: pageWindow(1, 1) });
    const html = await render(AdminPurchasesPage({ searchParams: params({ status: "REFUNDED", kind: "UPGRADE", plan: "PREMIUM" }) }));
    expect([...html.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((match) => match[1])).toEqual(["Evento", "Usuario", "Plan", "Tipo", "Importe", "Moneda", "Estado", "Proveedor", "Fecha"]);
    expect(visibleText(html)).toContain("Reembolsada");
    expect(visibleText(html)).toContain("Mejora");
    expect(services.listAdminPurchases).toHaveBeenCalledWith(admin, expect.objectContaining({ status: "REFUNDED", kind: "UPGRADE", plan: "PREMIUM" }));
    for (const status of ["PAID", "PENDING", "FAILED", "REFUNDED", "CANCELED"] as const) expect(visibleText(renderToStaticMarkup(<PurchaseStatusBadge status={status} />)).length).toBeGreaterThan(3);
  });

  it("webhooks: proveedor, id parcial, fecha y estado «Procesado»; explica qué no se guarda", async () => {
    services.listAdminWebhookEvents.mockResolvedValue({ rows: [{ id: "wh_1", provider: "STRIPE", maskedExternalEventId: "evt_••••••9xyz", type: "charge.refunded", processedAt: NOW }], window: pageWindow(1, 1) });
    const html = await render(AdminWebhooksPage({ searchParams: params() }));
    expect(visibleText(html)).toContain("Procesado");
    expect(visibleText(html)).toContain("evt_••••••9xyz");
    expect(visibleText(html)).toContain("nunca se guarda el contenido ni la firma");
  });
});

describe("(16/17/18/19) detalle de evento y (27) de compra", () => {
  const detail = {
    id: "evt_1",
    title: "Andrea & Fernando",
    type: "WEDDING",
    owner: person,
    startsAt: NOW,
    timezone: "America/Mexico_City",
    invitationSlug: "andrea-y-fernando",
    template: { name: "Magnolia", slug: "magnolia" },
    publication: "published",
    publishedVersion: 2,
    plan: "PREMIUM",
    paidAccessEndsAt: new Date("2027-06-16T18:00:00Z"),
    accessState: "active",
    accessActive: true,
    guestCount: 40,
    rsvp: { received: 22, confirmed: 15, declined: 4, pending: 21 },
    galleryCount: 6,
    mediaCount: 8,
    mediaBytes: 2048,
    createdAt: NOW,
    updatedAt: NOW,
    purchases: [line({ id: "pur_1", createdAt: new Date("2026-09-12T10:00:00Z"), paidAt: new Date("2026-09-12T10:01:00Z") }), line({ id: "pur_2", kind: "UPGRADE", plan: "PREMIUM", amountMinor: 30000, createdAt: new Date("2026-09-20T10:00:00Z"), paidAt: new Date("2026-09-20T10:01:00Z") })],
  };

  it("muestra propietario, plan efectivo, acceso, versión, conteos de RSVP y el historial (Inicial Esencial $499 → Mejora Premium $300), solo conteos de invitados", async () => {
    services.getAdminEvent.mockResolvedValue(detail);
    const html = await render(AdminEventPage({ params: Promise.resolve({ id: "evt_1" }) } as never));
    const text = visibleText(html);
    for (const expected of ["Andrea & Fernando", "Ana Pérez", "Boda", "/i/andrea-y-fernando", "Magnolia (magnolia)", "Publicado", "Premium", "Activo", "16 jun 2027", "Invitados", "Confirmados", "No asistirán", "Pendientes", "«Tal vez» cuenta como pendiente.", "Imágenes de galería", "Historial de compras"]) expect(text, expected).toContain(expected);
    const rows = [...html.matchAll(/<tr class="align-middle">([\s\S]*?)<\/tr>/g)].map((match) => visibleText(match[1] ?? ""));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(/12 sep 2026.*Inicial.*Esencial.*499.*MXN.*Pagada.*Stripe/);
    expect(rows[1]).toMatch(/20 sep 2026.*Mejora.*Premium.*300.*MXN.*Pagada.*Stripe/);
    expect(text).toContain("nunca nombres, correos, teléfonos, mensajes ni enlaces personalizados");
    expect(html).not.toMatch(/inviteToken|guest=|mailto:|tel:/);
  });

  it("un evento Gratis muestra «Sin compra» y explica que no tiene compras", async () => {
    services.getAdminEvent.mockResolvedValue({ ...detail, plan: "FREE", paidAccessEndsAt: null, accessState: "free", purchases: [] });
    const text = visibleText(await render(AdminEventPage({ params: Promise.resolve({ id: "evt_1" }) } as never)));
    expect(text).toContain("Sin compra");
    expect(text).toContain("Este evento no tiene compras: es Gratis.");
  });

  it("un evento inexistente responde 404", async () => {
    services.getAdminEvent.mockResolvedValue(null);
    await expect(AdminEventPage({ params: Promise.resolve({ id: "nada" }) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("la compra se muestra con ids enmascarados, cliente de Stripe presente y SIN ninguna acción (solo lectura)", async () => {
    services.getAdminPurchase.mockResolvedValue({
      ...line({ kind: "UPGRADE", plan: "PREMIUM", amountMinor: 30000 }),
      event: { id: "evt_1", title: "Boda" },
      user: person,
      updatedAt: NOW,
      accessStartsAt: NOW,
      accessEndsAt: NOW,
      maskedCheckoutSessionId: "cs_test_••••••wxyz",
      maskedPaymentIntentId: "pi_••••••1234",
      hasProviderCustomer: true,
      maskedProviderCustomerId: "cus_••••••1234",
      eventStartsAt: NOW,
    });
    const html = await render(AdminPurchasePage({ params: Promise.resolve({ id: "pur_1" }) } as never));
    const text = visibleText(html);
    for (const expected of ["cs_test_••••••wxyz", "pi_••••••1234", "cus_••••••1234", "Presente", "Mejora", "Premium", "300", "MXN", "Stripe"]) expect(text, expected).toContain(expected);
    expect(html).not.toMatch(/<form|<button/);
    expect(text).toContain("no marca pagos, no crea planes ni reembolsa");
  });

  it("(12) el detalle de usuario lista sus eventos con plan efectivo y compras; el rol es de solo lectura", async () => {
    services.getAdminUser.mockResolvedValue({ ...person, role: "USER", clerkLinked: true, hasBillingCustomer: false, createdAt: NOW, eventCount: 1, events: [{ id: "evt_1", title: "Boda", startsAt: NOW, plan: "ESSENTIAL", publication: "draft", purchases: [line()] }] });
    const html = await render(AdminUserPage({ params: Promise.resolve({ id: "usr_1" }) } as never));
    const text = visibleText(html);
    for (const expected of ["Ana Pérez", "ana@example.com", "Usuario", "Vinculada", "Cliente de Stripe", "Esencial", "Borrador", "El rol es de solo lectura"]) expect(text, expected).toContain(expected);
    expect(html).not.toMatch(/<form|<button|<select/);
  });
});

describe("(20/21/24) plantillas", () => {
  const template: AdminTemplateDto = { id: "tpl_1", slug: "magnolia", name: "Magnolia", eventType: "WEDDING", designStatus: "IMPLEMENTED", publicationStatus: "PUBLISHED", minimumPlan: "FREE", invitationCount: 3 };

  it("lista nombre, enlace, tipo, diseño, visibilidad, plan mínimo e invitaciones, con «Editar» accesible por plantilla", async () => {
    services.listAdminTemplates.mockResolvedValue([template, { ...template, id: "tpl_2", slug: "ivory", name: "Ivory", designStatus: "CONCEPT", publicationStatus: "DRAFT", minimumPlan: "PREMIUM", invitationCount: 0 }]);
    const html = await render(AdminTemplatesPage());
    expect([...html.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((match) => match[1])).toEqual(["Nombre", "Enlace", "Tipo de evento", "Diseño", "Visibilidad", "Plan mínimo del evento", "Invitaciones", "Acciones"]);
    const text = visibleText(html);
    for (const expected of ["Magnolia", "magnolia", "Diseño terminado", "Concepto", "Visible", "Oculta", "Gratis", "Premium"]) expect(text, expected).toContain(expected);
    expect(html).toContain('aria-label="Editar Magnolia"');
  });

  it("(21) el diálogo solo ofrece visibilidad y plan mínimo (ni nombre, ni slug, ni designStatus) con sus etiquetas", () => {
    const html = renderToStaticMarkup(<TemplateEditDialog template={template} />);
    expect(html).toContain('<label for="template-tpl_1-visibility"');
    expect(html).toContain('<label for="template-tpl_1-plan"');
    expect(html).toContain('name="templateId"');
    expect(html).toContain('name="publicationStatus"');
    expect(html).toContain('name="minimumPlan"');
    expect(html).not.toMatch(/name="(name|slug|designStatus|role)"/);
    expect(visibleText(html)).toContain("El nombre, el enlace y el estado del diseño no se pueden cambiar desde aquí.");
    expect(visibleText(html)).toContain("No modifica los eventos que ya existen.");
  });

  it("(24) ocultar exige confirmar («Las invitaciones ya existentes seguirán funcionando.») y cambiar el plan mínimo también; hacer visible no", () => {
    const base = { ...template };
    expect(requiredConfirmations(base, { publicationStatus: "DRAFT", minimumPlan: "FREE" })).toEqual(["Las invitaciones ya existentes seguirán funcionando."]);
    expect(requiredConfirmations(base, { publicationStatus: "ARCHIVED", minimumPlan: "FREE" })).toEqual(["Las invitaciones ya existentes seguirán funcionando."]);
    expect(requiredConfirmations(base, { publicationStatus: "PUBLISHED", minimumPlan: "PREMIUM" })).toEqual(["Este cambio solo afectará nuevas selecciones."]);
    expect(requiredConfirmations(base, { publicationStatus: "DRAFT", minimumPlan: "ESSENTIAL" })).toEqual(["Las invitaciones ya existentes seguirán funcionando.", "Este cambio solo afectará nuevas selecciones."]);
    expect(requiredConfirmations(base, { publicationStatus: "PUBLISHED", minimumPlan: "FREE" })).toEqual([]);
    const hidden = { ...template, publicationStatus: "DRAFT" as const };
    expect(requiredConfirmations(hidden, { publicationStatus: "PUBLISHED", minimumPlan: "FREE" })).toEqual([]);
    expect(adminCopy.templates.hideConfirm("Magnolia")).toBe("¿Ocultar Magnolia del catálogo?");
  });

  it("no usa window.confirm en ningún lugar de la consola", () => {
    for (const file of filesUnder(["components/admin", "app/(site)/admin"])) expect(code(file), file).not.toMatch(/window\.(confirm|alert)|\bconfirm\(/);
  });
});

describe("(50/56) accesibilidad y privacidad de la interfaz", () => {
  it("las etiquetas de estado llevan texto además de color", () => {
    const texts = [
      renderToStaticMarkup(<PlanBadge plan="ESSENTIAL" />),
      renderToStaticMarkup(<PublicationBadge state="changes" />),
      renderToStaticMarkup(<AccessBadge state="expired" />),
      renderToStaticMarkup(<RoleBadge role="ADMIN" />),
    ].map(visibleText);
    expect(texts).toEqual(["Esencial", "Cambios sin publicar", "Expirado", "Administrador"]);
  });

  it("ningún componente de la consola importa Prisma, repositorios ni variables de entorno", () => {
    for (const file of filesUnder(["components/admin"])) expect(code(file), file).not.toMatch(/@prisma\/client|@\/server\/(db|repositories)|process\.env/);
  });
});

/** Código sin líneas de comentario (los comentarios pueden nombrar lo que el código no debe usar). */
const code = (file: string) =>
  readFileSync(join(ROOT, file), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

/** Rutas relativas de los .ts/.tsx bajo las carpetas dadas. */
function filesUnder(paths: string[]): string[] {
  const found: string[] = [];
  const walk = (path: string) => {
    if (statSync(path).isDirectory()) for (const entry of readdirSync(path)) walk(join(path, entry));
    else if (/\.(ts|tsx)$/.test(path)) found.push(relative(ROOT, path).split(sep).join("/"));
  };
  for (const path of paths) walk(join(ROOT, path));
  return found;
}
