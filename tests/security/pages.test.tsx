import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_USER } from "@/server/seed/demo-data";
import { visibleText } from "../invitation/helpers";

const requireAuth = vi.hoisted(() => vi.fn());
const getClerkSession = vi.hoisted(() => vi.fn());
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

vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/server/auth/session", () => ({ getClerkSession }));
vi.mock("@/server/auth/current-user", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/auth/current-user")>()), requireAuth }));

import EventsPage from "@/app/(site)/dashboard/(workspace)/events/page";
import { loadDashboardPage } from "@/lib/dashboard/load-dashboard";
import { loadEditorPage } from "@/lib/editor/load-event";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("8. «Mis eventos»: estado vacío y propiedad", () => {
  it("un usuario sin eventos ve «Aún no tienes eventos» y un CTA a /templates", async () => {
    requireAuth.mockResolvedValue({ id: "usr_nuevo", email: "nuevo@example.com", name: null });
    const html = renderToStaticMarkup(await EventsPage());
    const text = visibleText(html);
    expect(text).toContain("Aún no tienes eventos");
    expect(text).toContain("Crear mi primera invitación");
    expect(html).toContain('href="/templates"');
    expect(text).not.toContain("Andrea & Fernando");
  });

  it("el propietario ve solo sus eventos, con nombre, fecha, plantilla, estado y acciones", async () => {
    requireAuth.mockResolvedValue({ id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name });
    const html = renderToStaticMarkup(await EventsPage());
    const text = visibleText(html);
    expect(text).toContain("Andrea & Fernando");
    expect(text).toContain("17 Mayo 2027");
    expect(text).toContain("Plantilla Magnolia");
    expect(text).toContain("Publicado");
    // CTA contextual (D-29): un evento PUBLICADO ofrece «Abrir invitación» (la URL pública) y «Ver evento».
    expect(text).toContain("Abrir invitación");
    expect(html).toContain('href="/i/andrea-y-fernando"');
    expect(html).toContain('href="/dashboard/events/evt_demo_andrea_fernando"');
  });
});

describe("Sesión y propiedad en los cargadores de páginas privadas", () => {
  it("sin sesión, requireAuth redirige a /sign-in (comportamiento real, sin mock)", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    getClerkSession.mockResolvedValue(null);
    const actual = await vi.importActual<typeof import("@/server/auth/current-user")>("@/server/auth/current-user");
    await expect(actual.requireAuth()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
    expect(await actual.getOrCreateCurrentUser()).toBeNull();
  });

  it("el dashboard de un evento ajeno responde igual que uno inexistente: notFound()", async () => {
    requireAuth.mockResolvedValue({ id: "usr_ajeno", email: "x@example.com", name: null });
    const routes = await import("@/lib/routes");
    await expect(loadDashboardPage("evt_demo_andrea_fernando", routes.routes.event)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(loadDashboardPage("no-existe", routes.routes.event)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(loadDashboardPage("demo", routes.routes.event)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("4. otra persona no puede abrir el editor de una invitación ajena", async () => {
    vi.doMock("@/server/auth/ownership", async () => {
      const { getOwnedEventByRef } = await import("@/server/repositories/events");
      return {
        requireOwnedEvent: async (ref: string) => {
          const event = await getOwnedEventByRef("usr_ajeno", ref);
          if (!event) notFound();
          return { user: { id: "usr_ajeno", email: "x@example.com", name: null }, event };
        },
      };
    });
    vi.resetModules();
    const { loadEditorPage: freshLoad } = await import("@/lib/editor/load-event");
    await expect(freshLoad("evt_demo_andrea_fernando", (id) => `/dashboard/events/${id}/edit`)).rejects.toThrow("NEXT_NOT_FOUND");
    vi.doUnmock("@/server/auth/ownership");
    expect(loadEditorPage).toBeTypeOf("function");
  });

  it("el propietario abre su dashboard y es redirigido a la URL canónica desde el alias", async () => {
    requireAuth.mockResolvedValue({ id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name });
    const routes = await import("@/lib/routes");
    const data = await loadDashboardPage("evt_demo_andrea_fernando", routes.routes.event);
    expect(data.event.title).toBe("Andrea & Fernando");
    await expect(loadDashboardPage("demo", routes.routes.event)).rejects.toThrow("NEXT_REDIRECT:/dashboard/events/evt_demo_andrea_fernando");
  });
});
