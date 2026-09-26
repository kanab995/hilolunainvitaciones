"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { routes } from "@/lib/routes";

/** Límite de error de la consola: mensaje genérico, sin trazas ni detalles internos. */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
      <Heading as="h1" size="display-sm">
        No pudimos cargar la consola
      </Heading>
      <Text size="md">Inténtalo de nuevo en unos instantes.</Text>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <Button asChild variant="secondary">
          <Link href={routes.home}>Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
