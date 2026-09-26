import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const migrations = join(ROOT, "prisma/migrations");
const migration = readdirSync(migrations).find((name) => name.endsWith("_event_purchases"));
const sql = migration ? readFileSync(join(migrations, migration, "migration.sql"), "utf8") : "";
const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");

describe("Migración a compras por evento (9, 64, 65, 79)", () => {
  it("existe, se aplica DESPUÉS de las migraciones de facturación anteriores y es puramente aditiva: sin DROP, DELETE, TRUNCATE ni RENAME", () => {
    expect(migration).toBeDefined();
    const names = readdirSync(migrations).filter((name) => /^\d/.test(name)).sort();
    expect(names.indexOf(migration as string)).toBeGreaterThan(names.findIndex((name) => name.endsWith("_add_billing")));
    expect(sql).toMatch(/CREATE TABLE "EventPurchase"/);
    expect(sql).toMatch(/ALTER TABLE "Event" ADD COLUMN\s+"paidAccessEndsAt"/);
    // `ON DELETE RESTRICT` de las claves foráneas es una regla, no un borrado de datos.
    expect(sql.replace(/ON DELETE \w+/g, "")).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bRENAME\b|ALTER COLUMN/i);
  });

  it("las tablas de contenido (eventos, invitaciones, publicaciones, invitados, RSVP, archivos) siguen en el esquema, sin cambios de forma", () => {
    for (const model of ["Event", "Invitation", "InvitationPublication", "Guest", "Rsvp", "MediaAsset", "GalleryImage"]) expect(schema, model).toMatch(new RegExp(`model ${model} \{`));
  });

  it("la tabla Subscription queda como LEGACY sin uso (sus filas de prueba no se convierten ni se borran) y el modelo nuevo es EventPurchase", () => {
    expect(schema).toMatch(/LEGACY — suscripción mensual del modelo anterior/);
    expect(schema).toMatch(/model Subscription \{/);
    expect(schema).toMatch(/model EventPurchase \{/);
    expect(schema).toMatch(/model BillingCustomer \{/);
    expect(schema).toMatch(/model WebhookEvent \{/);
  });

  it("los estados de compra son PENDING, PAID, FAILED, REFUNDED y CANCELED (sin TRIALING, PAST_DUE ni cancelAtPeriodEnd)", () => {
    const block = schema.match(/enum PurchaseStatus \{([^}]*)\}/)?.[1] ?? "";
    expect(block.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("//"))).toEqual(["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELED"]);
    const purchase = schema.match(/model EventPurchase \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(purchase).not.toMatch(/TRIALING|PAST_DUE|cancelAtPeriodEnd|currentPeriod/);
    expect(purchase).toMatch(/onDelete: Restrict/);
  });
});
