import { auth, currentUser } from "@clerk/nextjs/server";
import { getAuthMode } from "@/server/auth/mode";
import type { ClerkProfile } from "@/server/services/user-sync";

/**
 * ÚNICO módulo (junto a `proxy.ts`) que habla con Clerk desde el servidor. Devuelve la sesión actual
 * (solo el id: barato, sale del token) y una función perezosa para pedir el perfil completo, que solo
 * se invoca la primera vez que una cuenta entra (ver `syncUser`). No expone tokens ni secretos.
 */
export interface ClerkSession {
  clerkUserId: string;
  loadProfile: () => Promise<ClerkProfile>;
}

export async function getClerkSession(): Promise<ClerkSession | null> {
  if (getAuthMode() !== "clerk") return null;
  const { userId } = await auth();
  if (!userId) return null;

  return {
    clerkUserId: userId,
    loadProfile: async () => {
      const user = await currentUser();
      const primary = user?.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ?? user?.emailAddresses[0];
      const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || null;
      return { email: primary?.emailAddress ?? null, emailVerified: primary?.verification?.status === "verified", name };
    },
  };
}
