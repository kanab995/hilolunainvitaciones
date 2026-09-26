import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { routes } from "@/lib/routes";
import type { AuthMode } from "@/server/auth/mode";

/**
 * Se muestra en lugar del formulario cuando Clerk no está configurado (faltan las claves). En
 * desarrollo explica qué hacer; en cualquier otro entorno, un mensaje neutro (sin detalles de infraestructura).
 */
export function AuthUnavailable({ mode }: { mode: AuthMode }) {
  return (
    <div role="status" className="flex w-full flex-col items-start gap-4 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-6 shadow-lu-card">
      {mode === "demo" ? (
        <>
          <Text size="base" tone="default">
            Modo demostración de desarrollo: no hay claves de Clerk, así que el panel se abre con el usuario demo y no hace falta iniciar sesión.
          </Text>
          <Text size="sm" tone="muted">
            Para probar el acceso real, define NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY y CLERK_SECRET_KEY en tu archivo .env.
          </Text>
          <Button asChild>
            <Link href={routes.events}>Ir a mi panel</Link>
          </Button>
        </>
      ) : (
        <>
          <Text size="base" tone="default">
            El acceso no está disponible por ahora. Inténtalo de nuevo más tarde.
          </Text>
          <Button asChild variant="secondary">
            <Link href={routes.home}>Volver al inicio</Link>
          </Button>
        </>
      )}
    </div>
  );
}
