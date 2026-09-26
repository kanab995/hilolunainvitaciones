import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { routes } from "@/lib/routes";

/** Evento o invitación inexistente en el editor. */
export default function EditorNotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <Heading as="h1" size="display-sm">
        Invitación no encontrada
      </Heading>
      <Text size="md" className="max-w-md">
        No encontramos la invitación de este evento. Puede que el enlace haya cambiado o que ya no exista.
      </Text>
      <Button asChild variant="secondary">
        <Link href={routes.events}>Volver a Mis eventos</Link>
      </Button>
    </div>
  );
}
