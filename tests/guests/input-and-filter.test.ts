import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filterGuests, guestFiltersToSearch, matchesSearch, parseGuestFilters, statusGroupOf, summarizeGuests } from "@/lib/guests/filter";
import { NEW_GROUP_VALUE, readGuestFormData, validateGuestInput } from "@/server/services/guest-input";
import type { GuestRow } from "@/types/guests";

const guest = (over: Partial<GuestRow> & Pick<GuestRow, "id" | "name">): GuestRow => ({
  email: null,
  phone: null,
  groupId: null,
  groupName: null,
  maxCompanions: 0,
  status: "PENDING",
  statusGroup: "pending",
  attendeeCount: null,
  inviteUrl: "http://localhost:3000/i/x?guest=t",
  ...over,
});

const GUESTS: GuestRow[] = [
  guest({ id: "1", name: "Mariana López", email: "mariana@example.com", phone: "+52 55 1234 5678", groupId: "g_amigos", groupName: "Amigos", maxCompanions: 1, status: "ATTENDING", statusGroup: "confirmed" }),
  guest({ id: "2", name: "Luis Hernández", groupId: "g_familia", groupName: "Familia", maxCompanions: 3, status: "ATTENDING", statusGroup: "confirmed" }),
  guest({ id: "3", name: "Carolina Méndez", email: "caro@example.com", groupId: "g_amigos", groupName: "Amigos" }),
  guest({ id: "4", name: "Javier Torres", phone: "(33) 9876-5432", status: "DECLINED", statusGroup: "declined" }),
  guest({ id: "5", name: "Ana Prueba", status: "MAYBE", statusGroup: "pending", maxCompanions: 2 }),
];

describe("Validación del invitado (servidor)", () => {
  it("normaliza un alta válida", () => {
    const result = validateGuestInput({ name: "  Mariana   López ", email: " Mariana@Example.COM ", phone: " +52  55 1234 5678 ", maxCompanions: "2", groupId: "" });
    expect(result).toEqual({ ok: true, value: { name: "Mariana López", email: "mariana@example.com", phone: "+52 55 1234 5678", maxCompanions: 2, status: undefined, groupId: null, newGroupName: null } });
  });

  it("solo el nombre es obligatorio; los opcionales vacíos quedan en null y los acompañantes en 0", () => {
    expect(validateGuestInput({ name: "Ana" })).toMatchObject({ ok: true, value: { email: null, phone: null, maxCompanions: 0, groupId: null } });
    expect(validateGuestInput({ name: "   " })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    expect(validateGuestInput({ name: "x".repeat(101) })).toMatchObject({ ok: false, errors: { name: expect.stringContaining("100") } });
  });

  it("rechaza correo, teléfono y acompañantes inválidos, con un mensaje por campo", () => {
    const result = validateGuestInput({ name: "Ana", email: "no-es-correo", phone: "abc", maxCompanions: "21" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["email", "maxCompanions", "phone"]);
    for (const value of ["-1", "1.5", "dos", "1e3"]) expect(validateGuestInput({ name: "Ana", maxCompanions: value }).ok, value).toBe(false);
    expect(validateGuestInput({ name: "Ana", maxCompanions: "20" }).ok).toBe(true);
    expect(validateGuestInput({ name: "Ana", phone: "123456" }).ok).toBe(false);
    expect(validateGuestInput({ name: "Ana", phone: "(33) 9876-5432" }).ok).toBe(true);
  });

  it("grupo: existente por id, nuevo por nombre, y valores raros se rechazan", () => {
    expect(validateGuestInput({ name: "Ana", groupId: "grp_demo_family" })).toMatchObject({ ok: true, value: { groupId: "grp_demo_family", newGroupName: null } });
    expect(validateGuestInput({ name: "Ana", groupId: NEW_GROUP_VALUE, newGroupName: "  Familia  de Andrea " })).toMatchObject({ ok: true, value: { groupId: null, newGroupName: "Familia de Andrea" } });
    expect(validateGuestInput({ name: "Ana", groupId: NEW_GROUP_VALUE, newGroupName: " " }).ok).toBe(false);
    expect(validateGuestInput({ name: "Ana", groupId: "x'; DROP TABLE" }).ok).toBe(false);
  });

  it("estado: solo valores del enum", () => {
    expect(validateGuestInput({ name: "Ana", status: "ATTENDING" })).toMatchObject({ ok: true, value: { status: "ATTENDING" } });
    expect(validateGuestInput({ name: "Ana", status: "CONFIRMED" }).ok).toBe(false);
  });

  it("readGuestFormData toma solo los campos permitidos: ownerId, eventId, inviteToken y demás se ignoran", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ name: "Ana", ownerId: "usr_otro", userId: "usr_otro", eventId: "evt_otro", inviteToken: "robado", id: "gst_1", status: "PENDING" })) form.set(key, value);
    const raw = readGuestFormData(form);
    expect(Object.keys(raw).sort()).toEqual(["email", "groupId", "maxCompanions", "name", "newGroupName", "phone", "status"]);
    expect(JSON.stringify(raw)).not.toContain("usr_otro");
    expect(JSON.stringify(validateGuestInput(raw))).not.toContain("robado");
  });
});

describe("Búsqueda, filtros y métricas (lógica pura)", () => {
  it("busca por nombre, correo y teléfono, sin distinguir mayúsculas ni tildes", () => {
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, q: "mendez" }).map((g) => g.id)).toEqual(["3"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, q: "LOPEZ" }).map((g) => g.id)).toEqual(["1"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, q: "caro@" }).map((g) => g.id)).toEqual(["3"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, q: "5512345678" }).map((g) => g.id)).toEqual(["1"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, q: "9876-54" }).map((g) => g.id)).toEqual(["4"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, q: "zzz" })).toEqual([]);
    expect(matchesSearch(GUESTS[0]!, "  ")).toBe(true);
  });

  it("filtra por estado («Tal vez» cuenta como pendiente) y por grupo", () => {
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, status: "confirmed" }).map((g) => g.id)).toEqual(["1", "2"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, status: "pending" }).map((g) => g.id)).toEqual(["3", "5"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, status: "declined" }).map((g) => g.id)).toEqual(["4"]);
    expect(statusGroupOf("MAYBE")).toBe("pending");
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, group: "g_amigos" }).map((g) => g.id)).toEqual(["1", "3"]);
    expect(filterGuests(GUESTS, { ...EMPTY_FILTERS, group: "none" }).map((g) => g.id)).toEqual(["4", "5"]);
    expect(filterGuests(GUESTS, { q: "a", status: "confirmed", group: "g_amigos" }).map((g) => g.id)).toEqual(["1"]);
  });

  it("las métricas se derivan de los invitados: total, estados y acompañantes potenciales", () => {
    expect(summarizeGuests(GUESTS)).toEqual({ total: 5, confirmed: 2, pending: 2, declined: 1, potentialCompanions: 6 });
    expect(summarizeGuests([])).toEqual({ total: 0, confirmed: 0, pending: 0, declined: 0, potentialCompanions: 0 });
  });

  it("los filtros viajan en la URL y los valores desconocidos se ignoran", () => {
    const filters = parseGuestFilters({ q: "mar", status: "confirmed", group: "g_amigos" }, ["g_amigos"]);
    expect(filters).toEqual({ q: "mar", status: "confirmed", group: "g_amigos" });
    expect(guestFiltersToSearch(filters)).toBe("?q=mar&status=confirmed&group=g_amigos");
    expect(guestFiltersToSearch(EMPTY_FILTERS)).toBe("");
    expect(parseGuestFilters({ status: "hackeado", group: "grupo_ajeno", q: ["a", "b"] }, ["g_amigos"])).toEqual({ q: "a", status: "all", group: "" });
    expect(parseGuestFilters({ group: "none" }, []).group).toBe("none");
  });
});
