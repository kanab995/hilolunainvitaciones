import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { CreateEventWizard, type WizardTemplate } from "@/components/onboarding/create-event-wizard";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { onboardingCopy } from "@/lib/events/copy";
import { isPaidPlanId } from "@/lib/billing/plans";
import { getInvitationTemplate } from "@/lib/invitation/templates";
import { routes } from "@/lib/routes";
import { isTemplateReady } from "@/lib/templates/status";
import { getTemplates } from "@/server/repositories/templates";

export const metadata: Metadata = { title: "Crear invitación" };

/** Lee sesión y catálogo de la base de datos: nunca se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * Alta de un evento (D-28). Acepta `?template=<slug>` (destino de «Usar esta plantilla»). La plantilla se
 * resuelve SIEMPRE desde la base de datos: un slug desconocido muestra el selector (nunca un error), y una
 * plantilla que no está lista (`concept` / `comingSoon`) no permite crear nada. El asistente vive en el
 * cliente; solo su envío final escribe (Server Action `createEventAction`).
 */
export default async function NewEventPage(props: PageProps<"/dashboard/events/new">) {
  const { template: templateParam, plan: planParam } = await props.searchParams;
  // Intención de plan de `/pricing` (`?plan=essential|premium`): se valida y se conserva hasta crear el evento.
  const planIntent = typeof planParam === "string" && isPaidPlanId(planParam.toUpperCase()) ? planParam.toLowerCase() : undefined;
  const requested = typeof templateParam === "string" ? templateParam : undefined;

  const catalog = await getTemplates();
  const usable: WizardTemplate[] = catalog
    .filter(isTemplateReady)
    .map((template) => {
      // La miniatura sale del registro de plantillas del motor (imagen aprobada de la portada), no de la BD.
      const backdrop = getInvitationTemplate(template.slug)?.decor.heroBackdrop;
      return { slug: template.slug, name: template.name, eventType: template.eventType, thumbSrc: backdrop?.kind === "image" ? backdrop.src : undefined };
    });

  const match = requested ? catalog.find((template) => template.slug === requested) : undefined;

  if (match && match.status !== "implemented") {
    return (
      <DashboardPlaceholder title={onboardingCopy.title} description={onboardingCopy.description}>
        <section aria-labelledby="template-unavailable" className="flex flex-col items-start gap-4 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-6 shadow-lu-card md:p-8">
          <Heading as="h2" id="template-unavailable" size="title-lg">
            {onboardingCopy.unavailable.heading}
          </Heading>
          <Text size="base" className="max-w-prose">
            {onboardingCopy.unavailable.description}
          </Text>
          <Button asChild size="lg" arrow>
            <Link href={routes.templates}>{onboardingCopy.type.seeTemplates}</Link>
          </Button>
        </section>
      </DashboardPlaceholder>
    );
  }

  const initialTemplate = match && usable.some((template) => template.slug === match.slug) ? match.slug : undefined;
  const notice = requested && !match ? onboardingCopy.type.templateNotice.unknown : undefined;

  return (
    <DashboardPlaceholder title={onboardingCopy.title} description={onboardingCopy.description}>
      <CreateEventWizard templates={usable} initialTemplate={initialTemplate} notice={notice} planIntent={planIntent} />
    </DashboardPlaceholder>
  );
}
