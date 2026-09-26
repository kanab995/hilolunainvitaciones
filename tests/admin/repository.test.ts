import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { matches, type Where } from "../helpers/admin-where";

/**
 * Repositorio de la consola con Prisma sustituido por un doble que captura cada consulta. Comprueba QUÉ se pide a la base de datos (filtros,
 * paginación, `select` mínimo) y, para los ingresos, simula `groupBy` sobre compras en memoria con el intérprete de `where`.
 */
type Purchase = { status: string; plan: string; kind: string; currency: string; amount: number; paidAt: Date | null };
const world = vi.hoisted(() => ({ purchases: [] as Purchase[], calls: [] as Array<{ op: string; args: Record<string, unknown> }>, results: {} as Record<string, unknown> }));

vi.mock("@/server/db/client", async () => {
  const { matches: match } = await import("../helpers/admin-where");
  const defaults: Record<string, unknown> = { count: 0, findMany: [], groupBy: [], findUnique: null, updateMany: { count: 0 }, aggregate: { _count: { _all: 0 }, _sum: { sizeBytes: null } } };
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => async (args: Record<string, unknown> = {}) => {
          const op = `${name}.${method}`;
          world.calls.push({ op, args });
          if (op in world.results) {
            const result = world.results[op];
            return typeof result === "function" ? (result as (a: unknown) => unknown)(args) : result;
          }
          if (op === "eventPurchase.groupBy" && (args.by as string[]).join() === "currency") {
            const rows = world.purchases.filter((purchase) => match((args.where ?? {}) as never, purchase as never));
            const byCurrency = new Map<string, { amount: number; count: number }>();
            for (const row of rows) byCurrency.set(row.currency, { amount: (byCurrency.get(row.currency)?.amount ?? 0) + row.amount, count: (byCurrency.get(row.currency)?.count ?? 0) + 1 });
            return [...byCurrency].map(([currency, sum]) => ({ currency, _sum: { amount: sum.amount }, _count: { _all: sum.count } }));
          }
          return defaults[method];
        },
      },
    );
  const prisma = new Proxy(
    { $queryRaw: async (..._args: unknown[]) => (world.results.$queryRaw instanceof Error ? Promise.reject(world.results.$queryRaw) : (world.results.$queryRaw ?? [{ count: 0 }])) },
    {
      get: (target, key: string) => {
        if (key in target) return (target as Record<string, unknown>)[key];
        if (key === "$transaction") return async (callback: (client: unknown) => unknown) => callback(prisma);
        const delegate = model(key);
        return key === "invitation" ? new Proxy(delegate, { get: (d, m: string) => (m === "fields" ? { publishedRevision: { __ref: "publishedRevision" } } : (d as Record<string, unknown>)[m]) }) : delegate;
      },
    },
  );
  return { prisma };
});

import * as repo from "@/server/repositories/admin";

const at = (iso: string) => new Date(iso);
const call = (op: string) => world.calls.filter((entry) => entry.op === op);
const where = (op: string) => call(op).at(-1)?.args.where as Where;

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  world.calls.length = 0;
  world.results = {};
  world.purchases = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("(52.2/52.3/52.4) ingresos: solo compras PAID, sin sumar monedas distintas", () => {
  const purchase = (status: string, amount: number, currency = "MXN", plan = "ESSENTIAL", kind = "INITIAL", paidAt: Date | null = at("2026-09-01T00:00:00Z")): Purchase => ({ status, amount, currency, plan, kind, paidAt });

  it("suma únicamente PAID: PENDING, FAILED, REFUNDED y CANCELED no cuentan como ingreso", async () => {
    world.purchases = [purchase("PAID", 49900), purchase("PAID", 30000, "MXN", "PREMIUM", "UPGRADE"), purchase("REFUNDED", 79900, "MXN", "PREMIUM"), purchase("FAILED", 49900), purchase("PENDING", 49900), purchase("CANCELED", 79900)];
    expect(await repo.sumPaidRevenue()).toEqual([{ currency: "MXN", amountMinor: 79900, count: 2 }]);
    expect(where("eventPurchase.groupBy")).toEqual({ status: "PAID" });
  });

  it("agrupa por moneda: lo que no es MXN sale aparte y nunca se mezcla con los pesos", async () => {
    world.purchases = [purchase("PAID", 49900), purchase("PAID", 1000, "USD"), purchase("PAID", 2000, "USD")];
    expect(await repo.sumPaidRevenue()).toEqual([
      { currency: "MXN", amountMinor: 49900, count: 1 },
      { currency: "USD", amountMinor: 3000, count: 2 },
    ]);
  });

  it("«últimos 30 días» filtra por paidAt y por PAID a la vez", async () => {
    world.purchases = [purchase("PAID", 49900, "MXN", "ESSENTIAL", "INITIAL", at("2026-09-20T00:00:00Z")), purchase("PAID", 79900, "MXN", "PREMIUM", "INITIAL", at("2026-07-01T00:00:00Z")), purchase("REFUNDED", 79900, "MXN", "PREMIUM", "INITIAL", at("2026-09-21T00:00:00Z"))];
    const since = at("2026-08-27T00:00:00Z");
    expect(await repo.sumPaidRevenue(since)).toEqual([{ currency: "MXN", amountMinor: 49900, count: 1 }]);
    expect(where("eventPurchase.groupBy")).toEqual({ status: "PAID", paidAt: { gte: since } });
  });

  it("las compras pagadas por plan y tipo también se piden solo con PAID; el total de compras pagadas cuenta PAID", async () => {
    await repo.countPaidPurchasesByPlanAndKind();
    expect(where("eventPurchase.groupBy")).toEqual({ status: "PAID" });
    await repo.countTotals();
    expect(where("eventPurchase.count")).toEqual({ status: "PAID" });
    expect(where("invitation.count")).toEqual({ status: "PUBLISHED" });
  });
});

describe("(8) métricas eficientes: count / aggregate / groupBy en la base de datos", () => {
  it("nunca lista tablas completas para contar: usa count, aggregate y groupBy", async () => {
    await repo.countTotals();
    await repo.getMediaTotals(at("2026-09-26T00:00:00Z"), 24);
    await repo.countEventsForPlan("PREMIUM");
    await repo.countPaidAccessWindows(at("2026-09-26T00:00:00Z"), 30);
    expect(world.calls.map((entry) => entry.op).filter((op) => op.endsWith(".findMany"))).toEqual([]);
    expect(call("user.count")).toHaveLength(1);
    expect(call("mediaAsset.aggregate")[0]?.args).toMatchObject({ _sum: { sizeBytes: true } });
  });

  it("(38/39) acceso próximo a vencer y vencido usan paidAccessEndsAt y solo eventos con compra pagada", async () => {
    const now = at("2026-09-26T00:00:00Z");
    await repo.countPaidAccessWindows(now, 30);
    const [soon, expired] = call("event.count").map((entry) => entry.args.where as Where);
    expect(soon).toEqual({ purchases: { some: { status: "PAID" } }, paidAccessEndsAt: { gte: now, lte: at("2026-10-26T00:00:00Z") } });
    expect(expired).toEqual({ purchases: { some: { status: "PAID" } }, paidAccessEndsAt: { lt: now } });
  });

  it("(37) huérfanos: PENDING antiguo y READY sin referencia; si la consulta cruda falla, el resumen sigue (null)", async () => {
    const now = at("2026-09-26T12:00:00Z");
    world.results["mediaAsset.count"] = 3;
    world.results.$queryRaw = [{ reason: "unreferenced_ready", count: 2, bytes: 100 }];
    expect(await repo.getMediaTotals(now, 24)).toMatchObject({ stalePending: 3, unreferencedReady: 2 });
    expect(where("mediaAsset.count")).toEqual({ status: "PENDING", createdAt: { lt: at("2026-09-25T12:00:00Z") } });
    world.results.$queryRaw = new Error("columna inexistente");
    expect((await repo.getMediaTotals(now, 24)).unreferencedReady).toBeNull();
  });
});

describe("(11/40/41/42) listas: búsqueda por filtros de Prisma, paginación de servidor y orden", () => {
  it("usuarios: busca en nombre y correo (insensible a mayúsculas), pagina con skip/take y ordena por creación", async () => {
    await repo.listUsers({ q: "ana", sort: "newest", skip: 25, take: 25 });
    const args = call("user.findMany")[0]?.args as Record<string, unknown>;
    expect(args.where).toEqual({ OR: [{ name: { contains: "ana", mode: "insensitive" } }, { email: { contains: "ana", mode: "insensitive" } }] });
    expect(args).toMatchObject({ skip: 25, take: 25, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    await repo.listUsers({ sort: "oldest", skip: 0, take: 25 });
    expect((call("user.findMany")[1]?.args as Record<string, unknown>).orderBy).toEqual([{ createdAt: "asc" }, { id: "desc" }]);
    expect((call("user.findMany")[1]?.args as Record<string, unknown>).where).toEqual({});
  });

  it("(14) eventos: combina publicación, tipo y plan con AND; la búsqueda mira título, enlace y propietario", async () => {
    await repo.listEvents({ q: "boda", publication: "changes", type: "WEDDING", plan: "PREMIUM", sort: "event_date", skip: 0, take: 25 });
    const args = call("event.findMany")[0]?.args as Record<string, unknown>;
    const { AND } = args.where as { AND: Where[] };
    expect(AND).toHaveLength(4);
    expect(AND[0]).toHaveProperty("OR");
    expect(AND[2]).toEqual({ type: "WEDDING" });
    expect(args.orderBy).toEqual([{ startsAt: "desc" }, { id: "desc" }]);
  });

  it("(26) compras: filtra por estado, tipo y plan de la compra", async () => {
    await repo.listPurchases({ status: "PAID", kind: "UPGRADE", plan: "PREMIUM", sort: "newest", skip: 0, take: 25 });
    expect(where("eventPurchase.findMany")).toEqual({ AND: [{ status: "PAID" }, { kind: "UPGRADE" }, { plan: "PREMIUM" }] });
    await repo.listPurchases({ sort: "newest", skip: 0, take: 25 });
    expect(where("eventPurchase.findMany")).toEqual({});
  });

  it("(32) webhooks: solo id, tipo y fecha; los más recientes primero", async () => {
    await repo.listWebhookEvents({ skip: 0, take: 25 });
    const args = call("webhookEvent.findMany")[0]?.args as Record<string, unknown>;
    expect(Object.keys(args.select as object).sort()).toEqual(["externalEventId", "id", "processedAt", "provider", "type"]);
    expect(args.orderBy).toEqual([{ processedAt: "desc" }, { id: "desc" }]);
  });

  it("los eventos de un usuario se piden con sus compras ordenadas de la más antigua a la más reciente (historial)", async () => {
    world.results["user.findUnique"] = null;
    await repo.findUser("usr_1");
    const select = (call("user.findUnique")[0]?.args.select as { events: { select: { purchases: { orderBy: unknown } } } }).events.select.purchases;
    expect(select.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });
});

describe("(21/22/23) plantillas: solo se puede cambiar la visibilidad y el plan mínimo", () => {
  const existingTemplate = () => {
    world.results["template.findUnique"] = { id: "tpl_1", slug: "magnolia", name: "Magnolia", eventType: "WEDDING", designStatus: "IMPLEMENTED", publicationStatus: "PUBLISHED", minimumPlan: "FREE", _count: { invitations: 1 } };
    world.results["template.updateMany"] = { count: 1 };
  };

  it("updateTemplateSettings escribe únicamente publicationStatus y/o minimumPlan", async () => {
    existingTemplate();
    await repo.updateTemplateSettings("tpl_1", { publicationStatus: "DRAFT", minimumPlan: "PREMIUM" }, "usr_admin");
    expect(call("template.updateMany")[0]?.args).toEqual({ where: { id: "tpl_1" }, data: { publicationStatus: "DRAFT", minimumPlan: "PREMIUM" } });
    await repo.updateTemplateSettings("tpl_1", { minimumPlan: "ESSENTIAL" }, "usr_admin");
    expect(call("template.updateMany")[1]?.args.data).toEqual({ minimumPlan: "ESSENTIAL" });
  });

  it("aunque le lleguen claves de más (designStatus, slug, name), no salen hacia la base de datos", async () => {
    existingTemplate();
    await repo.updateTemplateSettings("tpl_1", { publicationStatus: "PUBLISHED", designStatus: "CONCEPT", slug: "x", name: "Otro" } as never, "usr_admin");
    const data = call("template.updateMany")[0]?.args.data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(["publicationStatus"]);
  });

  it("una plantilla inexistente devuelve null sin más escrituras ni auditoría", async () => {
    expect(await repo.updateTemplateSettings("no-existe", { minimumPlan: "FREE" }, "usr_admin")).toBeNull();
    expect(call("template.updateMany")).toHaveLength(0);
    expect(call("adminAuditLog.create")).toHaveLength(0);
  });

  it("(27) cada cambio real deja UNA entrada de auditoría con quién, qué y solo los campos cambiados (antes/después), en la misma transacción", async () => {
    existingTemplate();
    await repo.updateTemplateSettings("tpl_1", { publicationStatus: "DRAFT", minimumPlan: "PREMIUM" }, "usr_admin");
    const [entry] = call("adminAuditLog.create");
    expect(entry?.args).toEqual({ data: { adminUserId: "usr_admin", action: "template.update", entityType: "Template", entityId: "tpl_1", before: { publicationStatus: "PUBLISHED", minimumPlan: "FREE" }, after: { publicationStatus: "DRAFT", minimumPlan: "PREMIUM" } } });
    // Auditoría y cambio se ejecutan dentro de la misma transacción del cliente: el doble solo la sirve a través de `$transaction`.
    expect(call("template.findUnique").length).toBeGreaterThan(0);
  });

  it("un cambio que no modifica nada NO deja entrada; uno parcial solo registra el campo cambiado", async () => {
    existingTemplate();
    await repo.updateTemplateSettings("tpl_1", { publicationStatus: "PUBLISHED", minimumPlan: "FREE" }, "usr_admin");
    expect(call("adminAuditLog.create")).toHaveLength(0);
    await repo.updateTemplateSettings("tpl_1", { publicationStatus: "PUBLISHED", minimumPlan: "ESSENTIAL" }, "usr_admin");
    expect(call("adminAuditLog.create")[0]?.args).toMatchObject({ data: { before: { minimumPlan: "FREE" }, after: { minimumPlan: "ESSENTIAL" } } });
  });

  it("(28) la lectura de auditoría es de solo lectura, ordenada por fecha y sin datos sensibles", async () => {
    world.results["adminAuditLog.findMany"] = [{ id: "aud_1", action: "template.update", entityType: "Template", entityId: "tpl_1", before: {}, after: {}, createdAt: at("2026-09-26T00:00:00Z"), admin: { id: "usr_admin", name: "Admin", email: "admin@example.com" } }];
    world.results["template.findMany"] = [{ id: "tpl_1", name: "Magnolia" }];
    const rows = await repo.listAuditLog(50);
    expect(rows[0]).toMatchObject({ entityName: "Magnolia" });
    expect(call("adminAuditLog.findMany")[0]?.args).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
    expect(JSON.stringify(call("adminAuditLog.findMany")[0]?.args.select)).not.toMatch(/password|token|secret/i);
  });

  it("la lista de plantillas no trae los JSON de vista previa", async () => {
    await repo.listTemplates();
    const select = call("template.findMany")[0]?.args.select as Record<string, unknown>;
    expect(select).not.toHaveProperty("previewSample");
    expect(select).not.toHaveProperty("previewScreens");
  });
});

describe("(19/56) privacidad: el repositorio nunca pide datos personales de invitados, tokens ni secretos", () => {
  const source = readFileSync(join(process.cwd(), "server/repositories/admin.ts"), "utf8");
  const code = source.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");

  it("no selecciona inviteToken, teléfono, correo/nombre de invitado, mensajes ni respuestas RSVP", () => {
    expect(code).not.toMatch(/inviteToken|phone|dietaryNotes|message\s*:|answers|rsvpAnswer|rsvpQuestion/);
    expect(code).not.toMatch(/prisma\.guest\.(findMany|findFirst|findUnique)/);
    expect(code).not.toMatch(/prisma\.rsvp\.(findMany|findFirst|findUnique)/);
    // De los invitados solo hay conteos.
    expect(code).toMatch(/prisma\.guest\.(count|groupBy)/);
  });

  it("no lee la tabla legacy Subscription ni el snapshot de las publicaciones ni claves del proveedor de pagos", () => {
    expect(code).not.toMatch(/prisma\.subscription|snapshot\s*:\s*true/);
    expect(code).not.toMatch(/process\.env|secret|apiKey|signature/i);
  });

  it("de Clerk solo consulta si hay identidad vinculada: el id no sale del repositorio", async () => {
    world.results["user.findUnique"] = { id: "usr_1", name: "A", email: "a@example.com", role: "USER", clerkUserId: "user_2abcSECRET", createdAt: at("2026-09-01T00:00:00Z"), _count: { events: 0, billingCustomers: 1 }, events: [] };
    const found = await repo.findUser("usr_1");
    expect(found).toMatchObject({ clerkLinked: true, hasBillingCustomer: true });
    expect(JSON.stringify(found)).not.toContain("user_2abcSECRET");
  });
});

describe("sin base de datos las lecturas fallan de forma explícita (la consola nunca inventa datos)", () => {
  it("lanza StoreUnavailableError en el origen de demostración", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(repo.countTotals()).rejects.toThrow(/DATABASE_URL/);
    await expect(repo.listUsers({ sort: "newest", skip: 0, take: 25 })).rejects.toThrow(/DATABASE_URL/);
  });
});

describe("intérprete de where (herramienta de las pruebas)", () => {
  it("evalúa igualdad, in, not y relaciones", () => {
    expect(matches({ status: "PAID", plan: { in: ["A", "B"] } }, { status: "PAID", plan: "B" })).toBe(true);
    expect(matches({ status: { not: "PAID" } }, { status: "PAID" })).toBe(false);
    expect(matches({ purchases: { none: { status: "PAID" } } }, { purchases: [{ status: "FAILED" }] })).toBe(true);
  });
});
