import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateEventWizard } from "@/components/onboarding/create-event-wizard";
import { EditorProvider, type EditorContextValue } from "@/components/editor/editor-context";
import { ClosingEditor } from "@/components/editor/section-editors/closing-editor";
import { DressCodeEditor } from "@/components/editor/section-editors/dress-code-editor";
import { GalleryEditor } from "@/components/editor/section-editors/gallery-editor";
import { GiftEditor } from "@/components/editor/section-editors/gift-editor";
import { LocationEditor } from "@/components/editor/section-editors/location-editor";
import { MusicEditor } from "@/components/editor/section-editors/music-editor";
import { RsvpEditor } from "@/components/editor/section-editors/rsvp-editor";
import { StoryEditor } from "@/components/editor/section-editors/story-editor";
import { TimelineEditor } from "@/components/editor/section-editors/timeline-editor";
import { GuestManager } from "@/components/guests/guest-manager";
import { buildEditorRows } from "@/lib/editor/rows";
import { validateInvitation } from "@/lib/editor/validation";
import { createDefaultInvitationData } from "@/lib/events/default-invitation";
import { getDashboardNav, getEventRefFromPath } from "@/lib/dashboard/navigation";
import { EMPTY_FILTERS, summarizeGuests } from "@/lib/guests/filter";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { getDemoRows } from "@/server/repositories/demo-store";
import { buildDashboardData } from "@/server/services/dashboard";
import type { Invitation } from "@/types/invitation";
import { render, visibleText } from "../invitation/helpers";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { NOW } from "../invitation/helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/dashboard/events/evt_new/guests", redirect: vi.fn(), notFound: vi.fn() }));

const fresh = (): Invitation =>
  createDefaultInvitationData({ eventType: "wedding", templateSlug: "magnolia", names: ["Sofía", "Diego"], startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", invitationSlug: "sofia-y-diego" });

describe("41/66. La invitación de un evento NUEVO (datos vacíos) no muestra basura al invitado", () => {
  const html = render(fresh(), magnoliaTemplate);
  const text = visibleText(html);

  it("no imprime undefined, null, [], «Sin definir» ni «Sin nombre»", () => {
    for (const forbidden of ["undefined", "null", "[]", "[object", "Sin definir", "Sin nombre", "NaN"]) expect(text, forbidden).not.toContain(forbidden);
    expect(html).not.toContain("undefined");
  });

  it("dibuja lo que sí tiene contenido: portada, historia, cuenta regresiva, RSVP y cierre", () => {
    expect(text).toContain("Sofía");
    expect(text).toContain("Diego");
    expect(text).toContain("Nos casamos");
    expect(text).toContain("Queremos compartir contigo un día muy especial.");
    expect(text).toContain("Faltan");
    expect(text).toContain("Nos encantará contar contigo.");
    expect(text).toContain("Gracias por ser parte de este día");
  });

  it("oculta (sin placeholders) las secciones incompletas: sedes sin nombre, itinerario, galería vacía, dress code y regalos vacíos", () => {
    expect(html).not.toContain('data-section="locations"');
    expect(html).not.toContain("data-timeline-layout");
    expect(html).not.toContain("data-gallery-layout");
    expect(html).not.toContain("data-editor-placeholder");
    for (const forbidden of ["Ubicación", "Itinerario", "Galería", "Dress code", "Mesa de regalos"]) expect(text, forbidden).not.toContain(forbidden);
    // «Agrega …» (placeholders del editor) no debe verse; «Agregar al calendario» es el botón legítimo del calendario.
    expect(text).not.toMatch(/Agrega(?!r al calendario)/);
  });

  it("en la vista previa del EDITOR sí hay avisos discretos para lo que falta", () => {
    const editorHtml = renderToStaticMarkup(<InvitationRenderer invitation={fresh()} template={magnoliaTemplate} now={NOW} mode="editor" />);
    const editorText = visibleText(editorHtml);
    for (const hint of ["Agrega una ubicación", "Agrega los momentos del día", "Agrega fotos a la galería", "Agrega un código de vestimenta"]) expect(editorText, hint).toContain(hint);
    expect(editorHtml.match(/data-editor-placeholder/g)).toHaveLength(4);
  });

  it("66. galería vacía, mesa de regalos vacía y sedes incompletas no rompen el renderizador con los datos de la demostración", () => {
    const partial: Invitation = {
      ...andreaFernandoInvitation,
      gallery: [],
      giftRegistry: { message: "", entries: [] },
      locations: [{ id: "l1", kind: "ceremony", name: "", addressLines: [""] }, andreaFernandoInvitation.locations[1]!],
    };
    const partialText = visibleText(render(partial, magnoliaTemplate));
    expect(partialText).toContain("Hacienda Los Olivos");
    expect(partialText).not.toContain("Sin nombre");
    expect(partialText).not.toContain("Liverpool");
    expect(partialText).not.toContain("Nuestros momentos");
  });
});

/** Contexto mínimo del editor con una invitación NUEVA (sin mocks). */
function editorHtml(node: (invitation: Invitation) => React.ReactElement, invitation = fresh()) {
  const noop = () => undefined;
  const list = { add: noop, remove: noop, move: noop, patch: noop, reorder: noop };
  const idle = { phase: "idle" as const };
  const context = {
    draft: invitation,
    api: { lists: { gallery: list, locations: list, timeline: list, giftEntries: list }, updateInvitation: noop, updateSection: noop },
    errors: validateInvitation(invitation),
    template: magnoliaTemplate,
    images: { create: () => "blob:x", revoke: noop, revokeAll: noop, has: () => false, size: 0 },
    media: { cover: { status: idle, enabled: false, disabledReason: "x", onFile: noop, onRemove: noop }, location: () => undefined, gallery: { status: idle, enabled: false, add: noop, remove: noop, removeStatus: () => idle } },
    selectRow: noop,
  } as unknown as EditorContextValue;
  return renderToStaticMarkup(<EditorProvider value={context}>{node(invitation)}</EditorProvider>);
}

describe("40/66. El editor abre un evento recién creado sin fallar", () => {
  const section = (invitation: Invitation, type: Invitation["sections"][number]["type"]) => invitation.sections.find((item) => item.type === type);

  it("el borrador nuevo no tiene errores de validación bloqueantes (el autoguardado puede guardar)", () => {
    expect(validateInvitation(fresh())).toEqual({});
  });

  it("todas las filas del editor existen (10 secciones + Fecha + Música) y ninguna es de la demostración", () => {
    const rows = buildEditorRows(fresh());
    expect(rows.map((row) => row.type)).toContain("music");
    expect(rows.map((row) => row.type)).toContain("date");
    expect(rows).toHaveLength(12);
  });

  it("los editores de sección se renderizan con cadenas vacías, listas vacías y sin galería", () => {
    const cases: [string, (i: Invitation) => React.ReactElement][] = [
      ["story", (i) => <StoryEditor section={section(i, "story")} />],
      ["locations", (i) => <LocationEditor section={section(i, "locations")} />],
      ["gallery", (i) => <GalleryEditor section={section(i, "gallery")} />],
      ["dressCode", (i) => <DressCodeEditor section={section(i, "dressCode")} />],
      ["gifts", (i) => <GiftEditor section={section(i, "giftRegistry")} />],
      ["timeline", (i) => <TimelineEditor section={section(i, "timeline")} />],
      ["rsvp", (i) => <RsvpEditor section={section(i, "rsvp")} />],
      ["closing", (i) => <ClosingEditor section={section(i, "footer")} />],
      ["music", () => <MusicEditor />],
    ];
    for (const [name, node] of cases) {
      const html = editorHtml(node);
      expect(html, name).not.toContain("undefined");
      expect(html.length, name).toBeGreaterThan(50);
    }
  });

  it("la galería vacía ofrece agregar y las sedes vacías se pueden completar", () => {
    expect(visibleText(editorHtml((i) => <GalleryEditor section={section(i, "gallery")} />))).toContain("Todavía no hay fotos");
    const locations = editorHtml((i) => <LocationEditor section={section(i, "locations")} />);
    expect(locations).toContain("Nombre del lugar");
    expect(locations).toContain("Ceremonia");
    expect(locations).toContain("Recepción");
  });
});

describe("45/46. Dashboard y Guest Manager con 0 invitados", () => {
  it("el dashboard de un evento nuevo tiene 0 confirmados, 0 pendientes y 0 rechazos, sin actividad", () => {
    const invitation = fresh();
    const data = buildDashboardData({
      event: { id: "evt_new", title: "Sofía & Diego", startsAt: new Date("2027-05-17T23:00:00Z"), timezone: "America/Mexico_City" } as never,
      invitation,
      guests: [],
    });
    expect(data.recentActivity).toEqual([]);
    expect(data.rsvpSummary).toMatchObject({ confirmed: 0, pending: 0, declined: 0 });
    expect(data.event.publicSlug).toBe("sofia-y-diego");
    expect(JSON.stringify(data)).not.toMatch(/NaN|undefined/);
  });

  it("el Guest Manager muestra su estado vacío existente y no crea invitados por defecto", () => {
    expect(summarizeGuests([])).toMatchObject({ total: 0 });
    const html = renderToStaticMarkup(<GuestManager eventId="evt_new" guests={[]} totalCount={0} groups={[]} filters={EMPTY_FILTERS} publication={{ slug: "s", state: "draft" }} />);
    expect(visibleText(html)).toContain("Aún no has agregado invitados.");
  });

  it("el alta de un evento nunca crea invitados ni respuestas", () => {
    const seed = getDemoRows(new Date());
    expect(seed.guestRecords.length).toBeGreaterThan(0); // la demostración sí tiene
    const source = readFileSync(join(process.cwd(), "server/services/event-creation.ts"), "utf8");
    expect(source).not.toMatch(/guests:\s*\[\s*\{|createMany/); // el servicio no fabrica invitados
  });
});

describe("Asistente de creación (pantalla 1)", () => {
  const templates = [{ slug: "magnolia", name: "Magnolia", eventType: "wedding", thumbSrc: "/templates/magnolia/cover-bg.png" }];

  it("muestra los siete tipos de evento como opciones accesibles y permite volver a plantillas sin crear nada", () => {
    const html = renderToStaticMarkup(<CreateEventWizard templates={templates} initialTemplate="magnolia" />);
    const text = visibleText(html);
    for (const label of ["Boda", "XV años", "Bautizo", "Cumpleaños", "Baby shower", "Graduación", "Otro"]) expect(text, label).toContain(label);
    expect(html.match(/type="radio"/g)).toHaveLength(7);
    expect(html).toContain('href="/templates"');
    expect(text).toContain("Volver a plantillas");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*Continuar/); // sin tipo elegido no se puede continuar
    expect(html).toContain("<h2");
  });

  it("no incluye campos de propietario ni escribe en ningún momento antes del envío final (sin <form action>)", () => {
    const html = renderToStaticMarkup(<CreateEventWizard templates={templates} initialTemplate="magnolia" notice="No encontramos esa plantilla. Elige una de las disponibles." />);
    expect(html).not.toMatch(/ownerId|userId/);
    expect(html).not.toMatch(/<form[^>]*action=/);
    expect(html).toContain("No encontramos esa plantilla");
  });
});

describe("Navegación del panel sin eventos", () => {
  it("un usuario sin eventos no ve enlaces de secciones de evento (ningún enlace muerto)", () => {
    expect(getDashboardNav(null).map((item) => item.id)).toEqual(["events", "templates"]);
    expect(getDashboardNav("evt_new").map((item) => item.id)).toEqual(["events", "templates", "guests", "rsvp", "messages", "settings"]);
    expect(getDashboardNav("evt_new").find((item) => item.id === "guests")?.href).toBe("/dashboard/events/evt_new/guests");
  });

  it("/dashboard/events/new no es un evento", () => {
    expect(getEventRefFromPath("/dashboard/events/new")).toBeUndefined();
    expect(getEventRefFromPath("/dashboard/events/evt_new/guests")).toBe("evt_new");
  });
});

describe("Server Action del alta", () => {
  const source = readFileSync(join(process.cwd(), "app/(site)/dashboard/(workspace)/events/new/actions.ts"), "utf8");

  it("3/29/30. exige sesión, lista blanca de campos (sin ownerId), delega en el servicio y redirige al editor real", () => {
    expect(source).toContain("requireAuth()");
    expect(source).toContain("createEventForUser(user, input)");
    expect(source).toContain("routes.eventEdit(result.eventId)");
    expect(source).toContain("revalidatePath(routes.events)");
    expect(source).not.toMatch(/raw\.ownerId|raw\.userId|ownerId:/);
  });
});
