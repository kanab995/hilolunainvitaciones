import { templates } from "@/lib/content/templates";
import { displayNames } from "@/lib/invitation/format";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { domainTemplateToDb, type TemplateRowData } from "@/server/mappers/template";
import { buildEventAggregate, type NewEventAggregate, type NewGuest } from "@/server/services/event-aggregate";
import { deriveDemoInviteToken } from "@/server/services/invite-token";

/**
 * DATOS DE DEMOSTRACIÓN (Andrea & Fernando). ÚNICA fuente: los usa el seed (`prisma/seed.ts`) y, sin
 * `DATABASE_URL`, el origen en memoria (`server/repositories/demo-store.ts`). Se DERIVAN de los datos
 * de dominio existentes (`andreaFernandoInvitation`, `templates`), no se duplican.
 */
export const DEMO_USER = { id: "usr_demo", email: "demo@hiloluna.local", name: "Andrea" } as const;
export const DEMO_EVENT_ID = "evt_demo_andrea_fernando";
export const DEMO_EVENT_SLUG = "andrea-fernando";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Catálogo completo (las 9 plantillas). Todas visibles (`PUBLISHED`); su madurez es `designStatus`. */
export function buildTemplateRows(): TemplateRowData[] {
  return templates.map((template, index) => domainTemplateToDb(template, { sortOrder: index, publicationStatus: "PUBLISHED" }));
}

/**
 * Evento demo con unos pocos invitados en estados distintos. Las marcas de tiempo son relativas a
 * `seededAt`: la actividad reciente es "hace 2 h", "hace 5 h"… respecto al momento de la carga.
 */
export function buildDemoAggregate(seededAt: Date): NewEventAggregate {
  const ago = (ms: number) => new Date(seededAt.getTime() - ms);
  const guest = (n: number, overrides: Partial<NewGuest> & Pick<NewGuest, "name" | "status">): NewGuest => ({
    id: `gst_demo_${n}`,
    groupId: null,
    email: null,
    phone: null,
    maxCompanions: 0,
    inviteToken: deriveDemoInviteToken(`gst_demo_${n}`),
    firstViewedAt: null,
    // Orden de alta estable: el primero es el más antiguo.
    createdAt: ago(10 * DAY - n * 60_000),
    rsvp: null,
    ...overrides,
  });

  return buildEventAggregate({
    owner: DEMO_USER,
    event: { id: DEMO_EVENT_ID, slug: DEMO_EVENT_SLUG, title: displayNames(andreaFernandoInvitation.names).join(" & ") },
    invitation: andreaFernandoInvitation,
    invitationStatus: "PUBLISHED",
    guestGroups: [
      { id: "grp_demo_family", name: "Familia" },
      { id: "grp_demo_friends", name: "Amigos" },
    ],
    guests: [
      guest(1, {
        name: "Mariana López",
        status: "ATTENDING",
        groupId: "grp_demo_friends",
        maxCompanions: 1,
        firstViewedAt: ago(3 * HOUR),
        rsvp: { id: "rsvp_demo_1", status: "ATTENDING", attendeeCount: 1, message: null, dietaryNotes: null, submittedAt: ago(2 * HOUR) },
      }),
      guest(2, {
        name: "Luis Hernández",
        status: "ATTENDING",
        groupId: "grp_demo_family",
        maxCompanions: 3,
        firstViewedAt: ago(6 * HOUR),
        rsvp: { id: "rsvp_demo_2", status: "ATTENDING", attendeeCount: 3, message: null, dietaryNotes: null, submittedAt: ago(5 * HOUR) },
      }),
      guest(3, { name: "Carolina Méndez", status: "PENDING", groupId: "grp_demo_friends", firstViewedAt: ago(26 * HOUR) }),
      guest(4, {
        name: "Javier Torres",
        status: "DECLINED",
        groupId: "grp_demo_friends",
        firstViewedAt: ago(52 * HOUR),
        rsvp: { id: "rsvp_demo_4", status: "DECLINED", attendeeCount: null, message: null, dietaryNotes: null, submittedAt: ago(50 * HOUR) },
      }),
    ],
  });
}
