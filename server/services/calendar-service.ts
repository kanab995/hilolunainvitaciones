import { buildIcs } from "@/lib/calendar/ics";
import { displayNames } from "@/lib/invitation/format";
import { getServerNow } from "@/lib/invitation/server-time";
import { icsFilename } from "@/lib/share/target";
import { siteConfig } from "@/lib/site-config";
import { getPublicInvitationUrl, getSiteUrl } from "@/lib/site-url";
import { isExpiredRecord, loadPublishedInvitation, type ExpiredRecord, type PublishedRecord } from "@/server/repositories/publishing";

/**
 * CALENDARIO de una invitación PUBLICADA (D-30): `/i/[slug]/calendar.ics`. Regla: solo usa el contenido
 * PUBLICADO (`loadPublishedInvitation`, el snapshot vigente), nunca el borrador: si se cambia la fecha en el editor y no
 * se republica, el `.ics` sigue dando la fecha publicada. Es público (sin sesión) y no contiene ningún dato de
 * invitados: la URL que incluye es siempre la GENERAL, sin `?guest=`. Sin publicación → `undefined` (404).
 */
export interface CalendarFile {
  filename: string;
  body: string;
}

export interface CalendarDeps {
  load: (slug: string) => Promise<PublishedRecord | ExpiredRecord | undefined>;
  now: () => number;
}

const defaultDeps: CalendarDeps = { load: loadPublishedInvitation, now: getServerNow };

/** Un slug válido de invitación (`a-z0-9-`): lo demás ni se consulta. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function getPublishedCalendar(slug: string, deps: CalendarDeps = defaultDeps): Promise<CalendarFile | undefined> {
  if (!SLUG.test(slug) || slug.length > 80) return undefined;
  const record = await deps.load(slug);
  // Sin invitación publicada o con el acceso del evento vencido (D-34): no hay archivo (404), igual que la página pública.
  if (!record || isExpiredRecord(record)) return undefined;
  const { invitation, publication } = record;

  // Sede principal: la primera con nombre (una sede incompleta no se muestra en la invitación pública).
  const place = invitation.locations.find((location) => location.name.trim());
  const location = place ? [place.name.trim(), ...place.addressLines.map((line) => line.trim()).filter(Boolean)].join(", ") : undefined;

  const body = buildIcs({
    uid: `${slug}@${new URL(getSiteUrl()).hostname}`,
    title: displayNames(invitation.names).join(" & ") || siteConfig.name,
    startsAtIso: invitation.event.startsAt,
    timezone: invitation.event.timezone,
    location,
    url: getPublicInvitationUrl(slug),
    stamp: publication ? new Date(publication.publishedAt) : new Date(deps.now()),
    version: publication?.version,
    productName: siteConfig.name,
  });
  return body ? { filename: icsFilename(slug), body } : undefined;
}
