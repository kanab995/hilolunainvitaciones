import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GuestList } from "@/components/guests/guest-list";
import { GuestSummary } from "@/components/guests/guest-summary";
import { GuestManager } from "@/components/guests/guest-manager";
import { getGuestInvitationUrl, getPublicInvitationUrl } from "@/lib/site-url";
import { guestRecordToRow } from "@/server/mappers/guest";
import { getDemoRows } from "@/server/repositories/demo-store";
import { deriveDemoInviteToken, generateInviteToken, INVITE_TOKEN_PATTERN } from "@/server/services/invite-token";
import { summarizeGuests } from "@/lib/guests/filter";
import { visibleText } from "../invitation/helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/dashboard/events/x/guests", redirect: vi.fn(), notFound: vi.fn() }));

const ROOT = process.cwd();
const rows = () => getDemoRows(new Date("2026-09-25T12:00:00Z")).guestRecords.map((record) => guestRecordToRow(record, "andrea-y-fernando"));
const noop = () => undefined;

describe("6–8. inviteToken: opaco, único y solo en las URLs públicas", () => {
  it("6. es único (miles de tokens sin colisión) y tiene el formato esperado", () => {
    const tokens = Array.from({ length: 5000 }, () => generateInviteToken());
    expect(new Set(tokens).size).toBe(5000);
    for (const token of tokens.slice(0, 50)) expect(token).toMatch(INVITE_TOKEN_PATTERN);
    expect(tokens[0]).toHaveLength(32);
  });

  it("6b. el esquema y la migración lo declaran único y no nulo, con relleno seguro de las filas existentes", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    expect(/model Guest \{([\s\S]*?)\n\}/.exec(schema)?.[1]).toMatch(/inviteToken\s+String\s+@unique/);
    const dir = readdirSync(join(ROOT, "prisma/migrations")).find((name) => name.endsWith("_add_guest_invite_token"));
    expect(dir).toBeDefined();
    const sql = readFileSync(join(ROOT, "prisma/migrations", dir!, "migration.sql"), "utf8");
    expect(sql).toMatch(/ADD COLUMN "inviteToken" TEXT;/);
    expect(sql).toMatch(/UPDATE "Guest"[\s\S]*gen_random_uuid\(\)/);
    expect(sql).toMatch(/SET NOT NULL/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "Guest_inviteToken_key"/);
    expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE/i);
  });

  it("7. el token no contiene el id del invitado ni deriva de él en claro (ni el de demostración)", () => {
    for (const id of ["gst_demo_1", "gst_demo_2", "cmabc123def456ghi789", "42"]) {
      expect(generateInviteToken()).not.toContain(id);
      expect(deriveDemoInviteToken(id)).not.toContain(id);
    }
    const demo = getDemoRows(new Date()).guestRecords;
    expect(new Set(demo.map((guest) => guest.inviteToken)).size).toBe(demo.length);
    for (const guest of demo) {
      expect(guest.inviteToken).toMatch(INVITE_TOKEN_PATTERN);
      expect(guest.inviteToken).not.toContain(guest.id);
    }
  });

  it("8. la URL personalizada usa el token, no el id", () => {
    const [mariana] = rows();
    const record = getDemoRows(new Date()).guestRecords[0]!;
    expect(mariana!.inviteUrl).toBe(getGuestInvitationUrl("andrea-y-fernando", record.inviteToken));
    expect(mariana!.inviteUrl.startsWith(`${getPublicInvitationUrl("andrea-y-fernando")}?guest=`)).toBe(true);
    expect(mariana!.inviteUrl).not.toContain(record.id);
    expect(getGuestInvitationUrl("andrea-y-fernando", "abc123", { NODE_ENV: "production" })).toBe("https://hiloluna.com/i/andrea-y-fernando?guest=abc123");
    expect(getGuestInvitationUrl("s", "a b&c", { NODE_ENV: "development" })).toBe("http://localhost:3000/i/s?guest=a%20b%26c");
  });

  it("el token nunca aparece como texto visible en la interfaz (solo dentro del enlace que se copia)", () => {
    const html = renderToStaticMarkup(<GuestList guests={rows()} onEdit={noop} onDelete={noop} onCopy={noop} onQr={noop} />);
    for (const record of getDemoRows(new Date()).guestRecords) expect(html).not.toContain(record.inviteToken);
  });
});

describe("Lista de invitados (marcado accesible y responsive)", () => {
  const html = renderToStaticMarkup(<GuestList guests={rows()} onEdit={noop} onDelete={noop} onCopy={noop} onQr={noop} />);

  it("la tabla de escritorio tiene encabezados reales y una fila por invitado", () => {
    for (const heading of ["Invitado", "Grupo", "Contacto", "Acompañantes", "Estado", "Acciones"]) expect(html).toMatch(new RegExp(`<th scope="col"[^>]*>(?:<span[^>]*>)?${heading}`));
    expect(html).toContain("<caption");
    expect(html).toContain('scope="row"');
    expect((html.match(/<tr /g) ?? []).length).toBe(1 + 4);
  });

  it("los botones nombran a la persona (lectores de pantalla)", () => {
    for (const name of ["Mariana López", "Luis Hernández"]) {
      expect(html).toContain(`aria-label="Editar ${name}"`);
      expect(html).toContain(`aria-label="Eliminar ${name}"`);
      expect(html).toContain(`aria-label="Copiar invitación de ${name}"`);
      expect(html).toContain(`aria-label="Acciones de ${name}"`);
    }
  });

  it("muestra grupo, estado con texto y acompañantes (+N)", () => {
    const text = visibleText(html);
    expect(text).toContain("Mariana López");
    expect(text).toContain("Amigos");
    expect(text).toContain("+1 acompañante");
    expect(text).toContain("+3 acompañantes");
    expect(text).toContain("Sin acompañantes");
    for (const label of ["Confirmado", "Pendiente", "No asistirá"]) expect(text).toContain(label);
  });

  it("existen las dos disposiciones: tabla (md+) y tarjetas (móvil), sin tabla horizontal comprimida", () => {
    expect(html).toMatch(/<div class="[^"]*hidden[^"]*@\[60rem\]:block/);
    expect(html).toMatch(/<ul class="[^"]*@\[60rem\]:hidden/);
  });
});

describe("Resumen y estado vacío", () => {
  it("las métricas salen de los invitados reales (2 · 1 · 1 y 4 en total con el seed)", () => {
    const summary = summarizeGuests(rows());
    expect(summary).toEqual({ total: 4, confirmed: 2, pending: 1, declined: 1, potentialCompanions: 4 });
    const text = visibleText(renderToStaticMarkup(<GuestSummary summary={summary} />));
    expect(text).toContain("4 Total de invitados");
    expect(text).toContain("2 Confirmados");
    expect(text).toContain("1 Pendientes");
    expect(text).toContain("1 No asistirán");
    expect(text).toContain("4 Acompañantes potenciales");
  });

  it("sin invitados: «Aún no has agregado invitados.» y el CTA para agregar el primero", () => {
    const html = renderToStaticMarkup(<GuestManager eventId="evt_x" guests={[]} totalCount={0} groups={[]} filters={{ q: "", status: "all", group: "" }} publication={{ slug: "andrea-y-fernando", state: "published" }} />);
    const text = visibleText(html);
    expect(text).toContain("Aún no has agregado invitados.");
    expect(text).toContain("Empieza creando tu lista para después enviar invitaciones personalizadas.");
    expect(text).toContain("Agregar primer invitado");
  });

  it("con invitados: búsqueda, filtros de estado, grupo, «Importar» deshabilitado y contador", () => {
    const html = renderToStaticMarkup(<GuestManager eventId="evt_x" guests={rows().slice(0, 2)} totalCount={4} groups={[{ id: "g", name: "Amigos" }]} filters={{ q: "", status: "all", group: "" }} publication={{ slug: "andrea-y-fernando", state: "published" }} />);
    const text = visibleText(html);
    for (const label of ["Todos", "Confirmados", "Pendientes", "No asistirán", "Agregar invitado", "Mostrando 2 de 4"]) expect(text).toContain(label);
    expect(html).toContain('aria-label="Buscar invitados"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Importar/);
    expect(html).toContain("Todos los grupos");
  });
});

describe("Acciones del servidor: nunca aceptan un propietario del cliente", () => {
  const actions = readFileSync(join(ROOT, "app/(site)/dashboard/(workspace)/events/[id]/guests/actions.ts"), "utf8");
  it('es un módulo "use server" que exporta createGuest, updateGuest y deleteGuest', () => {
    expect(actions.startsWith('"use server"')).toBe(true);
    for (const name of ["createGuest", "updateGuest", "deleteGuest"]) expect(actions).toMatch(new RegExp(`export async function ${name}\\(`));
  });
  it("no lee ownerId/userId del formulario y revalida el panel y la lista", () => {
    expect(actions).not.toMatch(/ownerId|userId/);
    expect(actions).toMatch(/revalidatePath\(routes\.eventGuests/);
    expect(actions).toMatch(/revalidatePath\(routes\.event\(/);
  });
});
