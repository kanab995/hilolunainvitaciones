import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCards } from "@/components/dashboard/action-cards";
import { EventBanner } from "@/components/dashboard/event-banner";
import { EventHeader } from "@/components/dashboard/event-header";
import { EventPreviewCard } from "@/components/dashboard/event-preview-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { describeRsvpSummary, RsvpDonut } from "@/components/dashboard/rsvp-donut";
import { RsvpSummary } from "@/components/dashboard/rsvp-summary";
import { ShareDialogProvider } from "@/components/dashboard/share-dialog";
import { getDashboardNav } from "@/lib/dashboard/navigation";
import { displayShareUrl, shareUrl } from "@/lib/dashboard/share";
import { getMockInvitation } from "@/lib/invitation/mock";
import { dbInvitationToDomain } from "@/server/mappers/invitation";
import { getDemoRows } from "@/server/repositories/demo-store";
import { buildDashboardData } from "@/server/services/dashboard";
import { visibleText } from "../invitation/helpers";
import type { EventDashboardData } from "@/types/dashboard";

const NOW = Date.parse("2026-09-24T12:00:00-06:00");

/** Datos del dashboard derivados de las filas persistidas (mismo camino que la base de datos). */
function demo(now = NOW): EventDashboardData {
  const { event, invitation, guests } = getDemoRows(new Date(now));
  return buildDashboardData({ event, invitation: dbInvitationToDomain(invitation), guests });
}

function renderHeader(event: EventDashboardData["event"], now: number): string {
  return renderToStaticMarkup(
    <ShareDialogProvider slug={event.publicSlug} title={event.title} state="published" eventId={event.id}>
      <EventHeader event={event} now={now} />
    </ShareDialogProvider>,
  );
}

function renderPage(data: EventDashboardData, now = NOW): string {
  return renderToStaticMarkup(
    <ShareDialogProvider slug={data.event.publicSlug} title={data.event.title} state="published" eventId={data.event.id}>
      <EventHeader event={data.event} now={now} />
      <EventBanner data={data} />
      <RsvpSummary summary={data.rsvpSummary} eventId={data.event.id} />
      <ActionCards data={data} />
      <RecentActivity activity={data.recentActivity} eventId={data.event.id} now={now} />
      <EventPreviewCard data={data} />
    </ShareDialogProvider>,
  );
}

describe("Event Dashboard", () => {
  it("1. muestra el nombre y la fecha del evento desde `Event`", () => {
    const data = demo();
    const text = visibleText(renderHeader(data.event, NOW));
    expect(text).toContain("Andrea & Fernando");
    expect(text).toContain("17 Mayo 2027");
    expect(renderHeader(data.event, NOW)).toContain(`dateTime="${data.event.startsAt}"`);

    const other = { ...data.event, title: "Sofía & Diego", startsAt: "2028-01-15T18:00:00-06:00" };
    const otherText = visibleText(renderHeader(other, NOW));
    expect(otherText).toContain("Sofía & Diego");
    expect(otherText).toContain("15 Enero 2028");
  });

  it("2. «Faltan X días» se calcula desde `event.startsAt` (no hay cifra escrita a mano)", () => {
    const data = demo();
    const days = (now: number) => /Faltan (\d+) días/.exec(visibleText(renderHeader(data.event, now)))?.[1];
    const a = Number(days(NOW));
    const b = Number(days(NOW + 10 * 86_400_000));
    expect(a).toBeGreaterThan(200);
    expect(a - b).toBe(10);

    const sooner = { ...data.event, startsAt: new Date(NOW + 3 * 86_400_000 + 3_600_000).toISOString() };
    expect(visibleText(renderHeader(sooner, NOW))).toContain("Faltan 3 días");
  });

  it("3. las tarjetas de RSVP muestran los valores de los datos del dashboard", () => {
    const data = demo();
    const html = renderToStaticMarkup(<RsvpSummary summary={data.rsvpSummary} eventId="demo" />);
    const { confirmed, pending, declined } = data.rsvpSummary;
    expect(visibleText(html)).toBe(`${confirmed} Confirmados ${pending} Pendientes ${declined} No asistirán`);
    expect([confirmed, pending, declined]).toEqual([2, 1, 1]);

    const changed = visibleText(renderToStaticMarkup(<RsvpSummary summary={{ confirmed: 5, pending: 6, declined: 7 }} eventId="demo" />));
    expect(changed).toBe("5 Confirmados 6 Pendientes 7 No asistirán");
  });

  it("4. «Editar invitación» lleva a /dashboard/events/[id]/edit del evento", () => {
    const data = demo();
    const html = renderPage(data);
    const hrefs = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*Editar invitación/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(hrefs)).toEqual(new Set([`/dashboard/events/${data.event.id}/edit`]));
  });

  it("5. el enlace de compartir sale del slug del evento", () => {
    const data = demo();
    const html = renderPage(data);
    // En pruebas (NODE_ENV=test) la base es localhost; en producción, https://hiloluna.com (tests/brand).
    expect(shareUrl(data.event.publicSlug)).toBe(`http://localhost:3000/i/${data.event.publicSlug}`);
    expect(html).toContain(displayShareUrl(data.event.publicSlug));

    const changed = renderPage({ ...data, event: { ...data.event, publicSlug: "sofia-y-diego" } });
    expect(changed).toContain("localhost:3000/i/sofia-y-diego");
    expect(changed).not.toContain(data.event.publicSlug);
  });

  it("6. la actividad reciente se dibuja desde el arreglo de datos", () => {
    const data = demo();
    const text = visibleText(renderToStaticMarkup(<RecentActivity activity={data.recentActivity} eventId="demo" now={NOW} />));
    expect(text).toContain("Mariana López confirmó asistencia");
    expect(text).toContain("Luis Hernández confirmó 3 invitados");
    expect(text).toContain("Carolina Méndez está revisando su invitación");
    expect(text).toContain("Javier Torres no asistirá");
    expect(text).toContain("Hace 2 horas");
    expect(text).toContain("Hace 1 día");

    const one = visibleText(renderToStaticMarkup(<RecentActivity activity={[{ id: "x", type: "rsvp_declined", actorName: "Ana Prueba", occurredAt: new Date(NOW - 7_200_000).toISOString() }]} eventId="demo" now={NOW} />));
    expect(one).toContain("Ana Prueba no asistirá");
    expect(one).not.toContain("Mariana");
  });

  it("7. ningún enlace visible del panel lleva a un 404", () => {
    const routePatterns = pagePatterns();
    const data = demo();
    const html = renderPage(data);
    const hrefs = new Set([
      ...[...html.matchAll(/href="([^"#]+)"/g)].map((m) => (m[1] as string).replace(/&amp;/g, "&")),
      ...getDashboardNav().map((item) => item.href),
    ]);
    const internal = [...hrefs].filter((href) => href.startsWith("/") && !href.startsWith("/_next"));
    expect(internal.length).toBeGreaterThan(6);

    for (const href of internal) {
      const path = href.split("?")[0] as string;
      const matches = routePatterns.some((pattern) => pattern.test(path));
      expect(matches, `${href} debe tener una página`).toBe(true);
      const invitation = /^\/i\/([^/]+)$/.exec(path);
      if (invitation) expect(getMockInvitation(invitation[1] as string), `${href} debe resolver una invitación`).toBeDefined();
    }
  });

  it("8. la dona no es la única representación de las confirmaciones", () => {
    const data = demo();
    const html = renderPage(data);
    const description = describeRsvpSummary(data.rsvpSummary);
    expect(description).toBe("2 confirmados, 1 pendiente y 1 no asistirá, de 4 invitados");
    // El gráfico lleva su equivalente textual…
    expect(renderToStaticMarkup(<RsvpDonut summary={data.rsvpSummary} />)).toContain(`aria-label="${description}"`);
    // …y las cifras existen como texto fuera del SVG (tarjetas y tarjeta de Confirmaciones).
    const withoutSvg = visibleText(html.replace(/<svg[\s\S]*?<\/svg>/g, ""));
    expect(withoutSvg).toContain("2 Confirmados");
    expect(withoutSvg).toContain("1 Pendientes");
    expect(withoutSvg).toContain(description);
  });

  it("los datos del panel no se mutan y las horas relativas parten de `now`", () => {
    const first = demo(NOW);
    const later = demo(NOW + 3_600_000);
    expect(first.recentActivity[0]?.occurredAt).not.toBe(later.recentActivity[0]?.occurredAt);
    expect(first.event.startsAt).toBe(later.event.startsAt);
  });
});

/** Patrones de ruta de `app/**\/page.tsx` (sin grupos de rutas; `[param]` → un segmento). */
function pagePatterns(): RegExp[] {
  const root = join(process.cwd(), "app");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === "page.tsx") files.push(path);
    }
  };
  walk(root);
  return files.map((file) => {
    const segments = relative(root, file)
      .split(sep)
      .slice(0, -1)
      .filter((segment) => !/^\(.*\)$/.test(segment))
      .map((segment) => (/^\[.*\]$/.test(segment) ? "[^/]+" : segment));
    return new RegExp(`^/${segments.join("/")}$`.replace(/^\/$/, "^/$").replace(/\$\$/, "$"));
  });
}
