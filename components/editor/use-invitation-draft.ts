"use client";

import { useMemo, useReducer } from "react";
import {
  createDraftState,
  draftReducer,
  type InvitationPatch,
  type ListItems,
  type ListKey,
  type ListOp,
  type SectionPatch,
} from "@/lib/editor/draft-reducer";
import type { Direction, WithId } from "@/lib/editor/operations";
import type { Invitation } from "@/types/invitation";

/** API de una lista con identidad estable (ubicaciones, itinerario, fotos, tiendas de regalos). */
export interface ListApi<T extends WithId> {
  add(item: T): void;
  remove(id: string): void;
  move(id: string, direction: Direction): void;
  reorder(id: string, toIndex: number): void;
  patch(id: string, patch: Partial<Omit<T, "id">>): void;
}

/** La ÚNICA API para cambiar el borrador: todos los editores la usan; ninguno hace `setState` propio. */
export interface DraftApi {
  updateInvitation(patch: InvitationPatch | ((draft: Invitation) => InvitationPatch)): void;
  updateSection(id: string, patch: SectionPatch): void;
  toggleSection(id: string): void;
  moveSection(id: string, direction: Direction): void;
  reorderSection(id: string, toIndex: number): void;
  selectTemplate(slug: string): void;
  reset(invitation: Invitation): void;
  lists: { [K in ListKey]: ListApi<ListItems[K]> };
}

export function useInvitationDraft(initial: Invitation): { draft: Invitation; api: DraftApi } {
  const [state, dispatch] = useReducer(draftReducer, initial, createDraftState);

  const api = useMemo<DraftApi>(() => {
    const listApi = <K extends ListKey>(list: K): ListApi<ListItems[K]> => {
      const send = (op: ListOp<ListItems[K]>) => dispatch({ type: "list", list, op } as never);
      return {
        add: (item) => send({ kind: "add", item }),
        remove: (id) => send({ kind: "remove", id }),
        move: (id, direction) => send({ kind: "move", id, direction }),
        reorder: (id, toIndex) => send({ kind: "reorder", id, toIndex }),
        patch: (id, patch) => send({ kind: "patch", id, patch }),
      };
    };
    return {
      updateInvitation: (patch) => dispatch({ type: "updateInvitation", patch }),
      updateSection: (id, patch) => dispatch({ type: "updateSection", id, patch }),
      toggleSection: (id) => dispatch({ type: "toggleSection", id }),
      moveSection: (id, direction) => dispatch({ type: "moveSection", id, direction }),
      reorderSection: (id, toIndex) => dispatch({ type: "reorderSection", id, toIndex }),
      selectTemplate: (slug) => dispatch({ type: "selectTemplate", slug }),
      reset: (invitation) => dispatch({ type: "reset", invitation }),
      lists: {
        locations: listApi("locations"),
        timeline: listApi("timeline"),
        gallery: listApi("gallery"),
        giftEntries: listApi("giftEntries"),
      },
    };
  }, []);

  return { draft: state.draft, api };
}
