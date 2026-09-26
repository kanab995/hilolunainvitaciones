import { prisma } from "@/server/db/client";
import { getDataSource } from "@/server/data-source";
import { dbTemplateToDomain, type TemplateRowData } from "@/server/mappers/template";
import { getDemoTemplateRows } from "@/server/repositories/demo-store";
import type { Template } from "@/types/templates";

/**
 * Catálogo de plantillas. Devuelve solo las PUBLICADAS (`publicationStatus = PUBLISHED`), en su orden;
 * la madurez del diseño (`designStatus`) es otra cosa y viaja dentro de `Template.status`.
 */
export async function getTemplates(): Promise<Template[]> {
  if (getDataSource() === "demo") return getDemoTemplateRows().filter((row) => row.publicationStatus === "PUBLISHED").map(dbTemplateToDomain);
  const rows = await prisma.template.findMany({ where: { publicationStatus: "PUBLISHED" }, orderBy: { sortOrder: "asc" } });
  return rows.map(dbTemplateToDomain);
}

export async function getTemplateBySlug(slug: string): Promise<Template | undefined> {
  if (getDataSource() === "demo") {
    const row = getDemoTemplateRows().find((item) => item.slug === slug && item.publicationStatus === "PUBLISHED");
    return row ? dbTemplateToDomain(row) : undefined;
  }
  const row = await prisma.template.findFirst({ where: { slug, publicationStatus: "PUBLISHED" } });
  return row ? dbTemplateToDomain(row) : undefined;
}

/**
 * Inserta o actualiza plantillas por `slug` (seed). No borra ninguna. `publicationStatus` y `minimumPlan` son de la CONSOLA de administración
 * (D-33): el seed los fija solo al CREAR la plantilla y nunca los pisa al repetirse (si no, volver a sembrar deshacería lo que decidió el admin).
 */
export async function upsertTemplates(rows: readonly TemplateRowData[]): Promise<void> {
  for (const row of rows) {
    const { slug, publicationStatus: _publicationStatus, minimumPlan: _minimumPlan, ...updatable } = row;
    const json = { previewSample: row.previewSample as never, previewScreens: row.previewScreens as never };
    await prisma.template.upsert({ where: { slug }, create: { ...row, ...json }, update: { ...updatable, ...json } });
  }
}
