import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";

/**
 * Aviso discreto de una sección SIN contenido suficiente, solo en la vista previa del editor (`editing`).
 * La invitación pública nunca lo muestra: allí la sección simplemente no se dibuja hasta tener contenido.
 */
export function EditorPlaceholder({ message, ...shell }: Pick<SectionProps, "section" | "template" | "index"> & { message: string }) {
  return (
    <SectionShell {...shell} contentClassName="py-6">
      <p data-editor-placeholder className="mx-auto max-w-[20rem] rounded-(--inv-radius-card) border border-dashed border-inv-line px-4 py-5 text-center font-inv-body text-xs text-inv-ink-muted">
        {message}
      </p>
    </SectionShell>
  );
}
