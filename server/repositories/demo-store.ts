import type { EventRowData } from "@/server/mappers/event";
import type { GuestRecord } from "@/server/mappers/guest";
import type { InvitationAggregateRow, SectionRowData } from "@/server/mappers/invitation";
import { buildDemoAggregate, buildTemplateRows } from "@/server/seed/demo-data";
import type { DashboardGuestRow } from "@/server/services/dashboard";
import type { NewEventAggregate } from "@/server/services/event-aggregate";

/**
 * Origen EN MEMORIA (solo lectura) para cuando no hay `DATABASE_URL` (`server/data-source.ts`).
 * Convierte el agregado de demostración —el mismo que carga el seed— en filas con la forma que
 * devuelve Prisma, de modo que los repositorios ejecutan los MISMOS mappers en ambos orígenes.
 */
export interface DemoRows {
  event: EventRowData;
  /** Propietario del evento demo (`usr_demo`): las lecturas privadas comprueban que coincida con el usuario. */
  ownerId: string;
  invitation: InvitationAggregateRow;
  invitationStatus: NewEventAggregate["invitationStatus"];
  guests: DashboardGuestRow[];
  /** Invitados completos y grupos (Guest Manager). */
  guestRecords: GuestRecord[];
  guestGroups: { id: string; name: string }[];
}

export function getDemoRows(now: Date): DemoRows {
  const aggregate = buildDemoAggregate(now);
  const { event, invitation } = aggregate;

  const eventRow: EventRowData = { id: event.id, slug: event.slug, title: event.title, type: event.type, status: event.status, startsAt: event.startsAt, timezone: event.timezone };

  return {
    event: eventRow,
    ownerId: aggregate.owner.id,
    invitationStatus: aggregate.invitationStatus,
    invitation: {
      ...invitation.invitation,
      styleOverrides: invitation.invitation.styleOverrides as InvitationAggregateRow["styleOverrides"],
      template: { slug: aggregate.templateSlug },
      sections: invitation.sections as unknown as SectionRowData[],
      event: {
        ...eventRow,
        locations: invitation.locations,
        timelineItems: invitation.timelineItems,
        galleryImages: invitation.galleryImages,
        giftRegistry: invitation.giftRegistry,
        music: invitation.music ?? null,
      },
    },
    guestGroups: aggregate.guestGroups,
    guestRecords: aggregate.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      groupId: guest.groupId,
      groupName: aggregate.guestGroups.find((group) => group.id === guest.groupId)?.name ?? null,
      maxCompanions: guest.maxCompanions,
      status: guest.status,
      inviteToken: guest.inviteToken,
      createdAt: guest.createdAt,
      attendeeCount: guest.rsvp?.attendeeCount ?? null,
    })),
    guests: aggregate.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      status: guest.status,
      firstViewedAt: guest.firstViewedAt,
      createdAt: guest.createdAt,
      rsvp: guest.rsvp ? { status: guest.rsvp.status, attendeeCount: guest.rsvp.attendeeCount, submittedAt: guest.rsvp.submittedAt } : null,
    })),
  };
}

export function getDemoTemplateRows() {
  return buildTemplateRows();
}
