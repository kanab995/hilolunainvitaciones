import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExpiredInvitation } from "@/components/invitation/expired-invitation";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { getDemoInvitation } from "@/lib/invitation/demo";
import { displayNames } from "@/lib/invitation/format";
import { getServerNow } from "@/lib/invitation/server-time";
import { defaultInvitationTemplate, getInvitationTemplate } from "@/lib/invitation/templates";
import { siteConfig } from "@/lib/site-config";
import { getPublicInvitationRecord } from "@/server/repositories/public-invitations";
import { isExpiredRecord } from "@/server/repositories/publishing";
import { getClientAddress } from "@/server/security/client-identity";
import { isRateLimited, RATE_LIMIT_RULES } from "@/server/security/rate-limit";
import { toPersonalization } from "@/server/services/public-context";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import type { Personalization } from "@/types/public-rsvp";

/**
 * Invitación pública, SIN cuenta: la invitación PUBLICADA con ese `slug`. Las invitaciones
 * `demo-<plantilla>` (`getDemoInvitation`) usan los datos persistidos del evento demo con la plantilla
 * indicada (nunca admiten invitado). En una invitación de demostración `?template=<slug>` permite comparar
 * plantillas sin tocar los datos. Una plantilla desconocida cae a la de por defecto.
 *
 * `?guest=<token>` personaliza la invitación para un invitado: saludo y RSVP persistente. Solo se acepta si
 * el token pertenece a un invitado del MISMO evento que el slug; en otro caso se trata como inválido
 * (sin revelar por qué) y la invitación general sigue viéndose.
 *
 * CACHÉ (docs/ARCHITECTURE.md D-26): la página es SIEMPRE dinámica (`force-dynamic`, y además lee
 * `searchParams`): la versión personalizada nunca se cachea ni se sirve a otra persona. NO indexable, sin
 * `Referer` hacia enlaces externos (el token viaja en la URL), y ningún dato del invitado entra en los
 * metadatos (título, Open Graph…): solo existe en el contenido renderizado de esa petición.
 */
export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

interface Loaded {
  invitation: Invitation;
  /** Tema publicado (snapshot); sin él, el del registro de plantillas. */
  publishedTemplate?: InvitationTemplate;
  personalization: Personalization | undefined;
}

/** Token que nunca coincide con nadie (no pasa el formato): se usa cuando el cliente excedió el límite de consultas de `?guest=`. */
const BLOCKED_TOKEN = "-";

async function load(slug: string, guestParam: string | undefined): Promise<Loaded | "expired" | undefined> {
  // Adivinar tokens: el límite se aplica por cliente ANTES de consultar la base de datos; al excederlo, el token se trata como inválido.
  const limited = guestParam ? await isRateLimited([{ rule: RATE_LIMIT_RULES.guestLookup, identity: await getClientAddress() }]) : false;
  const record = await getPublicInvitationRecord(slug, limited ? BLOCKED_TOKEN : guestParam);
  // Acceso vencido (D-34): sin contenido, sin invitado, sin demostración. El tipo obliga a comprobarlo antes de leer la invitación.
  if (isExpiredRecord(record)) return "expired";
  if (record) return { invitation: record.invitation, publishedTemplate: record.template, personalization: toPersonalization(record, slug, guestParam ?? "") };
  const demo = await getDemoInvitation(slug);
  return demo ? { invitation: demo, personalization: undefined } : undefined;
}

export async function generateMetadata(props: PageProps<"/i/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  // Sin `guest`: el título y el resto de metadatos NUNCA dependen del invitado.
  const loaded = await load(slug, undefined);
  const robots = { index: false, follow: false } as const;
  if (!loaded || loaded === "expired") return { title: siteConfig.name, robots, referrer: "no-referrer" };
  // La experiencia del invitado es independiente del producto: el título no lleva la marca.
  return { title: displayNames(loaded.invitation.names).join(" & "), robots, referrer: "no-referrer" };
}

export default async function InvitationPage(props: PageProps<"/i/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const loaded = await load(slug, one(searchParams.guest));
  if (!loaded) notFound();
  if (loaded === "expired") return <ExpiredInvitation />;
  const { invitation, personalization, publishedTemplate } = loaded;

  const requested = slug.startsWith("demo-") && typeof searchParams.template === "string" ? searchParams.template : invitation.templateSlug;
  // Una invitación publicada se dibuja con el tema con el que se publicó; las demos, con el del registro.
  const template = publishedTemplate ?? getInvitationTemplate(requested) ?? defaultInvitationTemplate;

  return <InvitationRenderer invitation={invitation} template={template} now={getServerNow()} personalization={personalization} />;
}
