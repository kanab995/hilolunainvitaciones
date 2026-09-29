/**
 * SANEAMIENTO de correo (D-36): dos riesgos distintos.
 *  - INYECCIÓN DE CABECERAS: un salto de línea dentro de `subject`/`from`/`replyTo` podría añadir cabeceras SMTP arbitrarias
 *    (p. ej. `Bcc:`). Nunca se construyen cabeceras a partir de datos de un invitado; aun así, todo lo que entra en una
 *    cabecera se limpia.
 *  - HTML: el nombre del invitado o el título del evento son texto de la BASE DE DATOS (los puso el anfitrión o el propio
 *    invitado), nunca HTML de confianza: se escapa antes de insertarse en la plantilla.
 */

/** Quita saltos de línea y caracteres de control; recorta a una longitud razonable de cabecera. */
export function sanitizeHeaderValue(value: string, maxLength = 200): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa el texto para insertarlo en HTML (nombres, títulos de evento, mensajes: nunca HTML de confianza). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string);
}
