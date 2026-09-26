import type { EventStatus, EventType, InvitationStatus, RsvpStatus } from "@prisma/client";
import { eventTypeToDb } from "@/server/mappers/enums";
import { domainInvitationToDb, type InvitationWriteModel } from "@/server/mappers/invitation";
import type { Invitation } from "@/types/invitation";

/**
 * AGREGADO de un evento listo para persistirse: propietario, evento, invitación (con todo su
 * contenido), grupos, invitados y sus respuestas. Es la unidad que escribe una transacción
 * (`createEventWithInvitation`) y la que carga el seed. Se construye SIEMPRE desde el dominio
 * (`Invitation`) con los mappers, de modo que crear y leer usan el mismo contrato.
 */
export interface NewGuest {
  id: string;
  groupId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  maxCompanions: number;
  status: RsvpStatus;
  /** Token público opaco del enlace personalizado (`server/services/invite-token.ts`). */
  inviteToken: string;
  firstViewedAt: Date | null;
  createdAt: Date;
  rsvp: { id: string; status: RsvpStatus; attendeeCount: number | null; message: string | null; dietaryNotes: string | null; submittedAt: Date } | null;
}

export interface NewEventAggregate {
  owner: { id: string; email: string; name: string | null };
  event: { id: string; slug: string; type: EventType; title: string; status: EventStatus; startsAt: Date; endsAt: Date | null; timezone: string };
  /** Slug de la plantilla; el repositorio lo resuelve a `Template.id`. */
  templateSlug: string;
  invitationStatus: InvitationStatus;
  invitation: InvitationWriteModel;
  guestGroups: { id: string; name: string }[];
  guests: NewGuest[];
}

export interface BuildAggregateInput {
  owner: NewEventAggregate["owner"];
  event: { id: string; slug: string; title: string; status?: EventStatus };
  invitation: Invitation;
  invitationStatus?: InvitationStatus;
  guestGroups?: NewEventAggregate["guestGroups"];
  guests?: NewGuest[];
}

/** Dominio → agregado. La fecha canónica sale de `invitation.event` y se guarda solo en `Event`. */
export function buildEventAggregate(input: BuildAggregateInput): NewEventAggregate {
  const { owner, event, invitation } = input;
  return {
    owner,
    event: {
      id: event.id,
      slug: event.slug,
      type: eventTypeToDb[invitation.eventType],
      title: event.title,
      status: event.status ?? "ACTIVE",
      startsAt: new Date(invitation.event.startsAt),
      endsAt: null,
      timezone: invitation.event.timezone,
    },
    templateSlug: invitation.templateSlug,
    invitationStatus: input.invitationStatus ?? "DRAFT",
    invitation: domainInvitationToDb(invitation),
    guestGroups: input.guestGroups ?? [],
    guests: input.guests ?? [],
  };
}
