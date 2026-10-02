import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/navigation";
import { RelatedTemplates } from "@/components/templates/related-templates";
import { TemplateCover } from "@/components/templates/template-cover";
import { TemplateFeatureList } from "@/components/templates/template-feature-list";
import { TemplatePreview } from "@/components/templates/template-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaSlot, SceneBlobs } from "@/components/ui/media-slot";
import { Heading, Text } from "@/components/ui/typography";
import { eventTypeLabels, styleLabels, templateDetailCopy } from "@/lib/content/templates";
import { routes } from "@/lib/routes";
import { getTemplateStyles } from "@/lib/templates/filter";
import { getTemplateCapabilities, getTemplateCoverImage } from "@/lib/templates/status";
import type { Template } from "@/types/templates";

type TemplateDetailProps = {
  template: Template;
  /** Plantillas para "Otros diseños que podrían gustarte" (ver `getRelatedTemplates`). */
  related?: readonly Template[];
};

/**
 * DETALLE DE PLANTILLA (mockup 03). Recibe un objeto `Template` y no conoce ninguna plantilla en
 * concreto: nombre, categorías, descripción, vista previa y funciones salen de sus datos. Qué se
 * muestra lo decide su `status` (`getTemplateCapabilities`):
 *  - `implemented`: teléfono con todas las pantallas y miniaturas, funciones incluidas, "Usar esta
 *    plantilla" y "Ver invitación completa".
 *  - `concept`: teléfono solo con la portada, sin miniaturas ni funciones (no se asume el resto del
 *    diseño), aviso de vista conceptual y sin enlace a la demo.
 *  - `comingSoon`: solo miniatura, nombre, categoría, estilo, descripción y "Próximamente", con el
 *    CTA deshabilitado. No se dibuja ninguna invitación.
 * Escritorio: escena a la izquierda; información a la derecha. Móvil: escena arriba y información debajo.
 * La escena usa la portada real de la plantilla (`getTemplateCoverImage`) cuando existe; `concept`/
 * `comingSoon` (sin portada aprobada todavía) siguen con el degradado de placeholder.
 * "Usar esta plantilla" y "Ver invitación completa" apuntan a rutas temporales (`lib/routes.ts`).
 */
export function TemplateDetail({ template, related = [] }: TemplateDetailProps) {
  const capabilities = getTemplateCapabilities(template);
  const meta = [eventTypeLabels[template.eventType], ...getTemplateStyles(template).map((style) => styleLabels[style])];
  const notice = capabilities.notice ? templateDetailCopy.status[capabilities.notice] : undefined;
  const cover = getTemplateCoverImage(template.slug);

  // Vista básica: solo la portada. Las demás pantallas no se muestran porque el diseño no está aprobado.
  const previewTemplate: Template =
    capabilities.preview === "basic"
      ? { ...template, preview: { ...template.preview, screens: template.preview.screens.slice(0, 1) } }
      : template;

  return (
    <>
      <section
        aria-labelledby="template-title"
        data-template-status={template.status}
        className="relative isolate -mt-(--lu-header-h) overflow-clip"
      >
        <MediaSlot
          src={cover?.src}
          alt=""
          priority={!!cover}
          sizes="(min-width: 1024px) 62vw, 100vw"
          imageClassName={cover?.position === "top" ? "object-top" : undefined}
          tone={template.thumbnail.tone}
          scene="petals"
          className="absolute inset-x-0 top-0 -z-10 h-[52rem] lu-fade-y lg:inset-y-0 lg:right-auto lg:left-0 lg:h-auto lg:w-[62%] lg:lu-fade-right-bottom"
        >
          {!cover ? <SceneBlobs scene="fabric" flip /> : null}
        </MediaSlot>

        <div className="lu-container grid grid-cols-[minmax(0,1fr)] gap-10 pt-[calc(var(--lu-header-h)+2rem)] pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start lg:gap-10 lg:pb-16 xl:grid-cols-[minmax(0,1fr)_34rem] xl:gap-16">
          {capabilities.preview === "none" ? (
            <div className="lu-enter flex justify-center lg:pt-6">
              <TemplateCover template={template} />
            </div>
          ) : (
            <TemplatePreview template={previewTemplate} className="lu-enter lg:pb-6" />
          )}

          <div className="lu-enter flex flex-col gap-6 lg:pt-4">
            <Breadcrumbs
              items={[
                { label: templateDetailCopy.breadcrumbRoot, href: routes.templates },
                { label: template.name },
              ]}
            />

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <Heading as="h1" id="template-title" size="display-xl" className="leading-[0.95]">
                  {template.name}
                </Heading>
                {capabilities.notice === "comingSoon" && notice ? (
                  <Badge tone="accent" size="md" dot className="mt-3">
                    {notice.badge}
                  </Badge>
                ) : null}
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-lu-display text-lu-h3 text-lu-text-secondary">
                {meta.map((item, index) => (
                  <li key={item} className="flex items-center gap-4">
                    {index > 0 ? (
                      <span aria-hidden="true" className="text-lu-text-subtle">
                        ·
                      </span>
                    ) : null}
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Text size="lg" tone="secondary" className="max-w-[34rem]">
              {template.description}
            </Text>

            {notice ? (
              <div id="template-status-note" data-status-notice={capabilities.notice} className="flex items-start gap-3 rounded-lu-button-lg border border-lu-border-subtle bg-lu-surface px-4 py-3.5">
                {capabilities.notice === "concept" ? (
                  <Badge tone="outline" size="md" dot className="shrink-0">
                    {notice.badge}
                  </Badge>
                ) : null}
                <Text size="sm" tone="muted">
                  {notice.note}
                </Text>
              </div>
            ) : null}

            <hr className="border-lu-divider" />

            {capabilities.showFeatures ? <TemplateFeatureList features={template.features} /> : null}

            <div className="flex flex-col gap-3">
              {capabilities.canUse ? (
                <Button asChild size="xl" font="serif" arrow fullWidth>
                  <Link href={routes.newEventFromTemplate(template.slug)}>{templateDetailCopy.useTemplate}</Link>
                </Button>
              ) : (
                <Button size="xl" font="serif" arrow fullWidth disabled aria-describedby="template-status-note">
                  {templateDetailCopy.useTemplate}
                </Button>
              )}
              {capabilities.demoHref ? (
                <Button asChild size="xl" font="serif" variant="secondary" external fullWidth>
                  <Link href={capabilities.demoHref} target="_blank" rel="noopener noreferrer">
                    {templateDetailCopy.viewDemo}
                    <span className="sr-only"> {templateDetailCopy.viewDemoHint}</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <RelatedTemplates templates={related} />
    </>
  );
}
