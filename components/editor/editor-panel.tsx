"use client";

import { ArrowLeft } from "lucide-react";
import { EditorErrorBoundary } from "@/components/editor/editor-error-boundary";
import { sectionEditors } from "@/components/editor/section-editors/registry";
import { Button } from "@/components/ui/button";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import type { EditorRow } from "@/lib/editor/rows";
import type { InvitationSection } from "@/types/invitation";

/**
 * PANEL CENTRAL (mockup 04): "EDITANDO SECCIÓN" · título · descripción y el formulario de la fila
 * elegida. El formulario sale del registro de editores (`sectionEditors`); aquí no hay un `if` por
 * tipo. Un fallo de un formulario queda aislado en `EditorErrorBoundary`.
 */
export function EditorPanel({
  row,
  section,
  onBack,
}: {
  row: EditorRow;
  section: InvitationSection | undefined;
  /** Solo móvil: volver a la lista de secciones. */
  onBack: () => void;
}) {
  const Editor = sectionEditors[row.type];

  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-5 px-4 pt-4 pb-6 md:gap-6 md:px-8 md:py-10">
      <Button variant="ghost" size="sm" className="-ml-2 self-start md:hidden" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Secciones
      </Button>

      <header className="flex flex-col gap-1.5 md:gap-2">
        <Eyebrow>Editando sección</Eyebrow>
        <Heading as="h1" size="title-xl">
          {row.label}
        </Heading>
        <Text size="lg" className="max-w-(--lu-prose-max) max-md:text-lu-md">
          {row.description}
        </Text>
      </header>

      <div className="@container rounded-lu-card border border-lu-border-subtle bg-lu-surface p-4 md:p-7">
        <EditorErrorBoundary resetKey={row.id}>
          <Editor section={section} />
        </EditorErrorBoundary>
      </div>
    </div>
  );
}
