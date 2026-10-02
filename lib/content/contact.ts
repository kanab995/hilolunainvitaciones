import { PRIVACY_EMAIL, SUPPORT_EMAIL } from "@/lib/content/legal";

/**
 * Página de contacto (`/contact`), simple y sin lógica: dos correos ya aprobados (los mismos de los
 * textos legales, `lib/content/legal.ts`), sin formulario ni integración nueva. Corrige el enlace roto
 * del pie (`footerNav` en `lib/content/navigation.ts`), que apuntaba aquí desde antes de que existiera
 * esta página (docs/ROUTES.md §1.2).
 */
export const contactCopy = {
  eyebrow: "Contacto",
  title: "Contacto",
  description: "¿Tienes una duda sobre tu invitación o tu cuenta? Escríbenos, con gusto te ayudamos.",
  supportLabel: "Soporte",
  supportEmail: SUPPORT_EMAIL,
  privacyLabel: "Privacidad y datos personales",
  privacyEmail: PRIVACY_EMAIL,
  backToTemplates: "Ver plantillas",
  backToPricing: "Ver precios",
};
