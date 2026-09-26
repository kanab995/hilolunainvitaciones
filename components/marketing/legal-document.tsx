import { Card } from "@/components/ui/card";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import { LEGAL_DRAFT_EXPLANATION, LEGAL_DRAFT_NOTICE, type LegalDocument } from "@/lib/content/legal";

/**
 * Documento legal (borrador). Sin mockup: composición mínima con los componentes existentes (tipografía y tarjeta tintada). El aviso
 * «DRAFT — requiere revisión legal antes de lanzamiento» es SIEMPRE visible mientras no haya texto aprobado (un test lo exige).
 */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <article aria-labelledby={`${document.slug}-title`} data-legal={document.slug} className="lu-container flex max-w-3xl flex-col gap-8 pt-10 pb-20 lg:pt-14">
      <header className="flex flex-col gap-3">
        <Eyebrow>Legal</Eyebrow>
        <Heading as="h1" id={`${document.slug}-title`} size="display-md">
          {document.title}
        </Heading>
        <Text size="md">{document.description}</Text>
        <Text size="sm" tone="muted">
          Última actualización: {document.updated}
        </Text>
      </header>

      <Card variant="tint" role="note" data-legal-draft className="flex flex-col gap-1.5">
        <p className="text-lu-base font-medium text-lu-text">{LEGAL_DRAFT_NOTICE}</p>
        <Text size="sm">{LEGAL_DRAFT_EXPLANATION}</Text>
      </Card>

      <div className="flex flex-col gap-8">
        {document.sections.map((section) => (
          <section key={section.id} aria-labelledby={`${document.slug}-${section.id}`} className="flex flex-col gap-2.5">
            <Heading as="h2" id={`${document.slug}-${section.id}`} size="title-lg">
              {section.title}
            </Heading>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} size="base">
                {paragraph}
              </Text>
            ))}
            {section.items ? (
              <ul className="ml-5 flex list-disc flex-col gap-1.5 text-lu-base text-lu-text-secondary">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
