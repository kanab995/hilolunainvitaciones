import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eyebrow, Heading, Text, textVariants } from "@/components/ui/typography";
import { contactCopy } from "@/lib/content/contact";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: contactCopy.title, description: contactCopy.description };

/** Contacto: simple, sin formulario (dos correos ya aprobados, ver lib/content/contact.ts). Estática y pública. */
export default function ContactPage() {
  return (
    <article aria-labelledby="contact-title" className="lu-container flex max-w-2xl flex-col gap-8 pt-10 pb-20 lg:pt-14">
      <header className="flex flex-col gap-3">
        <Eyebrow>{contactCopy.eyebrow}</Eyebrow>
        <Heading as="h1" id="contact-title" size="display-md">
          {contactCopy.title}
        </Heading>
        <Text size="md">{contactCopy.description}</Text>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Heading as="h2" size="title-lg">
            {contactCopy.supportLabel}
          </Heading>
          <a href={`mailto:${contactCopy.supportEmail}`} className={cn(textVariants({ size: "base" }), "underline underline-offset-4")}>
            {contactCopy.supportEmail}
          </a>
        </div>

        <div className="flex flex-col gap-1">
          <Heading as="h2" size="title-lg">
            {contactCopy.privacyLabel}
          </Heading>
          <a href={`mailto:${contactCopy.privacyEmail}`} className={cn(textVariants({ size: "base" }), "underline underline-offset-4")}>
            {contactCopy.privacyEmail}
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" font="serif">
          <Link href={routes.templates}>{contactCopy.backToTemplates}</Link>
        </Button>
        <Button asChild size="lg" font="serif" variant="secondary">
          <Link href={routes.pricing}>{contactCopy.backToPricing}</Link>
        </Button>
      </div>
    </article>
  );
}
