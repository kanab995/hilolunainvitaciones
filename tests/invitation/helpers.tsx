import { renderToStaticMarkup } from "react-dom/server";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";

/** Instante fijo para que las pruebas sean deterministas (la cuenta regresiva depende de él). */
export const NOW = Date.parse("2027-01-01T00:00:00-06:00");

export function render(invitation: Invitation, template: InvitationTemplate): string {
  return renderToStaticMarkup(<InvitationRenderer invitation={invitation} template={template} now={NOW} />);
}

/** Texto visible de un HTML: sin etiquetas, con espacios normalizados y entidades básicas resueltas. */
export function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Congela un objeto en profundidad: cualquier escritura posterior lanza un error en modo estricto. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** Todas las cadenas de un valor anidado (para buscar contenido de usuario dentro de una plantilla). */
export function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, into));
  else if (value !== null && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, into));
  return into;
}

/** Todas las claves de un valor anidado. */
export function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, into));
  else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      collectKeys(child, into);
    }
  }
  return into;
}
