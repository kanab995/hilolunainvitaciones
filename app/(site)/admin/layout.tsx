import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminCopy } from "@/lib/admin/copy";
import { requireAdmin } from "@/server/auth/admin";
import { getAuthMode } from "@/server/auth/mode";

/** La consola nunca se indexa ni se prerenderiza: depende de la sesión y del rol. */
export const metadata: Metadata = { title: { default: adminCopy.consoleLabel, template: `%s | ${adminCopy.consoleLabel}` }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Marco de la consola interna (D-33), independiente del panel de clientes. Exige ADMIN (`requireAdmin`: sin sesión → /sign-in, sin privilegios →
 * 404 idéntico al de una ruta inexistente). Los layouts no se vuelven a ejecutar al navegar entre páginas hijas, así que CADA página y CADA
 * Server Action vuelven a llamar a `requireAdmin()`: esta comprobación no es la única barrera.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const name = admin.name?.trim() || admin.email.split("@")[0] || admin.email;
  return (
    <AdminShell user={{ name, email: admin.email }} canSignOut={getAuthMode() === "clerk"}>
      {children}
    </AdminShell>
  );
}
