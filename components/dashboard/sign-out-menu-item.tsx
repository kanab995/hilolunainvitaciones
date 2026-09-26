"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { routes } from "@/lib/routes";

/**
 * "Cerrar sesión" del menú de cuenta. Solo se monta cuando hay Clerk (necesita su proveedor). Tras
 * cerrar la sesión lleva a la página de inicio.
 */
export function SignOutMenuItem() {
  const { signOut } = useClerk();
  return (
    <DropdownMenuItem onSelect={() => void signOut({ redirectUrl: routes.home })}>
      <LogOut aria-hidden="true" />
      Cerrar sesión
    </DropdownMenuItem>
  );
}
