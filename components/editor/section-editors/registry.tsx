import type { ComponentType } from "react";
import { ClosingEditor } from "@/components/editor/section-editors/closing-editor";
import { CountdownEditor } from "@/components/editor/section-editors/countdown-editor";
import { CoverEditor } from "@/components/editor/section-editors/cover-editor";
import { DateEditor } from "@/components/editor/section-editors/date-editor";
import { DressCodeEditor } from "@/components/editor/section-editors/dress-code-editor";
import { GalleryEditor } from "@/components/editor/section-editors/gallery-editor";
import { GiftEditor } from "@/components/editor/section-editors/gift-editor";
import { LocationEditor } from "@/components/editor/section-editors/location-editor";
import { MusicEditor } from "@/components/editor/section-editors/music-editor";
import { RsvpEditor } from "@/components/editor/section-editors/rsvp-editor";
import { StoryEditor } from "@/components/editor/section-editors/story-editor";
import { TimelineEditor } from "@/components/editor/section-editors/timeline-editor";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import type { EditorRowType } from "@/lib/editor/rows";

/**
 * Registro de editores: tipo de fila → componente. El panel central solo hace `registry[type]`;
 * no hay un componente gigante con `if (section.type === …)`. Añadir un tipo de sección = añadir
 * su editor aquí (el compilador exige la entrada).
 */
export const sectionEditors: Record<EditorRowType, ComponentType<SectionEditorProps>> = {
  hero: CoverEditor,
  date: DateEditor,
  countdown: CountdownEditor,
  locations: LocationEditor,
  story: StoryEditor,
  gallery: GalleryEditor,
  timeline: TimelineEditor,
  giftRegistry: GiftEditor,
  rsvp: RsvpEditor,
  music: MusicEditor,
  dressCode: DressCodeEditor,
  footer: ClosingEditor,
};
