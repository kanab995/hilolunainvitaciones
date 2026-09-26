import type { NextConfig } from "next";
import { cspFingerprint, securityHeaderRules } from "./server/security/csp";

/**
 * Imágenes subidas por las personas (Media Assets, docs/ARCHITECTURE.md D-27): SOLO el host de
 * `S3_PUBLIC_BASE_URL` puede servirse por el optimizador de imágenes; nunca `hostname: "*"`. Sin esa variable no
 * hay ningún host remoto permitido. `dangerouslyAllowLocalIP` solo se activa en desarrollo y solo si el host
 * configurado es local (un servidor S3 de pruebas en localhost); jamás en producción.
 */
function mediaImages(): NonNullable<NextConfig["images"]> {
  const base = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!base) return {};
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return {};
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return {
      remotePatterns: [{ protocol: url.protocol === "https:" ? "https" : "http", hostname: url.hostname, port: url.port, pathname: `${url.pathname.replace(/\/+$/, "")}/users/**` }],
      ...(isLocal && process.env.NODE_ENV !== "production" ? { dangerouslyAllowLocalIP: true } : {}),
    };
  } catch {
    return {};
  }
}

const nextConfig: NextConfig = {
  // Sin la cabecera `X-Powered-By: Next.js` (no aporta nada y revela el stack).
  poweredByHeader: false,
  // Huella de la CSP del build (se compara al arrancar: `server/config/startup.ts`).
  env: { HILOLUNA_CSP_FINGERPRINT: cspFingerprint(process.env) },
  images: mediaImages(),
  experimental: {
    // Necesario para personalizar el 404 global con varios layouts raíz
    // (app/global-not-found.tsx). Ver docs/ROUTES.md §7.
    globalNotFound: true,
  },
  /** Cabeceras de seguridad, CSP y noindex por ruta (`server/security/csp.ts`, docs/ARCHITECTURE.md D-34). */
  async headers() {
    return securityHeaderRules(process.env);
  },
  async redirects() {
    return [
      {
        // /dashboard no tiene diseño propio (docs/PROJECT_SPEC.md Q-21):
        // aterriza en "Mis eventos". Temporal (307) hasta tener mockup.
        source: "/dashboard",
        destination: "/dashboard/events",
        permanent: false,
      },
      // Rutas de acceso anteriores (scaffold): ahora las sirve Clerk en /sign-in y /sign-up.
      { source: "/login", destination: "/sign-in", permanent: true },
      { source: "/register", destination: "/sign-up", permanent: true },
    ];
  },
};

export default nextConfig;
