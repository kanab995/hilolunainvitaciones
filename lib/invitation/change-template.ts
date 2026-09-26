import type { Invitation } from "@/types/invitation";

/**
 * Cambiar de plantilla (regla 17, docs/ARCHITECTURE.md §4.5). Función pura: devuelve una COPIA de
 * la invitación con otra `templateSlug`. No toca contenido, secciones, ajustes ni
 * `styleOverrides` (que están indexados por plantilla: volver a la anterior restaura los suyos).
 */
export function changeTemplate(invitation: Invitation, templateSlug: string): Invitation {
  return { ...invitation, templateSlug };
}

/**
 * Huella del CONTENIDO: serialización estable de todo salvo `templateSlug`. Antes y después de
 * cambiar de plantilla debe ser idéntica (invariante que verifica la suite de tests).
 */
export function contentFingerprint(invitation: Invitation): string {
  const { templateSlug, ...content } = invitation;
  void templateSlug;
  return stableStringify(content);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
