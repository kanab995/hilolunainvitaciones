import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/marketing/legal-document";
import { termsDocument } from "@/lib/content/legal";

export const metadata: Metadata = { title: termsDocument.title, description: termsDocument.description };

/** Términos y condiciones (texto aprobado, ver lib/content/legal.ts). Estática y pública. */
export default function TermsPage() {
  return <LegalDocumentView document={termsDocument} />;
}
