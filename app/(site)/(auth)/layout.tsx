import type { ReactNode } from "react";
import { LayoutFrame } from "@/components/layout/layout-frame";
import { Wordmark } from "@/components/layout/wordmark";
import { routes } from "@/lib/routes";

/** Marco de las páginas de acceso: marfil, con el wordmark de Hilo Luna arriba y el formulario centrado. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <LayoutFrame
      name="auth"
      header={
        <header className="lu-container flex h-20 items-center">
          <Wordmark href={routes.home} />
        </header>
      }
    >
      {children}
    </LayoutFrame>
  );
}
