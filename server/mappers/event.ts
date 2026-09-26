import type { Event } from "@prisma/client";
import { eventTypeFromDb } from "@/server/mappers/enums";
import { dbDateToEventIso } from "@/server/mappers/invitation";
import type { EventSummary } from "@/types/event";

export type EventRowData = Pick<Event, "id" | "slug" | "title" | "type" | "status" | "startsAt" | "timezone">;

const statusFromDb: Record<Event["status"], EventSummary["status"]> = { DRAFT: "draft", ACTIVE: "active", ARCHIVED: "archived" };

export function dbEventToSummary(row: EventRowData): EventSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: eventTypeFromDb[row.type],
    status: statusFromDb[row.status],
    startsAt: dbDateToEventIso(row.startsAt, row.timezone),
    timezone: row.timezone,
  };
}
