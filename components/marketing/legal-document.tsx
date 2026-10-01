import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import type { LegalBlock, LegalDocument } from "@/lib/content/legal";

function LegalBlocks({ blocks }: { blocks: readonly LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.type === "list" ? (
          <ul key={index} className="ml-5 flex list-disc flex-col gap-1.5 text-lu-base text-lu-text-secondary">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <Text key={index} size="base">
            {block.text}
          </Text>
        ),
      )}
    </>
  );
}

/** Documento legal (texto aprobado). Sin mockup: composición mínima con los componentes existentes (tipografía). */
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

      {document.intro ? (
        <div className="flex flex-col gap-2.5">
          <LegalBlocks blocks={document.intro} />
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        {document.sections.map((section) => (
          <section key={section.id} aria-labelledby={`${document.slug}-${section.id}`} className="flex flex-col gap-2.5">
            <Heading as="h2" id={`${document.slug}-${section.id}`} size="title-lg">
              {section.title}
            </Heading>
            <LegalBlocks blocks={section.blocks} />
          </section>
        ))}
      </div>
    </article>
  );
}
