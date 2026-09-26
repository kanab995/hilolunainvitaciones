import { moveById, moveSection, dropSection, patchById, removeById, reorderById, type Direction, type WithId } from "@/lib/editor/operations";
import { canSelectTemplate } from "@/lib/editor/template-choice";
import type { GalleryImage, GiftRegistryEntry, Invitation, InvitationSection, EventLocation, TimelineItem } from "@/types/invitation";

/**
 * ESTADO DEL BORRADOR. El editor NUNCA muta la invitación inicial: `initialInvitation` → estado
 * `draft` (copia de trabajo) → `InvitationRenderer`. Todo cambio pasa por este reductor, la única
 * API de edición (`useInvitationDraft` la expone con nombres: updateInvitation, updateSection,
 * toggleSection, moveSection, reorderSection, list…). Puro y sin React: se prueba sin navegador.
 */

export interface DraftState {
  draft: Invitation;
}

export const createDraftState = (initial: Invitation): DraftState => ({ draft: initial });

/**
 * Cambios de CONTENIDO permitidos. Excluye a propósito la plantilla, el orden de secciones y la
 * identidad: cambiar contenido nunca cambia `templateSlug` (regla 17).
 */
export type InvitationPatch = Partial<Omit<Invitation, "id" | "slug" | "contentVersion" | "templateSlug" | "sections">>;

/** Campos de una sección que el editor puede cambiar (no su identidad ni su tipo). */
export type SectionPatch = Partial<Omit<InvitationSection, "id" | "type">>;

/** Listas con identidad estable que el editor añade, quita, reordena y edita. */
export interface ListItems {
  locations: EventLocation;
  timeline: TimelineItem;
  gallery: GalleryImage;
  giftEntries: GiftRegistryEntry;
}
export type ListKey = keyof ListItems;

export type ListOp<T extends WithId> =
  | { kind: "add"; item: T }
  | { kind: "remove"; id: string }
  | { kind: "move"; id: string; direction: Direction }
  | { kind: "reorder"; id: string; toIndex: number }
  | { kind: "patch"; id: string; patch: Partial<Omit<T, "id">> };

export type DraftAction =
  /** `patch` puede ser una función del borrador actual (evita datos obsoletos con cambios rápidos). */
  | { type: "updateInvitation"; patch: InvitationPatch | ((draft: Invitation) => InvitationPatch) }
  | { type: "updateSection"; id: string; patch: SectionPatch }
  | { type: "toggleSection"; id: string }
  | { type: "moveSection"; id: string; direction: Direction }
  | { type: "reorderSection"; id: string; toIndex: number }
  | { [K in ListKey]: { type: "list"; list: K; op: ListOp<ListItems[K]> } }[ListKey]
  | { type: "selectTemplate"; slug: string }
  | { type: "reset"; invitation: Invitation };

function applyOp<T extends WithId>(list: readonly T[], op: ListOp<T>): readonly T[] {
  switch (op.kind) {
    case "add":
      return list.some((item) => item.id === op.item.id) ? list : [...list, op.item];
    case "remove":
      return removeById(list, op.id);
    case "move":
      return moveById(list, op.id, op.direction);
    case "reorder":
      return reorderById(list, op.id, op.toIndex);
    case "patch":
      return patchById(list, op.id, op.patch);
  }
}

function applyListAction(draft: Invitation, action: Extract<DraftAction, { type: "list" }>): Invitation {
  switch (action.list) {
    case "locations":
      return { ...draft, locations: applyOp(draft.locations, action.op as ListOp<EventLocation>) };
    case "timeline":
      return { ...draft, timeline: applyOp(draft.timeline, action.op as ListOp<TimelineItem>) };
    case "gallery":
      return { ...draft, gallery: applyOp(draft.gallery, action.op as ListOp<GalleryImage>) };
    case "giftEntries": {
      if (!draft.giftRegistry) return draft;
      const entries = applyOp(draft.giftRegistry.entries, action.op as ListOp<GiftRegistryEntry>);
      return entries === draft.giftRegistry.entries ? draft : { ...draft, giftRegistry: { ...draft.giftRegistry, entries } };
    }
  }
}

/** Campos que un cambio de contenido nunca puede tocar, aunque el tipo se eluda con un `as`. */
const PROTECTED_KEYS = ["id", "slug", "contentVersion", "templateSlug", "sections"] as const;

function withoutProtectedKeys(patch: InvitationPatch): InvitationPatch {
  const safe: Record<string, unknown> = { ...patch };
  for (const key of PROTECTED_KEYS) delete safe[key];
  return safe as InvitationPatch;
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  const { draft } = state;
  let next: Invitation = draft;

  switch (action.type) {
    case "updateInvitation":
      next = { ...draft, ...withoutProtectedKeys(typeof action.patch === "function" ? action.patch(draft) : action.patch) };
      break;
    case "updateSection": {
      const exists = draft.sections.some((section) => section.id === action.id);
      next = exists
        ? { ...draft, sections: draft.sections.map((section) => (section.id === action.id ? { ...section, ...action.patch } : section)) }
        : draft;
      break;
    }
    case "toggleSection":
      // La única fuente de verdad de la visibilidad es `InvitationSection.isVisible` (lo lee el renderizador).
      next = {
        ...draft,
        sections: draft.sections.map((section) => (section.id === action.id ? { ...section, isVisible: !section.isVisible } : section)),
      };
      break;
    case "moveSection":
      next = { ...draft, sections: moveSection(draft.sections, action.id, action.direction) };
      break;
    case "reorderSection":
      next = { ...draft, sections: dropSection(draft.sections, action.id, action.toIndex) };
      break;
    case "list":
      next = applyListAction(draft, action);
      break;
    case "selectTemplate":
      // Solo plantillas productivas (`implemented`). Una `concept`/`comingSoon` no cambia nada.
      next = canSelectTemplate(action.slug) ? { ...draft, templateSlug: action.slug } : draft;
      break;
    case "reset":
      return createDraftState(action.invitation);
  }

  // Sin cambios reales: misma referencia (no dispara autoguardado ni renders).
  const changed = Object.keys(next).length !== Object.keys(draft).length || (Object.keys(next) as (keyof Invitation)[]).some((key) => next[key] !== draft[key]);
  return changed ? { draft: next } : state;
}
