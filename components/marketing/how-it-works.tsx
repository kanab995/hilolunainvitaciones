import { HowItWorksStep } from "@/components/marketing/how-it-works-step";
import { HowItWorksVisual } from "@/components/marketing/how-it-works-visuals";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SectionHeading } from "@/components/ui/section-heading";
import { howItWorksCopy, howItWorksSteps } from "@/lib/content/home";

/**
 * "Así de fácil" (mockup 01): tres pasos en columnas separadas por filetes desde `lg` (1024);
 * apilados con filetes horizontales por debajo (las composiciones no caben en 3 columnas a 768).
 */
export function HowItWorks() {
  return (
    <MarketingSection id="how-it-works" labelledBy="how-it-works-title">
      <SectionHeading headingId="how-it-works-title" align="center" title={howItWorksCopy.title} />
      <ol className="mt-14 grid gap-0 lg:grid-cols-3">
        {howItWorksSteps.map((step, index) => (
          <HowItWorksStep
            key={step.number}
            number={step.number}
            title={step.title}
            description={step.description}
            visual={<HowItWorksVisual id={step.visual} />}
            className={
              index === 0
                ? "pb-10 lg:pr-10 lg:pb-0"
                : "border-t border-lu-border-strong/60 py-10 lg:border-t-0 lg:border-l lg:px-10 lg:py-0"
            }
          />
        ))}
      </ol>
    </MarketingSection>
  );
}
