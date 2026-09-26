import type { ReactNode } from "react";
import { Calendar, Clock, Gift, Image as ImageIcon, MapPin, Music, Users } from "lucide-react";
import {
  CalendarDemo,
  CountdownDemo,
  GalleryDemo,
  GiftsDemo,
  LocationDemo,
  MusicDemo,
  RsvpDemo,
} from "@/components/marketing/feature-demos";
import { FeatureShowcaseCard } from "@/components/marketing/feature-showcase-card";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SceneBlobs } from "@/components/ui/media-slot";
import { SectionHeading } from "@/components/ui/section-heading";
import { features, featuresCopy } from "@/lib/content/home";
import type { FeatureId } from "@/types/marketing";

/**
 * Cada función: ícono, mini-demo, decoración de esquina opcional y su lugar en la rejilla de 12
 * columnas. La composición es deliberadamente IRREGULAR (editorial): anchos 5/3/4 y 3/3/3/3, las
 * tarjetas no se estiran a la misma altura (`items-start`) y algunas se desplazan en vertical.
 * En `md` la primera y la última ocupan el ancho completo; en móvil, una columna.
 *
 * TODO(asset): replace with approved Hilo Luna asset — las flores/hojas que decoran las esquinas de
 * "Cuenta regresiva" y "Ubicación" (hoy son escenas difusas).
 */
const layout: Record<FeatureId, { icon: ReactNode; demo: ReactNode; span: string; decor?: ReactNode }> = {
  countdown: {
    icon: <Clock />,
    demo: <CountdownDemo />,
    span: "md:col-span-2 lg:col-span-5",
    decor: <SceneBlobs scene="roses" className="left-[55%] -top-[35%] h-[90%] w-[60%] lg:left-[60%]" />,
  },
  rsvp: { icon: <Users />, demo: <RsvpDemo />, span: "lg:col-span-3 lg:mt-10" },
  location: {
    icon: <MapPin />,
    demo: <LocationDemo />,
    span: "lg:col-span-4",
    decor: <SceneBlobs scene="petals" flip className="left-[58%] -top-[38%] h-[80%] w-[55%]" />,
  },
  gifts: { icon: <Gift />, demo: <GiftsDemo />, span: "lg:col-span-3" },
  gallery: { icon: <ImageIcon />, demo: <GalleryDemo />, span: "lg:col-span-3 lg:-mt-2" },
  music: { icon: <Music />, demo: <MusicDemo />, span: "lg:col-span-3 lg:mt-8" },
  calendar: { icon: <Calendar />, demo: <CalendarDemo />, span: "md:col-span-2 lg:col-span-3 lg:mt-3" },
};

/** "Todo lo que necesitas en una sola invitación" (mockup 01): composición editorial de tarjetas. */
export function FeatureShowcase() {
  return (
    <MarketingSection labelledBy="features-title">
      <SectionHeading headingId="features-title" align="center" title={featuresCopy.title} />
      <ul className="mt-12 grid items-start gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-12">
        {features.map((feature) => {
          const item = layout[feature.id];
          return (
            <li key={feature.id} className={item.span}>
              <FeatureShowcaseCard
                icon={item.icon}
                title={feature.title}
                description={feature.description}
                decor={item.decor}
              >
                {item.demo}
              </FeatureShowcaseCard>
            </li>
          );
        })}
      </ul>
    </MarketingSection>
  );
}
