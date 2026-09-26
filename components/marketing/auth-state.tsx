"use client";

import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";
import type { AuthNavState } from "@/lib/content/navigation";

/**
 * Entrega a la navbar pública el estado de la sesión. Las páginas públicas son estáticas (ISR): no leen
 * la sesión en el servidor, la resuelve Clerk en el cliente. Mientras carga, el estado es `loading` (la
 * navbar reserva el espacio y no muestra un enlace equivocado). Sin Clerk (`enabled = false`) siempre
 * es `signed-out`. `enabled` es constante durante la vida de la página, por eso el hook no es condicional.
 */
export function AuthStateBoundary({ enabled, children }: { enabled: boolean; children: (state: AuthNavState) => ReactNode }) {
  return enabled ? <ClerkAuthState>{children}</ClerkAuthState> : children("signed-out");
}

function ClerkAuthState({ children }: { children: (state: AuthNavState) => ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  return children(!isLoaded ? "loading" : isSignedIn ? "signed-in" : "signed-out");
}
