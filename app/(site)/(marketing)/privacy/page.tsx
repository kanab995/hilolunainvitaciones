import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/marketing/legal-document";
import { privacyDocument } from "@/lib/content/legal";

export const metadata: Metadata = { title: privacyDocument.title, description: privacyDocument.description };

/** Aviso de privacidad (texto aprobado, ver lib/content/legal.ts). Estática y pública. */
export default function PrivacyPage() {
  return <LegalDocumentView document={privacyDocument} />;
}
