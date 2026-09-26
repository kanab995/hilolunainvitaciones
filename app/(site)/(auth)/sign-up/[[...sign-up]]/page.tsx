import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthUnavailable } from "@/components/auth/auth-unavailable";
import { routes } from "@/lib/routes";
import { getAuthMode } from "@/server/auth/mode";

export const metadata: Metadata = { title: "Crear cuenta" };

/** Registro: el componente oficial de Clerk dentro del marco de Hilo Luna. Pública. */
export default function SignUpPage() {
  const mode = getAuthMode();
  return (
    <AuthShell title="Crea tu *cuenta*" description="Empieza a diseñar y compartir tus invitaciones.">
      {mode === "clerk" ? <SignUp path={routes.signUp} signInUrl={routes.signIn} /> : <AuthUnavailable mode={mode} />}
    </AuthShell>
  );
}
