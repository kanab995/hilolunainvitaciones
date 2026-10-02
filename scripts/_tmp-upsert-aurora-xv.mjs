// One-off, production-safe upsert for EXACTLY the "aurora-xv" Template row.
// Does NOT touch any other template, event, invitation, guest, or purchase.
// Run from the project root against your REAL production DATABASE_URL:
//   node --import ./prisma/register-alias.mjs scripts/_tmp-upsert-aurora-xv.mjs
// Delete this file after running it once (temporary, not part of the permanent codebase).
import { buildTemplateRows } from "@/server/seed/demo-data";
import { upsertTemplates } from "@/server/repositories/templates";
import { prisma } from "@/server/db/client";

const row = buildTemplateRows().find((r) => r.slug === "aurora-xv");
if (!row) throw new Error("aurora-xv row not found in buildTemplateRows()");

const before = await prisma.template.findUnique({ where: { slug: "aurora-xv" } });
console.log("BEFORE:", before ? { slug: before.slug, publicationStatus: before.publicationStatus, designStatus: before.designStatus } : null);

await upsertTemplates([row]);

const after = await prisma.template.findUnique({ where: { slug: "aurora-xv" } });
console.log("AFTER:", { slug: after.slug, publicationStatus: after.publicationStatus, designStatus: after.designStatus, minimumPlan: after.minimumPlan, sortOrder: after.sortOrder });

const total = await prisma.template.count();
console.log("Total de plantillas en la tabla (debe ser 11):", total);

await prisma.$disconnect();
