/**
 * MODO DE AUTENTICACIÓN (docs/ARCHITECTURE.md D-24). Se decide SIEMPRE en el servidor, por entorno:
 *  - `clerk`: hay claves de Clerk → sesiones reales. Es el único modo de producción.
 *  - `demo`: SIN claves y solo en `development` → el panel funciona como el usuario demo del seed, para
 *    poder desarrollar sin cuenta de Clerk. Nunca existe en producción ni en pruebas.
 *  - `unconfigured`: sin claves fuera de desarrollo → las rutas privadas redirigen a /sign-in, que
 *    muestra un aviso (nadie entra).
 * Las variables `NEXT_PUBLIC_*` se leen con acceso estático para que Next.js las sustituya.
 * `CLERK_SECRET_KEY` solo se lee aquí, en código de servidor: jamás en componentes de cliente.
 */
export type AuthMode = "clerk" | "demo" | "unconfigured";

export interface AuthEnv {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string | undefined;
  CLERK_SECRET_KEY?: string | undefined;
  NODE_ENV?: string | undefined;
}

export function readAuthEnv(): AuthEnv {
  return {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };
}

/** ¿Están las dos claves de Clerk? (no las valida: Clerk lo hace al usarlas). */
export function isClerkConfigured(env: AuthEnv = readAuthEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() && env.CLERK_SECRET_KEY?.trim());
}

export function getAuthMode(env: AuthEnv = readAuthEnv()): AuthMode {
  if (isClerkConfigured(env)) return "clerk";
  return env.NODE_ENV === "development" ? "demo" : "unconfigured";
}

/** El alias `/dashboard/events/demo` solo existe fuera de producción (y aun así exige ser el propietario). */
export function isDemoAliasEnabled(env: AuthEnv = readAuthEnv()): boolean {
  return env.NODE_ENV !== "production";
}
