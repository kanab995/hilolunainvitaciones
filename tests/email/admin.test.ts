import { describe, expect, it, vi } from "vitest";
import { maskEmail } from "@/lib/admin/mask";

describe("(51) maskEmail: nunca el correo completo", () => {
  it("conserva los dos primeros caracteres y el dominio completo", () => {
    expect(maskEmail("mariana@ejemplo.com")).toBe("ma•••••@ejemplo.com");
    expect(maskEmail("a@ejemplo.com")).toBe("a••@ejemplo.com");
    expect(maskEmail("sin-arroba")).toBe("••••");
  });

  it("nunca es igual al valor original ni lo contiene entero", () => {
    const email = "propietario.real@hiloluna.com";
    expect(maskEmail(email)).not.toBe(email);
    expect(maskEmail(email).startsWith("propietario.real")).toBe(false);
  });
});

vi.mock("@/server/repositories/email-delivery", () => ({
  countAdminEmailDeliveries: vi.fn(async () => 1),
  listAdminEmailDeliveries: vi.fn(async () => [
    { id: "del_1", kind: "RSVP_NOTIFICATION", status: "SENT", eventId: "evt_1", errorCode: null, createdAt: new Date("2027-01-01T00:00:00Z"), sentAt: new Date("2027-01-01T00:00:01Z"), recipient: { id: "usr_1", email: "propietario@hiloluna.com", name: "Owner" } },
  ]),
}));

import { listAdminEmailDeliveries as listAdmin } from "@/server/admin/emails";

describe("(39/51) /admin/emails: DTO mínimo, destinatario enmascarado", () => {
  it("nunca expone el correo completo ni más campos que los declarados en el DTO", async () => {
    const result = await listAdmin({ id: "adm_1", role: "ADMIN", email: "admin@hiloluna.com", name: "Admin" }, { page: 1 });
    expect(result.rows).toEqual([{ id: "del_1", kind: "RSVP_NOTIFICATION", status: "SENT", maskedRecipient: "pr•••••••••@hiloluna.com", eventId: "evt_1", errorCode: null, createdAt: new Date("2027-01-01T00:00:00Z"), sentAt: new Date("2027-01-01T00:00:01Z") }]);
    expect(JSON.stringify(result)).not.toContain("propietario@hiloluna.com");
  });
});
