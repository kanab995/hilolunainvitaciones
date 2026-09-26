import type { ReactNode } from "react";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * Contenido de una página de acceso: titular editorial (serif con una palabra en cursiva), texto de
 * apoyo y, debajo, el formulario oficial de Clerk (o el aviso de acceso no disponible). El formulario
 * de Clerk no se modifica por dentro: solo se enmarca y se le aplica `clerkAppearance`.
 */
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="lu-container flex flex-col items-center gap-8 pt-6 pb-20 md:gap-10 md:pt-12">
      <SectionHeading as="h1" size="title-xl" align="center" title={title} description={description} />
      <div className="flex w-full max-w-md justify-center">{children}</div>
    </div>
  );
}
