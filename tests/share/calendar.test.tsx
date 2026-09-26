import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/(invitation)/i/[slug]/calendar.ics/route";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { buildIcs, escapeIcsText, foldIcsLine, localEventTime } from "@/lib/calendar/ics";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { isPrivatePath } from "@/server/auth/access";
import { getPublishedCalendar, type CalendarDeps } from "@/server/services/calendar-service";
import { deriveDemoInviteToken } from "@/server/services/invite-token";
import type { Invitation } from "@/types/invitation";
import type { Personalization } from "@/types/public-rsvp";
import type { PublishedRecord } from "@/server/repositories/publishing";
import { NOW, visibleText } from "../invitation/helpers";

const ROOT = process.cwd();
const template = getInvitationTemplate("magnolia")!;
const STAMP = new Date("2027-01-02T10:00:00Z");
/** Código sin comentarios (los comentarios explican, no ejecutan). */
const code = (file: string) => readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const unfold = (ics: string) => ics.replace(/\r\n /g, "");
const field = (ics: string, name: string) => unfold(ics).split("\r\n").find((line) => line.startsWith(`${name}`));

/** Doble de la persistencia: el BORRADOR y el SNAPSHOT PUBLICADO son objetos distintos, como en D-29. */
function fakeStore(published?: { invitation: Invitation; version: number }) {
  const state = { draft: andreaFernandoInvitation as Invitation, published, loads: 0 };
  const deps: CalendarDeps = {
    now: () => Date.parse("2027-03-01T00:00:00Z"),
    load: async (slug) => {
      state.loads += 1;
      if (!state.published || state.published.invitation.slug !== slug) return undefined; // el borrador NO es consultable aquí
      const record: PublishedRecord = { invitation: state.published.invitation, eventId: "evt_1", publication: { version: state.published.version, publishedAt: "2027-01-02T10:00:00.000Z" } };
      return record;
    },
  };
  const publish = () => {
    state.published = { invitation: structuredClone(state.draft), version: (state.published?.version ?? 0) + 1 };
  };
  return { state, deps, publish };
}

describe("Generador .ics", () => {
  it("(43.2) DTSTART con la hora local del evento (TZID) y sin desfases manuales: 17:00 en Ciudad de México", () => {
    const ics = buildIcs({ uid: "a@b", title: "t", startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", url: "https://x.test/i/a", stamp: STAMP })!;
    expect(field(ics, "DTSTART;")).toBe("DTSTART;TZID=America/Mexico_City:20270517T170000");
    expect(ics).toContain("TZOFFSETTO:-0600");
  });

  it("(43.3) respeta la zona del evento, incluido el horario de verano, sin importar la zona del servidor", () => {
    // Mismo instante UTC → hora local distinta según la zona del EVENTO.
    expect(localEventTime("2027-07-10T18:00:00Z", "America/New_York")).toEqual({ local: "20270710T140000", offsetMinutes: -240 }); // verano (EDT)
    expect(localEventTime("2027-01-10T18:00:00Z", "America/New_York")).toEqual({ local: "20270110T130000", offsetMinutes: -300 }); // invierno (EST)
    expect(localEventTime("2027-10-10T18:00:00Z", "Europe/Madrid")).toEqual({ local: "20271010T200000", offsetMinutes: 120 });
    expect(localEventTime("2027-05-17T23:00:00Z", "America/Mexico_City")).toEqual({ local: "20270517T170000", offsetMinutes: -360 });
    // Un offset ISO distinto del de la zona no descoloca la hora: manda la zona del evento.
    expect(localEventTime("2027-05-17T17:00:00-06:00", "Asia/Tokyo")).toEqual({ local: "20270518T080000", offsetMinutes: 540 });
  });

  it("datos inválidos (fecha o zona) no producen un archivo roto", () => {
    expect(buildIcs({ uid: "a", title: "t", startsAtIso: "no-es-fecha", timezone: "America/Mexico_City", url: "https://x.test", stamp: STAMP })).toBeUndefined();
    expect(buildIcs({ uid: "a", title: "t", startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "Mars/Olympus", url: "https://x.test", stamp: STAMP })).toBeUndefined();
  });

  it("(29/30) trae UID, DTSTAMP, SUMMARY, DESCRIPTION con la URL, LOCATION y URL; y NO inventa DTEND", () => {
    const ics = buildIcs({ uid: "andrea-y-fernando@hiloluna.com", title: "Andrea & Fernando", startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", location: "Parroquia, Calle de la Paz 123", url: "https://hiloluna.com/i/andrea-y-fernando", stamp: STAMP, version: 3 })!;
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(field(ics, "UID:")).toBe("UID:andrea-y-fernando@hiloluna.com");
    expect(field(ics, "DTSTAMP:")).toBe("DTSTAMP:20270102T100000Z");
    expect(field(ics, "SEQUENCE:")).toBe("SEQUENCE:2");
    expect(field(ics, "SUMMARY:")).toBe("SUMMARY:Andrea & Fernando");
    expect(field(ics, "DESCRIPTION:")).toBe("DESCRIPTION:Consulta todos los detalles de la invitación:\\nhttps://hiloluna.com/i/andrea-y-fernando");
    expect(field(ics, "LOCATION:")).toBe("LOCATION:Parroquia\\, Calle de la Paz 123");
    expect(field(ics, "URL:")).toBe("URL:https://hiloluna.com/i/andrea-y-fernando");
    expect(ics).not.toContain("DTEND");
    expect(ics).not.toContain("DURATION");
  });

  it("sin sede no se escribe LOCATION", () => {
    const ics = buildIcs({ uid: "a", title: "t", startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", url: "https://x.test", stamp: STAMP })!;
    expect(ics).not.toContain("LOCATION");
  });

  it("(31) escapa el texto (\\, ;, , y saltos de línea) para que un nombre no inyecte campos", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
    const ics = buildIcs({ uid: "a", title: "Ana; Luis\r\nATTENDEE:mailto:x@y.z", startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", url: "https://x.test", stamp: STAMP })!;
    expect(ics).not.toMatch(/^ATTENDEE/m);
    expect(field(ics, "SUMMARY:")).toBe("SUMMARY:Ana\\; Luis\\nATTENDEE:mailto:x@y.z");
  });

  it("pliega las líneas a 75 octetos sin partir caracteres y terminan en CRLF", () => {
    const ics = buildIcs({ uid: "a", title: "Ñandú ".repeat(40), startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", url: "https://x.test", stamp: STAMP })!;
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toMatch(/(^|[^\r])\n/);
    expect(unfold(ics)).toContain(`SUMMARY:${"Ñandú ".repeat(40)}`);
    expect(foldIcsLine("x".repeat(200)).join("").replace(/ /g, "")).toBe("x".repeat(200));
  });
});

describe("Servicio de calendario: solo la versión PUBLICADA", () => {
  it("(43.1/17) construye el .ics desde el snapshot publicado, con la URL pública GENERAL y la sede principal", async () => {
    const { deps } = fakeStore({ invitation: andreaFernandoInvitation, version: 1 });
    const file = (await getPublishedCalendar("andrea-y-fernando", deps))!;
    expect(file.filename).toBe("invitacion-andrea-y-fernando.ics");
    const ics = file.body;
    expect(field(ics, "SUMMARY:")).toBe("SUMMARY:Andrea & Fernando");
    expect(field(ics, "DTSTART;")).toBe("DTSTART;TZID=America/Mexico_City:20270517T170000");
    expect(field(ics, "LOCATION:")).toBe("LOCATION:Parroquia de San Miguel Arcángel\\, Calle de la Paz 123\\, San Miguel de Allende\\, Gto.");
    expect(field(ics, "URL:")).toMatch(/^URL:https?:\/\/[^?\s]+\/i\/andrea-y-fernando$/); // sin ?guest=
    expect(field(ics, "DTSTAMP:")).toBe("DTSTAMP:20270102T100000Z"); // fecha de publicación, no la de descarga
    expect(field(ics, "UID:")).toMatch(/^UID:andrea-y-fernando@/);
  });

  it("(43.6/43.8) un borrador sin publicar no tiene calendario (404); un slug inválido ni siquiera consulta", async () => {
    const { deps, state } = fakeStore(undefined);
    expect(await getPublishedCalendar("andrea-y-fernando", deps)).toBeUndefined();
    const loadsBefore = state.loads;
    for (const bad of ["../etc/passwd", "A B", "a/b", "", "x".repeat(200), "a--b"]) expect(await getPublishedCalendar(bad, deps), bad).toBeUndefined();
    expect(state.loads).toBe(loadsBefore);
  });

  it("(43.7 / 44) cambiar la fecha del BORRADOR sin republicar NO cambia el .ics", async () => {
    const store = fakeStore({ invitation: structuredClone(andreaFernandoInvitation), version: 1 });
    const before = (await getPublishedCalendar("andrea-y-fernando", store.deps))!.body;
    store.state.draft = { ...andreaFernandoInvitation, names: ["Otra", "Pareja"], event: { startsAt: "2028-01-01T10:00:00-06:00", timezone: "America/Mexico_City" }, locations: [] };
    const after = (await getPublishedCalendar("andrea-y-fernando", store.deps))!.body;
    expect(after).toBe(before);
    expect(after).toContain("20270517T170000");
  });

  it("(43.7) republicar SÍ actualiza el .ics (nueva fecha, mismo UID y SEQUENCE mayor)", async () => {
    const store = fakeStore({ invitation: structuredClone(andreaFernandoInvitation), version: 1 });
    const before = (await getPublishedCalendar("andrea-y-fernando", store.deps))!.body;
    store.state.draft = { ...andreaFernandoInvitation, event: { startsAt: "2028-01-01T10:00:00-06:00", timezone: "America/Mexico_City" } };
    store.publish();
    const after = (await getPublishedCalendar("andrea-y-fernando", store.deps))!.body;
    expect(after).not.toBe(before);
    expect(field(after, "DTSTART;")).toBe("DTSTART;TZID=America/Mexico_City:20280101T100000");
    expect(field(after, "UID:")).toBe(field(before, "UID:"));
    expect(field(before, "SEQUENCE:")).toBe("SEQUENCE:0");
    expect(field(after, "SEQUENCE:")).toBe("SEQUENCE:1");
  });

  it("(43.4/43.5) el .ics no contiene datos de invitados: ni nombre, ni token, ni email/teléfono, ni ?guest=", async () => {
    const { deps } = fakeStore({ invitation: andreaFernandoInvitation, version: 1 });
    const ics = (await getPublishedCalendar("andrea-y-fernando", deps))!.body;
    const token = deriveDemoInviteToken("gst_demo_1");
    for (const forbidden of [token, "guest=", "gst_", "Mariana", "ATTENDEE", "ORGANIZER", "mailto:", "@gmail", "+52"]) expect(ics, forbidden).not.toContain(forbidden);
    // Por construcción: el servicio no importa nada de invitados ni del borrador.
    const source = code("server/services/calendar-service.ts");
    expect(source).not.toMatch(/guest|prisma|getOwned|clerk|auth/i);
    expect(source).toMatch(/loadPublishedInvitation/);
  });
});

describe("Ruta pública /i/[slug]/calendar.ics", () => {
  const call = (slug: string) => GET(new Request(`http://localhost/i/${slug}/calendar.ics`), { params: Promise.resolve({ slug }) });

  it("un slug inválido responde 404 de texto plano, no indexable, sin tocar la base", async () => {
    const response = await call("..%2fetc");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("la invitación de demostración publicada responde text/calendar como adjunto .ics, sin caché compartida", async () => {
    const response = await call("andrea-y-fernando");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="invitacion-andrea-y-fernando.ics"');
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const body = await response.text();
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).not.toContain("guest=");
  });

  it("un slug publicado inexistente responde 404", async () => {
    expect((await call("no-existe-nunca")).status).toBe(404);
  });

  it("es pública: la ruta no usa Clerk ni sesión, y el proxy no la protege", () => {
    expect(code("app/(invitation)/i/[slug]/calendar.ics/route.ts")).not.toMatch(/clerk|requireAuth|auth\(/i);
    expect(isPrivatePath("/i/andrea-y-fernando/calendar.ics")).toBe(false);
  });
});

describe("«Agregar al calendario» en la invitación pública", () => {
  const publicSlug: Invitation = andreaFernandoInvitation;
  const html = (options: { invitation?: Invitation; personalization?: Personalization; mode?: "public" | "editor" } = {}) =>
    renderToStaticMarkup(<InvitationRenderer invitation={options.invitation ?? publicSlug} template={template} now={NOW} personalization={options.personalization} mode={options.mode} />);

  it("(45/46) está activo como enlace de descarga a /i/<slug>/calendar.ics, sin Clerk, en la invitación general", () => {
    const markup = html();
    expect(visibleText(markup)).toContain("Agregar al calendario");
    expect(markup).toMatch(/<a[^>]*href="\/i\/andrea-y-fernando\/calendar\.ics"[^>]*download/);
    expect(markup).toContain("data-calendar-cta");
  });

  it("(47) no rompe la personalización: con invitado sigue el saludo y el enlace del calendario es el GENERAL (sin token)", () => {
    const token = deriveDemoInviteToken("gst_demo_1");
    const personalization: Personalization = {
      kind: "guest",
      invitationSlug: "andrea-y-fernando",
      token,
      guest: { displayName: "Mariana López", groupName: "Amigos", maxCompanions: 2 },
      questions: [],
    };
    const markup = html({ personalization });
    expect(visibleText(markup)).toContain("Mariana, nos encantará compartir este día contigo.");
    expect(markup).toMatch(/href="\/i\/andrea-y-fernando\/calendar\.ics"/);
    expect(markup).not.toMatch(/calendar\.ics\?/);
  });

  it("las demostraciones de plantilla (demo-*) no muestran el botón: no hay .ics que descargar", () => {
    expect(html({ invitation: { ...publicSlug, slug: "demo-magnolia" } })).not.toContain("data-calendar-cta");
  });

  it("en la vista previa del editor no es un enlace (no descarga nada, aparece deshabilitado)", () => {
    const markup = html({ mode: "editor" });
    expect(markup).not.toMatch(/href="[^"]*calendar\.ics"/);
    expect(visibleText(markup)).toContain("Agregar al calendario");
    expect(markup).toContain('aria-disabled="true"');
  });
});
