import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { routes } from "@/lib/routes";

/** Plantilla inexistente (o no publicada): mensaje claro dentro del marco de marketing. */
export default function TemplateNotFound() {
  return (
    <div className="lu-container flex flex-col items-center gap-5 py-24 text-center">
      <Heading as="h1" size="display-sm">
        Plantilla no encontrada
      </Heading>
      <Text size="md" className="max-w-md">
        No encontramos esta plantilla. Puede que ya no esté disponible.
      </Text>
      <Button asChild size="lg" arrow>
        <Link href={routes.templates}>Ver todas las plantillas</Link>
      </Button>
    </div>
  );
}
