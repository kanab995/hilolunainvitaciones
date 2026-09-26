import type { ReactNode } from "react";

export type LayoutName = "marketing" | "auth" | "workspace" | "editor" | "invitation";

type LayoutFrameProps = {
  name: LayoutName;
  /** Cabecera del layout (fuera de <main>). */
  header?: ReactNode;
  /** Pie del layout (fuera de <main>). */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Estructura común de los layouts de grupo: contenedor de altura mínima de viewport,
 * cabecera opcional, <main> y pie opcional. Sin estilos visuales propios.
 */
export function LayoutFrame({ name, header, footer, children }: LayoutFrameProps) {
  return (
    <div data-layout={name} className="flex min-h-svh flex-col">
      {header}
      <main id="main" className="flex-1">
        {children}
      </main>
      {footer}
    </div>
  );
}
