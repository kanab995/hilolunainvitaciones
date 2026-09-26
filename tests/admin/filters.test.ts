import { describe, expect, it, vi } from "vitest";
import { PLAN_IDS, type PlanId } from "@/lib/billing/plans";
import { getEffectiveEventPlan, PURCHASE_STATUSES } from "@/lib/billing/purchase";
import { derivePublicationState } from "@/lib/publishing/state";
import { matches } from "../helpers/admin-where";

vi.mock("@/server/db/client", () => ({ prisma: { invitation: { fields: { publishedRevision: { __ref: "publishedRevision" } } } } }));

import { eventPlanWhere, eventPublicationWhere } from "@/server/repositories/admin";

/**
 * Los FILTROS de la consola son las mismas reglas del producto escritas como condición de base de datos. Aquí se contrastan, exhaustivamente,
 * con las funciones de dominio (`getEffectiveEventPlan`, `derivePublicationState`): si alguien cambia una regla en un lado y no en el otro, falla.
 */
describe("(15) el filtro por plan efectivo equivale a getEffectiveEventPlan", () => {
  const options = PURCHASE_STATUSES.flatMap((status) => (["ESSENTIAL", "PREMIUM"] as const).map((plan) => ({ status, plan })));
  const sets: Array<Array<{ status: (typeof PURCHASE_STATUSES)[number]; plan: PlanId }>> = [[]];
  for (const a of options) {
    sets.push([a]);
    for (const b of options) {
      sets.push([a, b]);
      for (const c of options) sets.push([a, b, c]);
    }
  }

  it("para TODA combinación de hasta tres compras, exactamente un filtro de plan la acepta y es el plan efectivo", () => {
    expect(sets.length).toBeGreaterThan(1000);
    for (const purchases of sets) {
      const expected = getEffectiveEventPlan(purchases);
      const accepted = PLAN_IDS.filter((plan) => matches(eventPlanWhere(plan), { purchases }));
      expect(accepted, JSON.stringify(purchases)).toEqual([expected]);
    }
  });

  it("un evento sin compras es Gratis; PENDING/FAILED/REFUNDED/CANCELED nunca cuentan; Premium gana a Esencial", () => {
    expect(matches(eventPlanWhere("FREE"), { purchases: [] })).toBe(true);
    for (const status of ["PENDING", "FAILED", "REFUNDED", "CANCELED"] as const) {
      expect(matches(eventPlanWhere("FREE"), { purchases: [{ status, plan: "PREMIUM" }] }), status).toBe(true);
      expect(matches(eventPlanWhere("PREMIUM"), { purchases: [{ status, plan: "PREMIUM" }] }), status).toBe(false);
    }
    const both = [{ status: "PAID", plan: "ESSENTIAL" }, { status: "PAID", plan: "PREMIUM" }];
    expect(matches(eventPlanWhere("PREMIUM"), { purchases: both })).toBe(true);
    expect(matches(eventPlanWhere("ESSENTIAL"), { purchases: both })).toBe(false);
  });
});

describe("(14) el filtro de publicación equivale a derivePublicationState", () => {
  it("para toda combinación de estado y revisiones, un solo filtro la acepta y coincide con el estado derivado (sin invitación = borrador)", () => {
    const states = ["draft", "published", "changes"] as const;
    const statuses = ["DRAFT", "PUBLISHED", "UNPUBLISHED"] as const;
    let checked = 0;
    const check = (invitation: Record<string, unknown> | null, expected: (typeof states)[number]) => {
      const accepted = states.filter((state) => matches(eventPublicationWhere(state), { invitation }));
      expect(accepted, JSON.stringify(invitation)).toEqual([expected]);
      checked += 1;
    };
    check(null, "draft");
    for (const status of statuses)
      for (const draftRevision of [1, 2, 3, 4])
        for (const publishedRevision of [0, 1, 2, 3, 4])
          for (const publishedVersion of [0, 1, 2]) check({ status, draftRevision, publishedRevision, publishedVersion }, derivePublicationState({ status, draftRevision, publishedRevision, publishedVersion }));
    expect(checked).toBeGreaterThan(100);
  });
});
