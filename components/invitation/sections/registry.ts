import type { ComponentType } from "react";
import { CountdownSection } from "@/components/invitation/sections/countdown-section";
import { DressCodeSection } from "@/components/invitation/sections/dress-code-section";
import { FooterSection } from "@/components/invitation/sections/footer-section";
import { GallerySection } from "@/components/invitation/sections/gallery-section";
import { GiftRegistrySection } from "@/components/invitation/sections/gift-registry-section";
import { HeroSection } from "@/components/invitation/sections/hero-section";
import { LocationSection } from "@/components/invitation/sections/location-section";
import { RSVPSection } from "@/components/invitation/sections/rsvp-section";
import { StorySection } from "@/components/invitation/sections/story-section";
import { TimelineSection } from "@/components/invitation/sections/timeline-section";
import type { SectionProps } from "@/components/invitation/sections/types";
import type { InvitationSectionType } from "@/types/invitation";

/**
 * Registro ÚNICO de secciones: tipo → componente. Todas las plantillas usan estos mismos
 * componentes; una plantilla no puede registrar (ni duplicar) secciones propias.
 */
export const sectionRegistry: Record<InvitationSectionType, ComponentType<SectionProps>> = {
  hero: HeroSection,
  story: StorySection,
  countdown: CountdownSection,
  locations: LocationSection,
  timeline: TimelineSection,
  gallery: GallerySection,
  dressCode: DressCodeSection,
  giftRegistry: GiftRegistrySection,
  rsvp: RSVPSection,
  footer: FooterSection,
};
