import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getImplicitTags } from "next/dist/server/lib/implicit-tags";
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.hoisted(() => vi.fn());
const requireAdmin = vi.hoisted(() => vi.fn());
const updateAdminTemplate = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));
vi.mock("@/server/admin/templates", () => ({ updateAdminTemplate }));

import { updateTemplateAction } from "@/app/(site)/admin/templates/actions";

const ROOT = process.cwd();

/**
 * Las rutas con caché que muestran el catálogo: su `page` es la ruta del ARCHIVO (con grupos), de la que Next deriva las etiquetas. Se comprueba
 * con `getImplicitTags` de Next, no con una copia de su lógica: mover la ruta a otro grupo, o un cambio de Next en cómo etiqueta, hace fallar esta prueba.
 */
const CACHED_CATALOG_ROUTES = [
  { file: "app/(site)/(marketing)/templates/page.tsx", page: "/(site)/(marketing)/templates/page", pathname: "/templates" },
  { file: "app/(site)/(marketing)/templates/[slug]/page.tsx", page: "/(site)/(marketing)/templates/[slug]/page", pathname: "/templates/magnolia" },
  { file: "app/(site)/(marketing)/templates/[slug]/page.tsx", page: "/(site)/(marketing)/templates/[slug]/page", pathname: "/templates/una-plantilla-generada-bajo-demanda" },
  { file: "app/sitemap.ts", page: "/sitemap.xml/route", pathname: "/sitemap.xml" },
];

/** La etiqueta que invalida `revalidatePath` (mismo formato que `next/dist/server/web/spec-extension/revalidate.js`). */
const tagFor = ([path, type]: [string, string?]) => `_N_T_${path}${type ? `/${type}` : ""}`;

async function callsAfterSaving() {
  requireAdmin.mockResolvedValue({ id: "usr_1", email: "admin@example.com", name: "Admin", role: "ADMIN" });
  updateAdminTemplate.mockResolvedValue({ ok: true, template: { name: "Magnolia" } });
  const data = new FormData();
  data.set("templateId", "tpl_1");
  data.set("publicationStatus", "DRAFT");
  expect((await updateTemplateAction({ status: "idle" }, data)).status).toBe("saved");
  return revalidatePath.mock.calls as [string, string?][];
}

beforeEach(() => vi.clearAllMocks());

describe("publicar u ocultar una plantilla invalida de verdad las páginas en caché", () => {
  it.each(CACHED_CATALOG_ROUTES)("$pathname ($page): una llamada coincide con sus etiquetas", async ({ file, page, pathname }) => {
    expect(existsSync(join(ROOT, file)), `${file} ya no existe: actualiza la ruta del catálogo`).toBe(true);
    const { tags } = await getImplicitTags(page, pathname, null);
    const invalidated = (await callsAfterSaving()).map(tagFor);
    expect(invalidated.filter((tag) => tags.includes(tag))).not.toEqual([]);
  });

  it("revalidar la URL con el tipo layout no coincide con ninguna etiqueta (el error que dejó /templates sin actualizar)", async () => {
    for (const { page, pathname } of CACHED_CATALOG_ROUTES) {
      const { tags } = await getImplicitTags(page, pathname, null);
      expect(tags).not.toContain(tagFor(["/templates", "layout"]));
    }
  });

  it("/pricing no tiene nada que invalidar en caché: se renderiza en cada petición", () => {
    expect(readFileSync(join(ROOT, "app/(site)/(marketing)/pricing/page.tsx"), "utf8")).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("sin guardar (rol o entrada rechazados) no se invalida nada", async () => {
    requireAdmin.mockResolvedValue({ id: "usr_1", email: "admin@example.com", name: "Admin", role: "ADMIN" });
    updateAdminTemplate.mockResolvedValue({ ok: false, code: "invalid" });
    expect((await updateTemplateAction({ status: "idle" }, new FormData())).status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
