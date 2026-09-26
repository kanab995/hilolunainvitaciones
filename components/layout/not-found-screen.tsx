import Link from "next/link";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { routes } from "@/lib/routes";

/**
 * Pantalla 404 del producto. Sin mockup: se compone únicamente con piezas del sistema de diseño
 * (wordmark, eyebrow, titular serif con palabra en cursiva, botones primario y secundario).
 * Las invitaciones tienen su propia versión (app/(invitation)/not-found.tsx, regla 7).
 */
export function NotFoundScreen() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="lu-container flex h-20 items-center">
        <Wordmark href={routes.home} />
      </header>
      <main id="main" className="lu-container flex flex-1 items-center justify-center pb-24">
        <div className="flex flex-col items-center gap-10 text-center">
          <SectionHeading
            as="h1"
            size="display-md"
            align="center"
            spacing="normal"
            eyebrow="Error 404"
            title="Esta página *no existe*"
            description="Puede que el enlace haya cambiado o que la invitación ya no esté disponible."
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" arrow>
              <Link href={routes.home}>Volver al inicio</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={routes.templates}>Ver plantillas</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
