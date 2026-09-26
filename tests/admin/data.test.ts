import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/server/db/client", () => ({ prisma: { template: { upsert } } }));

import { upsertTemplates } from "@/server/repositories/templates";
import { buildTemplateRows } from "@/server/seed/demo-data";

const ROOT = process.cwd();
const migrations = join(ROOT, "prisma/migrations");
const migration = readdirSync(migrations).find((name) => name.endsWith("_user_role"));
const sql = migration ? readFileSync(join(migrations, migration, "migration.sql"), "utf8") : "";
const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");

describe("(58) migración aditiva del rol de usuario", () => {
  it("existe, se aplica después de las compras por evento y solo crea el enum y añade la columna con USER por defecto", () => {
    expect(migration).toBeDefined();
    const names = readdirSync(migrations).filter((name) => /^\d/.test(name)).sort();
    expect(names.indexOf(migration as string)).toBeGreaterThan(names.findIndex((name) => name.endsWith("_event_purchases")));
    expect(sql).toMatch(/CREATE TYPE "UserRole" AS ENUM \('USER', 'ADMIN'\)/);
    expect(sql).toMatch(/ALTER TABLE "User" ADD COLUMN\s+"role" "UserRole" NOT NULL DEFAULT 'USER'/);
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bRENAME\b|ALTER COLUMN|UPDATE\s/i);
    // Todos los usuarios existentes quedan como USER: nadie se asciende automáticamente (2).
    expect(sql).not.toMatch(/ADMIN'\s*(WHERE|FROM)|INSERT/i);
  });

  it("el esquema declara UserRole { USER ADMIN } y User.role con valor por defecto USER; EventPurchase no cambia", () => {
    const block = schema.match(/enum UserRole \{([^}]*)\}/)?.[1] ?? "";
    expect(block.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("//"))).toEqual(["USER", "ADMIN"]);
    expect(schema.match(/model User \{([\s\S]*?)\n\}/)?.[1]).toMatch(/role\s+UserRole\s+@default\(USER\)/);
    expect(schema.match(/model EventPurchase \{([\s\S]*?)\n\}/)?.[1]).not.toMatch(/role|admin/i);
  });

  it("(59) la tabla Subscription legacy sigue en el esquema (no se elimina) y la consola no la usa", () => {
    expect(schema).toMatch(/model Subscription \{/);
    for (const dir of ["app/(site)/admin", "server/admin", "components/admin", "lib/admin"]) {
      const walk = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]));
      for (const file of walk(join(ROOT, dir))) expect(readFileSync(file, "utf8"), file).not.toMatch(/prisma\.subscription|Subscription\b(?!\s*legacy)/);
    }
    expect(readFileSync(join(ROOT, "server/repositories/admin.ts"), "utf8")).not.toMatch(/prisma\.subscription/);
  });
});

describe("(21/22) el seed no pisa lo que decidió el administrador", () => {
  beforeEach(() => upsert.mockClear());

  it("upsertTemplates fija publicationStatus y minimumPlan solo al CREAR; al repetir el seed NO los sobrescribe", async () => {
    const [row] = buildTemplateRows();
    expect(row).toBeDefined();
    await upsertTemplates([row!]);
    const [args] = upsert.mock.calls[0] as unknown as [{ create: Record<string, unknown>; update: Record<string, unknown>; where: { slug: string } }];
    expect(args.where).toEqual({ slug: row!.slug });
    expect(args.create).toMatchObject({ publicationStatus: row!.publicationStatus, minimumPlan: row!.minimumPlan });
    expect(args.update).not.toHaveProperty("publicationStatus");
    expect(args.update).not.toHaveProperty("minimumPlan");
    // El resto de metadatos sí se mantiene actualizado.
    expect(args.update).toMatchObject({ name: row!.name, designStatus: row!.designStatus });
  });
});

describe("(44/56) los DTO de la consola no tienen campos de datos personales de invitados ni secretos", () => {
  const dto = readFileSync(join(ROOT, "server/admin/dto.ts"), "utf8");
  const code = dto.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");

  it("ningún DTO declara inviteToken, teléfono, mensajes, respuestas, ids de Clerk, contraseñas ni secretos", () => {
    expect(code).not.toMatch(/inviteToken|phone|telefono|message|answers|dietary|clerkUserId|password|secret|apiKey|signature|payload|snapshot|\b(providerCheckoutSessionId|providerPaymentIntentId|providerCustomerId)\b/i);
  });

  it("los ids del proveedor solo existen enmascarados y como booleanos", () => {
    for (const field of ["maskedCheckoutSessionId", "maskedPaymentIntentId", "maskedProviderCustomerId", "maskedExternalEventId", "hasProviderCustomer", "clerkLinked", "hasBillingCustomer"]) expect(code, field).toContain(field);
  });

  it("de los invitados el DTO de evento solo tiene conteos", () => {
    expect(code).toMatch(/guestCount: number/);
    expect(code).toMatch(/rsvp: \{ received: number; confirmed: number; declined: number; pending: number \}/);
    expect(code).not.toMatch(/guests\s*:\s*(Array|\w+\[\])/);
  });
});

describe("(60/61) documentación de la consola", () => {
  const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

  it("docs/ADMIN.md explica cómo convertir un usuario en ADMIN con Prisma Studio o SQL y que no hay ascenso desde la aplicación", () => {
    const admin = read("docs/ADMIN.md");
    expect(admin).toMatch(/npm run db:studio/);
    expect(admin).toMatch(/UPDATE "User" SET "role" = 'ADMIN' WHERE "email"/);
    expect(admin).toMatch(/No hay ninguna pantalla, acción ni endpoint para ascender/);
    expect(admin).toMatch(/no se deduce/i);
  });

  it("ARCHITECTURE registra D-33, ROUTES lista las rutas de /admin, DATABASE_SCHEMA documenta User.role y CLAUDE.md fija la regla de requireAdmin", () => {
    expect(read("docs/ARCHITECTURE.md")).toMatch(/### D-33 · \*\*Aprobada/);
    const routes = read("docs/ROUTES.md");
    for (const route of ["/admin", "/admin/users", "/admin/events", "/admin/templates", "/admin/purchases", "/admin/webhooks"]) expect(routes, route).toContain(`\`${route}`);
    expect(read("docs/DATABASE_SCHEMA.md")).toMatch(/## 18\. Consola de administración: `User\.role`/);
    expect(read("CLAUDE.md")).toMatch(/requireAdmin\(\)/);
  });
});
