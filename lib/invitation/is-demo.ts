import type { Invitation } from "@/types/invitation";

/**
 * Una invitación es de DEMOSTRACIÓN PÚBLICA si su slug sigue el patrón `demo-<plantilla>` que usa
 * `getDemoInvitation` (`lib/invitation/demo.ts`, p. ej. `demo-aurora-xv`). Ningún slug real puede tener
 * ese prefijo (`lib/events/slug.ts` lo evita explícitamente al generarlos), así que esta condición
 * nunca da un falso positivo en una invitación publicada, en el editor o en la vista previa privada.
 * Única fuente de verdad para "¿esto es una demo pública?": úsala en vez de repetir `slug.startsWith(...)`.
 *
 * ARCHIVO DELIBERADAMENTE SEPARADO de `lib/invitation/demo.ts` (D-41): esta función es pura (una
 * comparación de texto) y la usan componentes de la invitación que SÍ llegan al bundle del navegador
 * (p. ej. `RSVPSection`, reutilizada por la vista previa EN VIVO del editor, `components/editor/preview-surface.tsx`,
 * un Client Component). `lib/invitation/demo.ts` en cambio importa `server/repositories/invitations.ts`
 * (Prisma, `logger`, `@sentry/node`…): si `RSVPSection` importara `isDemoInvitation` desde ahí, todo
 * ese árbol de servidor se colaría en el bundle de cliente (el `fs`/`@sentry/node` que rompía el build
 * de Vercel). Nunca muevas esta función de vuelta a `demo.ts`, ni le añadas un import que no sea el tipo
 * `Invitation`.
 */
export function isDemoInvitation(invitation: Pick<Invitation, "slug">): boolean {
  return invitation.slug.startsWith("demo-");
}
