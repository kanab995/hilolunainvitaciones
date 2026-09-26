import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/marketing/legal-document";
import { privacyDocument } from "@/lib/content/legal";

export const metadata: Metadata = { title: privacyDocument.title, description: privacyDocument.description };

/** Aviso de privacidad (BORRADOR: requiere revisión legal antes del lanzamiento). Estática y pública. */
export default function PrivacyPage() {
  return <LegalDocumentView document={privacyDocument} />;
}
