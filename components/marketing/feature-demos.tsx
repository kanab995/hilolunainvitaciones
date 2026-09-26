import { Calendar, ChevronDown, MapPin, Play } from "lucide-react";
import { ArrowBadge } from "@/components/ui/icon-button";
import { MediaSlot } from "@/components/ui/media-slot";
import { buttonVariants } from "@/components/ui/button";
import { featureDemo } from "@/lib/content/home";
import { cn } from "@/lib/utils";

/**
 * Mini-demos ilustrativas de las tarjetas de función (mockup 01). Todas son SOLO UI de
 * demostración, sin comportamiento: no hay RSVP, reproductor, mapa ni calendario reales.
 * TODO(asset): replace with approved Hilo Luna asset — miniaturas de galería, mapa y carátula.
 */

const panel = "rounded-lu-input border border-lu-border-subtle bg-lu-surface";

export function CountdownDemo() {
  return (
    <div className={cn(panel, "grid grid-cols-4 divide-x divide-lu-border-subtle py-5 shadow-lu-card")}>
      {featureDemo.countdown.map((unit) => (
        <div key={unit.label} className="flex flex-col items-center gap-1.5">
          <span className="font-lu-display text-[2rem] leading-none text-lu-text [font-variant-numeric:lining-nums_tabular-nums]">
            {unit.value}
          </span>
          <span className="text-lu-xs font-medium tracking-[0.14em] text-lu-text-subtle uppercase">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RsvpDemo() {
  return (
    <div className="flex flex-wrap gap-2.5">
      {featureDemo.rsvp.map((label, index) => (
        <span
          key={label}
          className={buttonVariants({ variant: index === 0 ? "primary" : "secondary", size: "md" })}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function LocationDemo() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-[44%] shrink-0 overflow-hidden rounded-lu-input border border-lu-border-subtle bg-lu-surface-tint">
        <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-lu-border-strong" fill="none">
          <path d="M-5 32 L165 22 M-5 70 L165 80 M40 -5 L52 105 M108 -5 L96 105 M-5 98 L165 44" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <path d="M20 8 L70 60 M120 10 L150 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".6" />
        </svg>
        <span className="absolute top-1/2 left-1/2 inline-flex size-10 -translate-x-1/2 -translate-y-[62%] items-center justify-center rounded-full bg-lu-brown-500 text-lu-on-ink shadow-lu-float">
          <MapPin className="size-5" strokeWidth={1.75} />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lu-base leading-snug font-medium text-lu-text">{featureDemo.location.name}</p>
          <p className="mt-0.5 text-lu-sm leading-snug text-lu-text-muted">{featureDemo.location.address}</p>
        </div>
        <ArrowBadge size="md" />
      </div>
    </div>
  );
}

export function GiftsDemo() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {featureDemo.gifts.map((name) => (
        <span
          key={name}
          className={cn(panel, "flex h-16 items-center justify-center font-lu-display text-lu-title-sm text-lu-text-secondary")}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

export function GalleryDemo() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <MediaSlot tone="cream" scene="roses" className="aspect-[3/4] rounded-lu-image" />
      <MediaSlot tone="blush" scene="petals" flip className="aspect-[3/4] rounded-lu-image" />
      <MediaSlot tone="sage" scene="roses" flip className="aspect-[3/4] rounded-lu-image" />
    </div>
  );
}

const waveform = [6, 14, 9, 20, 12, 17, 7, 14, 22, 10, 16, 12, 7, 15, 9, 13];

export function MusicDemo() {
  return (
    <div className={cn(panel, "flex items-center gap-3.5 p-3.5 shadow-lu-card")}>
      <MediaSlot tone="sand" scene="petals" className="size-14 shrink-0 rounded-lu-input" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lu-base leading-snug font-medium text-lu-text">{featureDemo.music.title}</p>
        <p className="truncate text-lu-sm leading-snug text-lu-text-muted">{featureDemo.music.artist}</p>
        <div className="mt-2 flex h-6 items-center gap-[3px]">
          {waveform.map((height, index) => (
            <span
              key={index}
              className="w-[3px] rounded-full bg-lu-border-strong"
              style={{ height }}
            />
          ))}
        </div>
      </div>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-lu-brown-600 text-lu-on-ink shadow-lu-card">
        <Play className="size-4 fill-current" strokeWidth={1.5} />
      </span>
    </div>
  );
}

export function CalendarDemo() {
  return (
    <div className={cn(panel, "flex h-12 items-center justify-between gap-2 px-4")}>
      <span className="flex items-center gap-2.5 text-lu-sm text-lu-text">
        <Calendar className="size-4 text-lu-text-muted" strokeWidth={1.5} />
        {featureDemo.calendar}
      </span>
      <ChevronDown className="size-4 text-lu-text-muted" strokeWidth={1.5} />
    </div>
  );
}
