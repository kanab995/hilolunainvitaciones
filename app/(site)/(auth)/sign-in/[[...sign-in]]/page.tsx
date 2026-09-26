import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthUnavailable } from "@/components/auth/auth-unavailable";
import { routes } from "@/lib/routes";
import { getAuthMode } from "@/server/auth/mode";

export const metadata: Metadata = { title: "Iniciar sesión" };

/** Inicio de sesión: el componente oficial de Clerk dentro del marco de Hilo Luna. Pública. */
export default function SignInPage() {
  const mode = getAuthMode();
  return (
    <AuthShell title="Bienvenido *de nuevo*" description="Continúa creando momentos inolvidables.">
      {mode === "clerk" ? <SignIn path={routes.signIn} signUpUrl={routes.signUp} /> : <AuthUnavailable mode={mode} />}
    </AuthShell>
  );
}
