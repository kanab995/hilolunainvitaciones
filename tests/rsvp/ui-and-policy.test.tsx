import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/(invitation)/i/[slug]/page";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { GeneralRsvpForm } from "@/components/invitation/sections/general-rsvp-form";
import { PersonalizedRsvp } from "@/components/invitation/sections/personalized-rsvp";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { getMockInvitation } from "@/lib/invitation/mock";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { isPrivatePath } from "@/server/auth/access";
import { deriveDemoInviteToken } from "@/server/services/invite-token";
import type { RSVPSettings } from "@/types/invitation";
import type { Personalization } from "@/types/public-rsvp";
import { NOW, visibleText } from "../invitation/helpers";

const DEMO_NOTE = "Modo demostración: las respuestas de tus invitados todavía no se guardan.";

const ROOT = process.cwd();
const template = getInvitationTemplate("magnolia")!;
type GuestPersonalization = Extract<Personalization, { kind: "guest" }>;
const guestPersonalization = (over: Partial<GuestPersonalization["guest"]> = {}): GuestPersonalization => ({
  kind: "guest",
  invitationSlug: "andrea-y-fernando",
  token: "T".repeat(32),
  guest: { displayName: "Mariana López", groupName: "Amigos", maxCompanions: 2, ...over },
  questions: [{ id: "q1", label: "Menú", type: "CHOICE", required: false, options: ["Carne", "Pescado"] }],
});
const render = (personalization?: Personalization) => renderToStaticMarkup(<InvitationRenderer invitation={andreaFernandoInvitation} template={template} now={NOW} personalization={personalization} />);

describe("Invitación general y personalizada", () => {
  it("9. sin token la invitación general sigue igual: sin saludo y con el RSVP genérico existente", () => {
    const html = render(undefined);
    expect(html).not.toContain("data-guest-greeting");
    expect(html).not.toContain("data-rsvp-form");
    expect(visibleText(html)).toContain("Confirmar asistencia");
    expect(visibleText(html)).toContain("Andrea");
    // Invitación real publicada (slug "andrea-y-fernando", no "demo-…"): sin el aviso de demostración.
    expect(visibleText(html)).not.toContain("Modo demostración");
  });

  it("10. con invitado válido: saludo con el nombre (y «y familia» solo por el grupo)", () => {
    expect(visibleText(render(guestPersonalization()))).toContain("Mariana, nos encantará compartir este día contigo.");
    expect(visibleText(render(guestPersonalization({ displayName: "Luis Hernández", groupName: "Familia" })))).toContain("Luis y familia, nos encantará compartir este día con ustedes.");
    // Tener acompañantes permitidos no implica «y familia».
    expect(visibleText(render(guestPersonalization({ groupName: undefined, maxCompanions: 5 })))).not.toContain("y familia");
  });

  it("con token inválido: se ve la invitación completa y el aviso «No pudimos identificar…», sin formulario", () => {
    const html = render({ kind: "invalid" });
    expect(visibleText(html)).toContain("No pudimos identificar esta invitación personalizada.");
    expect(html).toContain("data-guest-invalid");
    expect(html).not.toContain("data-rsvp-form");
    expect(html).not.toContain("data-guest-greeting");
    expect(visibleText(html)).toContain("Andrea");
  });

  it("el HTML personalizado no contiene ids ni datos internos; el token solo está en el campo oculto del formulario", () => {
    const html = render(guestPersonalization());
    for (const forbidden of ["gst_demo", "evt_demo", "grp_demo", "eventId", "guestId", "@example", "createdAt"]) expect(html).not.toContain(forbidden);
    expect(visibleText(html)).not.toContain("T".repeat(32));
    expect(html).toContain(`name="guest" value="${"T".repeat(32)}"`);
    expect(html).toContain('name="slug" value="andrea-y-fernando"');
  });
});

describe("Aviso «modo demostración» en el RSVP: SOLO en demos públicas (lib/invitation/demo.ts → isDemoInvitation)", () => {
  it.each(["magnolia", "ivory", "etoile", "level-12", "aurora-xv"])("aparece en /i/demo-%s", (slug) => {
    const invitation = getMockInvitation(`demo-${slug}`);
    expect(invitation, slug).toBeDefined();
    const html = renderToStaticMarkup(<InvitationRenderer invitation={invitation!} template={getInvitationTemplate(slug)!} now={NOW} />);
    expect(visibleText(html), slug).toContain(DEMO_NOTE);
  });

  it("NO aparece en una invitación real publicada sin token (RSVP general, se envía pero hoy no se guarda)", () => {
    const html = render(undefined);
    expect(visibleText(html)).not.toContain("Modo demostración");
    // El formulario RSVP sigue intacto: botón, y al abrirlo sus campos.
    expect(visibleText(html)).toContain("Confirmar asistencia");
  });

  it("NO aparece con un invitado personalizado (?guest= válido: PersonalizedRsvp, se guarda de verdad)", () => {
    const html = render(guestPersonalization());
    expect(visibleText(html)).not.toContain("Modo demostración");
    expect(html).toContain("data-rsvp-form");
  });

  it("NO aparece con un token inválido (misma invitación general, sin formulario de invitado)", () => {
    const html = render({ kind: "invalid" });
    expect(visibleText(html)).not.toContain("Modo demostración");
  });

  it("una invitación de demostración sigue mostrando el formulario RSVP completo (botón, nombre, asistencia, enviar)", () => {
    const invitation = getMockInvitation("demo-magnolia")!;
    const html = renderToStaticMarkup(<InvitationRenderer invitation={invitation} template={getInvitationTemplate("magnolia")!} now={NOW} />);
    const text = visibleText(html);
    expect(text).toContain("Confirmar asistencia");
    expect(text).toContain(DEMO_NOTE);
  });
});

describe("GeneralRsvpForm (D-40): el CTA del enlace general, sin identidad previa", () => {
  const settings: RSVPSettings = { enabled: true, deadline: "2027-04-17T23:59:00-06:00", message: "", maxCompanions: 2, allowMaybe: true, askDietaryNotes: false };
  const form = (over: Partial<RSVPSettings> = {}, now = NOW) =>
    renderToStaticMarkup(<GeneralRsvpForm invitationSlug="andrea-y-fernando" settings={{ ...settings, ...over }} serverNowMs={now} buttonVariant="solid" />);

  it("muestra el botón de confirmar (o el texto personalizado) y nunca el aviso de demostración", () => {
    const html = form();
    expect(visibleText(html)).toContain("Confirmar asistencia");
    expect(visibleText(html)).not.toContain("Modo demostración");
    expect(html).not.toContain("data-rsvp-form"); // cerrado en el primer render: sin formulario aún
  });

  it("usa el texto del botón de la invitación si lo tiene", () => {
    expect(visibleText(form({ ctaLabel: "Sí, ahí estaré" }))).toContain("Sí, ahí estaré");
  });

  it("deshabilitado o fuera de plazo: mismo copy que el resto del RSVP, sin botón", () => {
    expect(visibleText(form({ enabled: false }))).toContain("La confirmación de asistencia no está disponible.");
    expect(visibleText(form({}, Date.parse("2027-05-01T00:00:00Z")))).toContain("El plazo para confirmar ya terminó.");
    expect(form({ enabled: false })).not.toContain("Confirmar asistencia");
  });
});

describe("Formulario RSVP personalizado (marcado)", () => {
  const form = (personalization = guestPersonalization(), now = NOW) => renderToStaticMarkup(<PersonalizedRsvp personalization={personalization} settings={andreaFernandoInvitation.rsvp} serverNowMs={now} buttonVariant="solid" />);

  it("fieldset/legend «¿Nos acompañas?» con las tres opciones del enum, textarea de 500 y botón grande", () => {
    const html = form();
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>¿Nos acompañas\?<\/legend>/);
    for (const label of ["Sí, asistiré", "No podré asistir", "Aún no estoy seguro"]) expect(visibleText(html)).toContain(label);
    expect(html).toContain('value="ATTENDING"');
    expect(html).toContain('value="DECLINED"');
    expect(html).toContain('value="MAYBE"');
    expect(html).toMatch(/<textarea[^>]*maxLength="500"/);
    expect(visibleText(html)).toContain("Déjanos un mensaje");
    expect(visibleText(html)).toContain("Confirmar respuesta");
    expect(html).toContain("min-h-12"); // controles táctiles
    expect(html).not.toContain("--lu-"); // solo tokens de la invitación
  });

  it("el selector de personas no aparece hasta elegir «Sí»", () => {
    expect(form()).not.toContain('name="attendeeCount"');
  });

  it("con respuesta guardada: «Tu respuesta actual», el resumen y «Cambiar respuesta»", () => {
    const current = form(guestPersonalization({ currentRsvp: { status: "ATTENDING", attendeeCount: 3, message: null, answers: {} } }));
    expect(visibleText(current)).toContain("Tu respuesta actual");
    expect(visibleText(current)).toContain("✓ Asistirás con 3 personas");
    expect(visibleText(current)).toContain("Cambiar respuesta");
    expect(current).not.toContain("data-rsvp-form");
    expect(visibleText(form(guestPersonalization({ currentRsvp: { status: "DECLINED", attendeeCount: 0, message: null, answers: {} } })))).toContain("No podrás asistir");
    expect(visibleText(form(guestPersonalization({ currentRsvp: { status: "MAYBE", attendeeCount: null, message: null, answers: {} } })))).toContain("Aún no estás seguro");
  });

  it("fuera de plazo no hay formulario: solo la respuesta actual y el aviso", () => {
    const html = form(guestPersonalization({ currentRsvp: { status: "ATTENDING", attendeeCount: 1, message: null, answers: {} } }), Date.parse("2027-06-01T00:00:00Z"));
    expect(visibleText(html)).toContain("El plazo para confirmar ya terminó.");
    expect(html).not.toContain("data-rsvp-form");
  });
});

describe("Política: sin cuenta, sin caché, sin indexar, sin datos personales en metadatos", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
  const rel = (file: string) => relative(ROOT, file).replaceAll("\\", "/");

  it("8. el RSVP público no usa Clerk ni la sesión: acción, servicios, repositorio y página", () => {
    const publicFiles = [
      ...files(join(ROOT, "app/(invitation)")),
      join(ROOT, "server/services/public-rsvp.ts"),
      join(ROOT, "server/services/public-rsvp-runtime.ts"),
      join(ROOT, "server/services/public-context.ts"),
      join(ROOT, "server/repositories/public-invitations.ts"),
      join(ROOT, "server/repositories/guest-response.ts"),
      join(ROOT, "components/invitation/sections/personalized-rsvp.tsx"),
    ];
    const offenders = publicFiles.filter((file) => /@clerk|server\/auth|requireAuth|getOrCreateCurrentUser|resolveOwnedEvent/.test(readFileSync(file, "utf8"))).map(rel);
    expect(offenders).toEqual([]);
    expect(isPrivatePath("/i/andrea-y-fernando")).toBe(false);
    expect(readFileSync(join(ROOT, "app/(invitation)/layout.tsx"), "utf8")).not.toMatch(/Clerk/);
  });

  it("la página es siempre dinámica y la acción pública es un módulo «use server»", () => {
    const page = readFileSync(join(ROOT, "app/(invitation)/i/[slug]/page.tsx"), "utf8");
    expect(page).toMatch(/export const dynamic = "force-dynamic"/);
    expect(page).toMatch(/referrer: "no-referrer"/);
    expect(page).toMatch(/robots = \{ index: false, follow: false \}/);
    const action = readFileSync(join(ROOT, "app/(invitation)/i/[slug]/actions.ts"), "utf8");
    expect(action.startsWith('"use server"')).toBe(true);
    expect(action).toMatch(/export async function submitPublicRsvp\(/);
  });

  it("los metadatos (título, robots) no incluyen el nombre del invitado aunque haya ?guest=", async () => {
    const token = deriveDemoInviteToken("gst_demo_1");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "andrea-y-fernando" }), searchParams: Promise.resolve({ guest: token }) } as never);
    expect(metadata.title).toBe("Andrea & Fernando");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(metadata)).not.toMatch(/Mariana|López|guest|Hernández/);
  });

  it("no se registran tokens, mensajes, respuestas, emails ni teléfonos", () => {
    const sources = ["server/services/public-rsvp.ts", "server/repositories/public-invitations.ts", "app/(invitation)/i/[slug]/actions.ts"].map((file) => readFileSync(join(ROOT, file), "utf8"));
    for (const source of sources) for (const line of source.split("\n").filter((l) => /console\.(log|warn|error|info)/.test(l))) expect(line).not.toMatch(/token|message|answers|email|phone|raw|value/i);
  });

  it("el sitemap solo lista páginas de marketing: ninguna invitación (/i/**), token de invitado, panel, consola ni vista previa", async () => {
    const sitemap = (await import("@/app/sitemap")).default;
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.length).toBeGreaterThan(4);
    for (const url of urls) expect(new URL(url).pathname, url).toMatch(/^\/(templates(\/[a-z0-9-]+)?|pricing|privacy|terms)?$/);
    expect(urls.join(" ")).not.toMatch(/\/i\/|guest=|\/dashboard|\/admin|\/preview/);
  });
});
