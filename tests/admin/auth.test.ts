import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = process.cwd();

const currentUser = vi.hoisted(() => vi.fn());
const findUserRole = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const revalidatePath = vi.hoisted(() => vi.fn());
const updateTemplateSettings = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/auth/current-user", () => ({ getOrCreateCurrentUser: currentUser, requireAuth: vi.fn() }));
vi.mock("@/server/repositories/users", () => ({ findUserRole, getDemoUser: vi.fn(), prismaUserStore: {} }));
vi.mock("@/server/repositories/admin", () => ({ updateTemplateSettings }));

import { updateTemplateAction } from "@/app/(site)/admin/templates/actions";
import { isAdminRole } from "@/lib/admin/roles";
import { isCurrentUserAdmin, requireAdmin, resolveAdmin, resolveAdminWith } from "@/server/auth/admin";
import { DEMO_USER } from "@/server/seed/demo-data";

const person = { id: "usr_1", email: "persona@example.com", name: "Persona" };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(person);
  findUserRole.mockResolvedValue("USER");
});

describe("(51.1) un usuario normal NO abre /admin", () => {
  it("requireAdmin responde notFound() y no devuelve nada (igual que una ruta inexistente)", async () => {
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /sign-in (no se revela nada del panel)", async () => {
    currentUser.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(findUserRole).not.toHaveBeenCalled();
  });

  it("falla de forma segura: rol desconocido, ausente, en minúsculas o un error al leerlo NUNCA conceden acceso", async () => {
    for (const role of [null, undefined, "", "admin", "Admin", "SUPERADMIN", "ADMIN ", true, 1]) {
      findUserRole.mockResolvedValue(role);
      expect((await resolveAdminWith({ currentUser, findRole: findUserRole })).status, String(role)).toBe("forbidden");
    }
    findUserRole.mockRejectedValue(new Error("base de datos caída"));
    expect((await resolveAdminWith({ currentUser, findRole: findUserRole })).status).toBe("forbidden");
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("(51.2) un administrador SÍ entra", () => {
  it("con role === ADMIN en la base de datos, requireAdmin devuelve al administrador", async () => {
    findUserRole.mockResolvedValue("ADMIN");
    await expect(requireAdmin()).resolves.toEqual({ ...person, role: "ADMIN" });
    expect((await resolveAdmin()).status).toBe("ok");
    expect(await isCurrentUserAdmin()).toBe(true);
    expect(findUserRole).toHaveBeenCalledWith("usr_1");
  });

  it("isAdminRole es una comparación estricta", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    for (const value of ["USER", "admin", "", null, undefined, {}, ["ADMIN"]]) expect(isAdminRole(value)).toBe(false);
  });
});

describe("(51.3) un usuario normal NO ejecuta las acciones de administración", () => {
  const form = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  };

  it("updateTemplateAction con un USER lanza notFound() y no toca la base de datos ni revalida nada", async () => {
    await expect(updateTemplateAction({ status: "idle" }, form({ templateId: "tpl_1", publicationStatus: "DRAFT" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(updateTemplateSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin sesión la acción redirige a /sign-in y no ejecuta nada", async () => {
    currentUser.mockResolvedValue(null);
    await expect(updateTemplateAction({ status: "idle" }, form({ templateId: "tpl_1", minimumPlan: "PREMIUM" }))).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(updateTemplateSettings).not.toHaveBeenCalled();
  });

  it("con ADMIN la acción sí guarda y revalida el catálogo", async () => {
    findUserRole.mockResolvedValue("ADMIN");
    updateTemplateSettings.mockResolvedValue({ id: "tpl_1", name: "Magnolia", slug: "magnolia" });
    const state = await updateTemplateAction({ status: "idle" }, form({ templateId: "tpl_1", publicationStatus: "DRAFT" }));
    expect(state.status).toBe("saved");
    expect(updateTemplateSettings).toHaveBeenCalledWith("tpl_1", { publicationStatus: "DRAFT" }, "usr_1");
    expect(revalidatePath).toHaveBeenCalledWith("/templates", "layout");
  });
});

describe("(51.4) el payload no puede cambiar roles", () => {
  it("un campo `role` (o cualquier otro) enviado a la acción se ignora: solo se reenvían visibilidad y plan mínimo", async () => {
    findUserRole.mockResolvedValue("ADMIN");
    updateTemplateSettings.mockResolvedValue({ id: "tpl_1", name: "Magnolia", slug: "magnolia" });
    const data = new FormData();
    for (const [key, value] of Object.entries({ templateId: "tpl_1", publicationStatus: "PUBLISHED", role: "ADMIN", userId: "usr_2", designStatus: "CONCEPT", slug: "hack", name: "Otro" })) data.set(key, value);
    await updateTemplateAction({ status: "idle" }, data);
    expect(updateTemplateSettings).toHaveBeenCalledWith("tpl_1", { publicationStatus: "PUBLISHED" }, "usr_1");
  });

  it("la consola no contiene ninguna escritura sobre User ni una acción que cambie roles", () => {
    const sources = filesUnder(["app/(site)/admin", "server/admin", "components/admin", "server/repositories/admin.ts", "server/auth/admin.ts"]);
    for (const [file, text] of sources) {
      expect(text, file).not.toMatch(/prisma\.user\.(update|updateMany|create|createMany|upsert|delete|deleteMany)/);
      // (El tipo `AdminUser` de la puerta de acceso declara `role: "ADMIN"`; no es una escritura.)
      if (file !== "server/auth/admin.ts") expect(text, file).not.toMatch(/\brole:\s*["'`]ADMIN/);
    }
    // El único módulo que escribe en el servidor desde la consola es la acción de plantillas.
    const actions = [...sources.keys()].filter((file) => /actions?\.ts$/.test(file));
    expect(actions.sort()).toEqual(["app/(site)/admin/actions.ts", "app/(site)/admin/templates/actions.ts"]);
  });
});

describe("(51.5) el usuario demo sigue siendo USER", () => {
  it("el seed y los datos demo no asignan ningún rol; el valor por defecto de la columna es USER", () => {
    expect(DEMO_USER).not.toHaveProperty("role");
    expect(readFileSync(join(ROOT, "prisma/seed.ts"), "utf8")).not.toMatch(/ADMIN/);
    expect(readFileSync(join(ROOT, "server/seed/demo-data.ts"), "utf8")).not.toMatch(/ADMIN/);
    expect(readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")).toMatch(/role\s+UserRole\s+@default\(USER\)/);
  });

  it("sin base de datos (origen de demostración) no hay roles: findUserRole no existe como privilegio", async () => {
    const actual = await vi.importActual<typeof import("@/server/repositories/users")>("@/server/repositories/users");
    expect(await actual.findUserRole(DEMO_USER.id)).toBeNull();
  });
});

describe("la autorización solo sale del rol en PostgreSQL", () => {
  const gate = readFileSync(join(ROOT, "server/auth/admin.ts"), "utf8");

  it("requireAdmin no compara correos, dominios, parámetros ni metadatos de Clerk", () => {
    const code = gate.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
    expect(code).not.toMatch(/\.email\s*(===|==|\.endsWith|\.includes|\.match)|endsWith\(|searchParams|publicMetadata|privateMetadata|sessionClaims|process\.env/);
    expect(code).toMatch(/findUserRole/);
  });

  it("todas las páginas, el layout y las acciones de /admin llaman a requireAdmin()", () => {
    const files = [...filesUnder(["app/(site)/admin"]).entries()].filter(([file]) => /(page|layout|actions)\.tsx?$/.test(file));
    expect(files.length).toBe(13);
    for (const [file, text] of files) expect(text, file).toMatch(/requireAdmin\(\)/);
  });

  it("los servicios de la consola exigen un AdminUser (la prueba de que se llamó a requireAdmin)", () => {
    for (const [file, text] of filesUnder(["server/admin"])) {
      if (/dto|health/.test(file)) continue;
      for (const match of text.matchAll(/export async function (\w+)\(([^)]*)\)/g)) expect(match[2], `${file}: ${match[1]}`).toMatch(/_?admin: AdminUser/);
    }
  });
});

/** Lee todos los .ts/.tsx bajo las rutas dadas: `Map<ruta relativa, contenido>`. */
function filesUnder(paths: string[]): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (path: string) => {
    if (statSync(path).isDirectory()) {
      for (const entry of readdirSync(path)) walk(join(path, entry));
    } else if (/\.(ts|tsx)$/.test(path)) {
      found.set(relative(ROOT, path).split(sep).join("/"), readFileSync(path, "utf8"));
    }
  };
  for (const path of paths) walk(join(ROOT, path));
  return found;
}
