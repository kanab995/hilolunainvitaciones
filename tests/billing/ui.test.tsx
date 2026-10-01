import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BillingOverviewCard } from "@/components/billing/billing-overview";
import { PaymentStatus } from "@/components/billing/payment-status";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { UpgradeEventDialog } from "@/components/billing/upgrade-event-dialog";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { GuestManager } from "@/components/guests/guest-manager";
import { billingCopy } from "@/lib/billing/copy";
import { planRows } from "@/lib/billing/plan-summary";
import { mainNav } from "@/lib/content/navigation";
import { EMPTY_FILTERS } from "@/lib/guests/filter";
import { routes } from "@/lib/routes";
import type { BillingEventRow, BillingOverview, EventPlanOption } from "@/server/services/billing-service";
import type { GuestRow } from "@/types/guests";
import { visibleText } from "../invitation/helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/billing", redirect: vi.fn(), notFound: vi.fn() }));
/** Radix pinta el diálogo en un portal (no existe al renderizar en servidor): contenedores planos para inspeccionar su contenido. */
vi.mock("@/components/ui/dialog", () => {
  const box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Dialog: box, DialogTrigger: box, DialogContent: box, DialogHeader: box, DialogTitle: box, DialogDescription: box, DialogFooter: box, DialogClose: box };
});

const ROOT = process.cwd();
const templates = [{ minimumPlan: "FREE" as const }];
const pricing = (signedIn: boolean) => renderToStaticMarkup(<PricingPlans signedIn={signedIn} templates={templates} />);
const card = (html: string, plan: string) => (html.split("<article").find((chunk) => chunk.includes(`data-plan="${plan}"`)) ?? "").split("</article>")[0] ?? "";

describe("/pricing: un pago único por evento (36–38, 81)", () => {
  it("(36/38) tarjetas Gratis, Esencial y Premium con su precio: $0 MXN, $499 MXN y $799 MXN, y «Pago único por evento» en los de pago", () => {
    const html = pricing(false);
    expect([...html.matchAll(/<h2[^>]*id="plan-(\w+)"[^>]*>([^<]+)<\/h2>/g)].map((match) => match[2])).toEqual(["Gratis", "Esencial", "Premium"]);
    expect([...html.matchAll(/data-plan-price[^>]*>([^<]+)</g)].map((match) => match[1])).toEqual(["$0 MXN", "$499 MXN", "$799 MXN"]);
    for (const plan of ["ESSENTIAL", "PREMIUM"]) expect(visibleText(card(html, plan))).toContain("Pago único por evento");
    expect(visibleText(card(html, "FREE"))).not.toContain("Pago único");
  });

  it("(81/36) el encabezado y la explicación son los del nuevo modelo", () => {
    expect(billingCopy.pricing.title).toBe("Una invitación para tu gran día. Un solo pago.");
    expect(billingCopy.pricing.subtitle).toBe("Paga una sola vez por tu evento.");
    expect(billingCopy.pricing.description).toBe("Sin mensualidades. Elige el plan ideal para tu evento y disfruta de Hilo Luna hasta 30 días después de tu celebración.");
    expect(visibleText(pricing(false))).toContain("Tu invitación permanecerá disponible hasta 30 días después del evento.");
  });

  it("(4) las filas muestran los límites POR EVENTO (30/100/300 invitados; 5/15/40 imágenes) y ningún límite de eventos", () => {
    const text = visibleText(pricing(false));
    for (const expected of ["Hasta 30 invitados", "Hasta 100 invitados", "Hasta 300 invitados", "Galería de hasta 5 imágenes", "Galería de hasta 15 imágenes", "Galería de hasta 40 imágenes", "Enlaces personalizados para cada invitado", "Código QR de tu invitación", "Agregar al calendario"]) expect(text, expected).toContain(expected);
    expect(text).not.toMatch(/Eventos sin límite|\b\d+ eventos?\b/);
    expect(planRows("PREMIUM", 1).map((row) => row.id)).not.toContain("events");
  });

  it("(67/68/69) /pricing nunca cobra: sin sesión → registro y luego crear el evento con la intención de plan; con sesión → crear el evento con el plan", () => {
    const anonymous = pricing(false);
    expect(card(anonymous, "FREE")).toContain('href="/sign-up?redirect_url=%2Fdashboard%2Fevents%2Fnew"');
    expect(card(anonymous, "ESSENTIAL")).toContain('href="/sign-up?redirect_url=%2Fdashboard%2Fevents%2Fnew%3Fplan%3Dessential"');
    expect(card(anonymous, "PREMIUM")).toContain('href="/sign-up?redirect_url=%2Fdashboard%2Fevents%2Fnew%3Fplan%3Dpremium"');
    expect(visibleText(card(anonymous, "PREMIUM"))).toContain("Elegir Premium");
    expect(visibleText(card(anonymous, "FREE"))).toContain("Comenzar gratis");
    const signedIn = pricing(true);
    expect(card(signedIn, "ESSENTIAL")).toContain('href="/dashboard/events/new?plan=essential"');
    expect(card(signedIn, "PREMIUM")).toContain('href="/dashboard/events/new?plan=premium"');
    // Ningún formulario de pago ni identificadores de cobro en la página de precios.
    for (const html of [anonymous, signedIn]) expect(html).not.toMatch(/<form|name="plan"|name="eventId"|price_|priceId/);
  });

  it("(58/37) el menú de marketing enlaza a /pricing", () => {
    expect(routes.pricing).toBe("/pricing");
    expect(mainNav.some((item) => item.href === routes.pricing)).toBe(true);
  });
});

const option = (over: Partial<EventPlanOption> & Pick<EventPlanOption, "plan">): EventPlanOption => ({ state: "available", kind: "INITIAL", amount: 499, ...over });
const dialog = (props: Partial<Parameters<typeof UpgradeEventDialog>[0]> = {}) =>
  renderToStaticMarkup(
    <UpgradeEventDialog
      eventId="evt_A"
      title="Andrea & Fernando"
      plan="FREE"
      options={[option({ plan: "ESSENTIAL" }), option({ plan: "PREMIUM", amount: 799 })]}
      paymentsReady
      {...props}
    />,
  );

describe("Panel «Mejorar evento» (66, 40)", () => {
  it("(66) en un evento Gratis ofrece Esencial $499 MXN y Premium $799 MXN, cada uno como formulario de pago", () => {
    const html = dialog();
    const text = visibleText(html);
    expect(text).toContain("Mejorar evento");
    expect(text).toContain("Es un pago único, sin mensualidades.");
    expect(text).toContain("Pagar $499 MXN");
    expect(text).toContain("Pagar $799 MXN");
    expect(text).toContain("Tu invitación permanecerá disponible hasta 30 días después del evento.");
    expect(html).toContain("Plan actual"); // Gratis es el plan actual
  });

  it("(18/21) cada botón envía SOLO el id del evento y el plan: ni precios, ni cliente, ni usuario", () => {
    const html = dialog();
    expect([...html.matchAll(/<input type="hidden" name="(\w+)" value="([^"]+)"\/>/g)].map((match) => `${match[1]}=${match[2]}`)).toEqual(["eventId=evt_A", "plan=ESSENTIAL", "eventId=evt_A", "plan=PREMIUM"]);
    expect(html).not.toMatch(/price_|priceId|amount"|customer|userId/i);
  });

  it("(15/52) con Esencial pagada, Premium es una MEJORA de $300 MXN con la nota de que solo se paga la diferencia", () => {
    const html = dialog({ plan: "ESSENTIAL", options: [option({ plan: "ESSENTIAL", state: "current", kind: null, amount: null }), option({ plan: "PREMIUM", kind: "UPGRADE", amount: 300 })] });
    const text = visibleText(html);
    expect(text).toContain("Mejorar por $300 MXN");
    expect(text).toContain("Solo pagas la diferencia con lo que ya compraste.");
    expect(text).not.toContain("Pagar $799 MXN");
    expect(html).not.toContain('value="ESSENTIAL"'); // el plan que ya tiene no se vuelve a vender
  });

  it("con el plan más completo no hay nada que comprar: el botón «Mejorar evento» no aparece", () => {
    expect(dialog({ plan: "PREMIUM", options: [option({ plan: "ESSENTIAL", state: "included", kind: null, amount: null }), option({ plan: "PREMIUM", state: "current", kind: null, amount: null })] })).toBe("");
  });

  it("(68) sin pagos configurados los botones se deshabilitan y se explica por qué", () => {
    const html = dialog({ paymentsReady: false });
    expect(visibleText(html)).toContain("Los pagos todavía no están configurados en este entorno.");
    expect(html).not.toContain('name="plan"');
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*aria-describedby="payments-note-evt_A"/);
  });

  it("(69) la intención de plan destaca el plan elegido (sin cobrar nada por sí sola)", () => {
    expect(dialog({ highlight: "premium" })).toMatch(/data-plan-option="PREMIUM" class="[^"]*border-lu-brown-600/);
  });
});

const row = (over: Partial<BillingEventRow> = {}): BillingEventRow => ({
  eventId: "evt_A",
  slug: "andrea",
  title: "Andrea & Fernando",
  startsAt: new Date("2027-05-17T23:00:00Z"),
  plan: "FREE",
  accessState: "free",
  paidAccessEndsAt: null,
  guests: { count: 24, max: 30 },
  gallery: { count: 4, max: 5 },
  purchases: [],
  canUpgrade: true,
  ...over,
});
const overview = (events: BillingEventRow[], payments: BillingOverview["payments"] = "ready"): BillingOverview => ({ events, payments });

describe("/dashboard/billing → «Compras y planes» (39, 47, 56, 71)", () => {
  it("(39/71) por evento: título, plan, uso «24 / 30» y «4 / 5», y «Mejorar evento»; sin contador de eventos", () => {
    const html = renderToStaticMarkup(<BillingOverviewCard overview={overview([row()])} />);
    const text = visibleText(html);
    expect(text).toContain("Andrea & Fernando");
    expect(text).toContain("Plan Gratis");
    expect(text).toContain("24 / 30");
    expect(text).toContain("4 / 5");
    expect(text).toContain("Mejorar evento");
    expect(html).toContain('href="/dashboard/events/evt_A?upgrade=1"');
    expect(text).not.toMatch(/Eventos\s+\d+ \/|1 \/ 1/);
    expect(text).not.toContain("Administrar suscripción");
  });

  it("(39/56) un evento Premium pagado: «Plan Premium · Pagado», «Disponible hasta 16 de junio de 2027» y su historial de pagos", () => {
    const text = visibleText(
      renderToStaticMarkup(
        <BillingOverviewCard
          overview={overview([
            row({
              plan: "PREMIUM",
              accessState: "active",
              paidAccessEndsAt: new Date("2027-06-16T23:00:00Z"),
              guests: { count: 24, max: 300 },
              gallery: { count: 4, max: 40 },
              purchases: [
                { id: "p1", plan: "ESSENTIAL", kind: "INITIAL", status: "PAID", amount: 49900, currency: "MXN", paidAt: new Date("2027-01-10T00:00:00Z") },
                { id: "p2", plan: "PREMIUM", kind: "UPGRADE", status: "PAID", amount: 30000, currency: "MXN", paidAt: new Date("2027-02-10T00:00:00Z") },
              ],
              canUpgrade: false,
            }),
          ])}
        />,
      ),
    );
    expect(text).toContain("Plan Premium · Pagado");
    expect(text).toContain("Disponible hasta 16 de junio de 2027");
    expect(text).toContain("24 / 300");
    expect(text).toContain("Esencial · $499 MXN");
    expect(text).toContain("Premium · $300 MXN · Mejora");
    expect(text).not.toContain("Mejorar evento");
  });

  it("(39) dos eventos del mismo usuario con planes distintos se muestran cada uno con SU plan", () => {
    const html = renderToStaticMarkup(<BillingOverviewCard overview={overview([row({ eventId: "evt_A", title: "Andrea", plan: "PREMIUM", canUpgrade: false }), row({ eventId: "evt_B", title: "Cumpleaños", plan: "FREE" })])} />);
    expect(html).toMatch(/data-billing-event="evt_A"[^>]*data-plan="PREMIUM"/);
    expect(html).toMatch(/data-billing-event="evt_B"[^>]*data-plan="FREE"/);
  });

  it("(57) el acceso vencido se informa con calma y no se borra nada; un reembolso aparece en el historial como «Reembolsado»", () => {
    const text = visibleText(
      renderToStaticMarkup(<BillingOverviewCard overview={overview([row({ plan: "ESSENTIAL", accessState: "expired", paidAccessEndsAt: new Date("2027-06-16T23:00:00Z"), purchases: [{ id: "p1", plan: "PREMIUM", kind: "INITIAL", status: "REFUNDED", amount: 79900, currency: "MXN", paidAt: new Date("2027-01-10T00:00:00Z") }] })])} />),
    );
    expect(text).toContain("El acceso terminó el 16 de junio de 2027");
    expect(text).toContain("Reembolsado");
    expect(text).not.toMatch(/eliminad|borrad|perder/i);
  });

  it("(46/79) sobre el límite del evento se ve todo el uso («80 / 30») con la nota de que se conserva y solo no se puede añadir", () => {
    const html = renderToStaticMarkup(<BillingOverviewCard overview={overview([row({ guests: { count: 80, max: 30 } })])} />);
    expect(visibleText(html)).toContain("80 / 30");
    expect(html).toContain("data-over-limit");
    expect(visibleText(html)).toContain("Todo se conserva; solo no podrás añadir más hasta mejorarlo.");
  });

  it("sin eventos: invita a crear uno; sin pagos configurados lo dice claramente", () => {
    const empty = renderToStaticMarkup(<BillingOverviewCard overview={overview([])} />);
    expect(visibleText(empty)).toContain("Todavía no tienes eventos.");
    expect(empty).toContain(`href="${routes.newEvent}"`);
    expect(visibleText(renderToStaticMarkup(<BillingOverviewCard overview={overview([row()], "not_configured")} />))).toContain("Los pagos todavía no están configurados en este entorno.");
  });

  it("(41/43) no hay «Administrar suscripción», cancelación ni portal como gestión del plan", () => {
    for (const file of ["components/billing/billing-overview.tsx", "components/billing/upgrade-event-dialog.tsx", "components/billing/pricing-plans.tsx", "components/billing/billing-forms.tsx", "app/(site)/dashboard/(workspace)/billing/page.tsx"]) {
      expect(readFileSync(join(ROOT, file), "utf8"), file).not.toMatch(/Administrar suscripci|cancelar suscripci|PortalForm|openBillingPortal/i);
    }
  });
});

describe("Regreso del pago y avisos (20, 21, 46, 63)", () => {
  it("(20) «Estamos confirmando tu pago…» con «Actualizar» mientras no haya confirmación; «confirmado» cuando ya; «canceló» sin cambios", () => {
    const confirming = renderToStaticMarkup(<PaymentStatus state="confirming" />);
    expect(visibleText(confirming)).toContain("Estamos confirmando tu pago…");
    expect(visibleText(confirming)).toContain("Actualizar");
    expect(confirming).toContain('role="status"');
    expect(visibleText(renderToStaticMarkup(<PaymentStatus state="confirmed" />))).toContain("Tu pago se confirmó. Tu evento ya tiene su nuevo plan.");
    const canceled = renderToStaticMarkup(<PaymentStatus state="canceled" />);
    expect(visibleText(canceled)).toContain("Cancelaste el pago; no se hizo ningún cargo y tu plan no cambió.");
    expect(visibleText(canceled)).not.toContain("Actualizar");
  });

  it("(20) el dashboard decide «confirmando» con el estado del SERVIDOR (compra pendiente), nunca solo con ?payment=success", () => {
    const page = readFileSync(join(ROOT, "app/(site)/dashboard/(workspace)/events/[id]/page.tsx"), "utf8");
    expect(page).toMatch(/payment === "success" && billing \? \(billing\.pendingPayment \? "confirming" : "confirmed"\)/);
  });

  it("(46/33) el aviso de mejora con evento lleva a «Mejorar evento» de ESE evento; sin evento, a «Ver planes»", () => {
    const withEvent = renderToStaticMarkup(<UpgradePrompt message="Has alcanzado el límite de invitados de este evento." eventId="evt_A" />);
    expect(visibleText(withEvent)).toContain("Mejora tu evento");
    expect(visibleText(withEvent)).toContain("Tus invitados, imágenes y respuestas actuales se conservan siempre.");
    expect(withEvent).toMatch(/href="\/dashboard\/events\/evt_A\?upgrade=1"[^>]*>Mejorar evento</);
    const noEvent = renderToStaticMarkup(<UpgradePrompt message="Esta plantilla requiere Premium para este evento." />);
    expect(noEvent).toMatch(/href="\/pricing"[^>]*>Ver planes</);
    expect(withEvent).toContain('role="alert"');
  });

  it("el Guest Manager de un evento con el cupo lleno deshabilita «Agregar» y ofrece «Mejorar evento» de ese evento", () => {
    const guest = { id: "g1", name: "Ana", groupName: null, status: "pending", statusLabel: "Pendiente", inviteUrl: "http://x/i/s?guest=t", email: null, phone: null, maxCompanions: 0, groupId: null, attendeeCount: null } as unknown as GuestRow;
    const render = (guestLimit: { count: number; max: number | null }) => renderToStaticMarkup(<GuestManager eventId="evt_A" guests={[guest]} totalCount={guestLimit.count} groups={[]} filters={EMPTY_FILTERS} publication={{ slug: "s", state: "draft" }} guestLimit={guestLimit} />);
    const full = render({ count: 30, max: 30 });
    expect(visibleText(full)).toContain("Has alcanzado el límite de invitados de este evento.");
    expect(full).toContain('href="/dashboard/events/evt_A?upgrade=1"');
    expect(full).toMatch(/<button[^>]*\sdisabled=""[^>]*>[\s\S]*?Agregar invitado/);
    const free = render({ count: 10, max: 30 });
    expect(visibleText(free)).not.toContain("Has alcanzado el límite");
    expect(free).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>[\s\S]*?Agregar invitado/);
  });
});

describe("Auditoría de copy: ya no hay modelo mensual ni suscripciones (37, 80)", () => {
  const walk = (path: string): string[] => (statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => walk(join(path, name))) : /\.(ts|tsx)$/.test(path) ? [path] : []);
  const files = ["app", "components", "lib"].flatMap((dir) => walk(join(ROOT, dir)));

  it("ningún texto de la interfaz habla de «/mes», «al mes», «mensual», «renovación» ni «suscripción»", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // «mensualidades»/«renovación mensual» solo aparecen negadas («Sin mensualidades», «No existe renovación mensual automática»: el aviso legal (D-37) aclara justamente que no hay suscripción).
      expect(source.replace(/[Ss]in mensualidades|No existe renovaci[óo]n mensual autom[áa]tica/g, ""), relative(ROOT, file)).not.toMatch(/\/mes\b|al mes|mensual|renovaci|suscripci|cancelAtPeriodEnd|past_due|PAST_DUE|TRIALING/);
    }
  });

  it("el menú de cuenta dice «Compras y planes» (no «Plan y facturación») y no muestra un plan de cuenta", () => {
    expect(billingCopy.menu.billing).toBe("Compras y planes");
    expect(billingCopy.billing.title).toBe("Compras y planes");
    const menu = readFileSync(join(ROOT, "components/dashboard/user-menu.tsx"), "utf8");
    expect(menu).toContain("billingCopy.menu.billing");
    expect(menu).not.toMatch(/planName|Plan \{/);
  });

  it("el dashboard del evento muestra «Plan Gratis|Esencial|Premium» de ESE evento y el botón «Mejorar evento»", () => {
    const page = readFileSync(join(ROOT, "app/(site)/dashboard/(workspace)/events/[id]/page.tsx"), "utf8");
    expect(page).toContain("data-event-plan={billing.plan}");
    expect(page).toContain("Plan {planLabel(billing.plan)}");
    expect(page).toContain("<UpgradeEventDialog");
  });
});
