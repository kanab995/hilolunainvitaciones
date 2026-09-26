import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateDetail } from "@/components/templates/template-detail";
import { getRelatedTemplates } from "@/lib/templates/related";
import { getTemplateBySlug, getTemplates } from "@/server/repositories/templates";

/** Una página estática por plantilla del catálogo; un `slug` desconocido responde con el 404 del producto. */
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getTemplates()).map((template) => ({ slug: template.slug }));
}

export async function generateMetadata(props: PageProps<"/templates/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const template = await getTemplateBySlug(slug);
  if (!template) return {};
  return {
    title: `Plantilla ${template.name}`,
    description: template.description,
  };
}

/** Detalle de plantilla (mockup 03). Una sola página: el `slug` elige el objeto `Template` que se muestra. */
export default async function TemplateDetailPage(props: PageProps<"/templates/[slug]">) {
  const { slug } = await props.params;
  const template = await getTemplateBySlug(slug);
  if (!template) notFound();

  return <TemplateDetail template={template} related={getRelatedTemplates(template, await getTemplates())} />;
}
