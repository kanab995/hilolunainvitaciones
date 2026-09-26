import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { decideAccess } from "@/server/auth/access";
import { getAuthMode } from "@/server/auth/mode";

/**
 * Protección de rutas (Next.js 16: `proxy.ts` sustituye a `middleware.ts`). Solo se ejecuta en las rutas
 * privadas: las públicas (home, catálogo, invitaciones) no pasan por aquí.
 * Es la PRIMERA barrera; cada página vuelve a comprobar sesión y propiedad en el servidor (una
 * redirección de proxy nunca sustituye a la comprobación de propiedad). Sin claves de Clerk no se invoca
 * `clerkMiddleware` (evita el modo "keyless" de Clerk, que crearía una aplicación temporal).
 */
const SIGN_IN_PATH = "/sign-in";
const SIGN_UP_PATH = "/sign-up";

const withClerk = clerkMiddleware(
  async (auth, request) => {
    const { userId, redirectToSignIn } = await auth();
    const decision = decideAccess({ pathname: request.nextUrl.pathname, mode: "clerk", signedIn: Boolean(userId) });
    if (decision.action === "redirect-sign-in") return redirectToSignIn({ returnBackUrl: request.url });
    return NextResponse.next();
  },
  { signInUrl: SIGN_IN_PATH, signUpUrl: SIGN_UP_PATH },
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const mode = getAuthMode();
  if (mode === "clerk") return withClerk(request, event);

  const decision = decideAccess({ pathname: request.nextUrl.pathname, mode, signedIn: false });
  if (decision.action === "redirect-sign-in") {
    const url = new URL(SIGN_IN_PATH, request.url);
    url.searchParams.set("redirect_url", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Rutas privadas (`/dashboard`, `/preview`, `/admin` y todo lo que cuelga de ellas) y `/pricing`: es pública, pero sus CTA dependen de la sesión
  // (`auth()` de Clerk exige que `clerkMiddleware` haya corrido en la ruta; sin esto respondía 500 con Clerk real). `decideAccess` la deja pasar siempre.
  // NUNCA añadir `/api/webhooks/**` ni `/i/**` (Stripe no lleva sesión; las invitaciones no usan Clerk).
  matcher: ["/dashboard/:path*", "/preview/:path*", "/admin/:path*", "/pricing"],
};
