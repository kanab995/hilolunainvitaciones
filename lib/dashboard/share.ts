import { routes } from "@/lib/routes";
import { getPublicInvitationUrl } from "@/lib/site-url";

/**
 * Enlace para compartir una invitación. Decisión del propietario (CLAUDE.md, D-10): la URL pública es
 * `/i/[slug]` con el slug real de la invitación (el mockup 05 muestra otra forma: desviación consciente).
 * La base sale de `getSiteUrl()`: `https://hiloluna.com` en producción, `http://localhost:3000` en desarrollo.
 */
export const invitationPath = (slug: string): string => routes.invitation(slug);

/** Enlace completo que se copia o se comparte. */
export const shareUrl = (slug: string): string => getPublicInvitationUrl(slug);

/** Enlace tal como se muestra (sin protocolo). */
export const displayShareUrl = (slug: string): string => shareUrl(slug).replace(/^https?:\/\//, "");

interface ClipboardNavigator {
  clipboard?: { writeText(text: string): Promise<void> };
}

interface FallbackDocument {
  createElement(tag: "textarea"): {
    value: string;
    style: { position: string; opacity: string };
    setAttribute(name: string, value: string): void;
    select(): void;
  };
  body: { appendChild(node: unknown): unknown; removeChild(node: unknown): unknown };
  execCommand?: (command: string) => boolean;
}

/**
 * Copia texto al portapapeles con la Clipboard API. Si no está disponible (o se rechaza el permiso)
 * intenta el método clásico con un `<textarea>` temporal. Devuelve `false` si nada funcionó: la
 * interfaz debe mostrar entonces un aviso simple (y el enlace visible para copiarlo a mano).
 */
export async function copyToClipboard(
  text: string,
  nav: ClipboardNavigator = typeof navigator === "undefined" ? {} : navigator,
  doc: FallbackDocument | undefined = typeof document === "undefined" ? undefined : (document as unknown as FallbackDocument),
): Promise<boolean> {
  try {
    if (nav.clipboard) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Sin permiso o sin contexto seguro: se prueba el método clásico.
  }

  if (!doc?.execCommand) return false;
  const area = doc.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  doc.body.appendChild(area);
  try {
    area.select();
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    doc.body.removeChild(area);
  }
}

/** ¿Hay Web Share API? (móviles y algunos navegadores de escritorio). */
export function canUseWebShare(nav: { share?: unknown } = typeof navigator === "undefined" ? {} : navigator): boolean {
  return typeof nav.share === "function";
}
