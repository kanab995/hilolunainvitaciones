import type {
  EventCategory,
  FeatureCopy,
  HeroBadgeData,
  HowItWorksStepData,
} from "@/types/marketing";
import { routes } from "@/lib/routes";

/**
 * Contenido de la Homepage (mockup 01). Textos y datos en un solo lugar; sin lógica.
 * Énfasis en cursiva: `*palabra*` (ver EmphasisText).
 *
 * TODO(asset): todas las `imageSrc` están sin definir a propósito. Reemplazar por assets
 * originales/licenciados de Hilo Luna y registrarlos en docs/ASSET_LICENSES.md.
 */

export const heroCopy = {
  eyebrow: "Invitaciones digitales para momentos inolvidables",
  title: "Tu evento merece una invitación *inolvidable.*",
  description:
    "Crea, personaliza y comparte invitaciones digitales para bodas, XV años, bautizos y fiestas especiales, sin conocimientos de diseño.",
  primaryCta: "Crear mi invitación",
  secondaryCta: "Ver plantillas",
  highlights: ["Sin conocimientos de diseño", "RSVP", "Música", "Galería", "Cuenta regresiva"],
} as const;

/** Tarjetas flotantes del hero. Los valores son demostrativos (no datos reales). */
export const heroBadges: readonly HeroBadgeData[] = [
  { id: "countdown", title: "Cuenta regresiva", subtitle: "142 días" },
  { id: "rsvp", title: "RSVP", subtitle: "Confirma tu asistencia" },
  { id: "music", title: "Música", subtitle: "Nuestra canción" },
  { id: "location", title: "Ubicación", subtitle: "Ver en el mapa" },
];

/**
 * Contenido de la invitación de demostración dentro del teléfono del hero.
 * Fecha demo futura (12 de junio de 2027 es sábado); no es un dato real.
 */
export const heroInvitationDemo = {
  eyebrow: "Nos casamos",
  names: ["Andrea", "&", "Fernando"],
  date: "Sábado · 12 de junio de 2027",
  venue: ["Jardín Los Olivos", "Valle de Guadalupe"],
  button: "Abrir invitación",
} as const;

export const categoriesCopy = {
  title: "Elige el momento que estás *celebrando*",
  description: "Diseños para cada tipo de celebración",
} as const;

export const eventCategories: readonly EventCategory[] = [
  { id: "wedding", title: "Bodas", href: routes.templatesByCategory("wedding"), imageAlt: "Bodas", tone: "cream" },
  { id: "quinceanera", title: "XV años", href: routes.templatesByCategory("quinceanera"), imageAlt: "XV años", tone: "blush" },
  { id: "baptism", title: "Bautizos", href: routes.templatesByCategory("baptism"), imageAlt: "Bautizos", tone: "sand" },
  { id: "birthday", title: "Cumpleaños", href: routes.templatesByCategory("birthday"), imageAlt: "Cumpleaños", tone: "cream" },
  { id: "baby-shower", title: "Baby Shower", href: routes.templatesByCategory("baby-shower"), imageAlt: "Baby Shower", tone: "sage" },
  { id: "kids", title: "Infantiles", href: routes.templatesByCategory("kids"), imageAlt: "Infantiles", tone: "blush" },
];

export const howItWorksCopy = {
  title: "Así de *fácil*",
} as const;

export const howItWorksSteps: readonly HowItWorksStepData[] = [
  {
    number: "01",
    title: "Elige una plantilla",
    description: "Explora cientos de diseños creados por nuestro equipo de diseñadores.",
    visual: "template-stack",
  },
  {
    number: "02",
    title: "Personaliza cada detalle",
    description: "Edita textos, colores, imágenes, música y más, sin complicaciones.",
    visual: "editor",
  },
  {
    number: "03",
    title: "Comparte y confirma asistencia",
    description:
      "Envía por WhatsApp, redes sociales o un enlace y gestiona tu lista de invitados.",
    visual: "share",
  },
];

export const featuresCopy = {
  title: "Todo lo que necesitas en una *sola invitación*",
} as const;

export const features: readonly FeatureCopy[] = [
  { id: "countdown", title: "Cuenta regresiva", description: "Genera emoción para tu evento." },
  { id: "rsvp", title: "Confirmación RSVP", description: "Gestiona tu lista de invitados." },
  { id: "location", title: "Ubicación", description: "Comparte la dirección de tu evento." },
  { id: "gifts", title: "Mesa de regalos", description: "Comparte tu mesa de regalos." },
  { id: "gallery", title: "Galería", description: "Comparte los mejores momentos." },
  { id: "music", title: "Música", description: "Ambienta tu invitación." },
  { id: "calendar", title: "Agregar al calendario", description: "Para que nadie se te pierda." },
];

/** Valores de demostración de los mini-componentes de las tarjetas (no son datos reales). */
export const featureDemo = {
  countdown: [
    { value: "142", label: "Días" },
    { value: "08", label: "Horas" },
    { value: "24", label: "Min" },
    { value: "16", label: "Seg" },
  ],
  rsvp: ["Asistiré", "No podré asistir", "Tal vez"],
  location: { name: "Jardín Los Olivos", address: "Valle de Guadalupe, BC" },
  /**
   * Texto provisional: NO se usan logos oficiales de terceros hasta documentar su licencia
   * (docs/ASSET_LICENSES.md §7, PROJECT_SPEC Q-05).
   */
  gifts: ["Liverpool", "Amazon", "Sears"],
  /** Solo UI de demostración: no se reproduce ni se integra ningún servicio de música. */
  music: { title: "Perfect", artist: "Ed Sheeran" },
  calendar: "Agregar al calendario",
} as const;

export const featuredTemplatesCopy = {
  title: "Plantillas que se sienten como tu *evento*",
  description: "Explora estilos elegantes, modernos, florales y editoriales",
  cta: "Ver todas las plantillas",
} as const;

/** Plantillas destacadas de la home: `slug`s del catálogo (`lib/content/templates.ts`), en orden de [01]. */
export const featuredTemplateSlugs = ["magnolia", "ivory", "etoile"] as const;

export const finalCtaCopy = {
  title: "Tu historia comienza con una *invitación.*",
  description: "Empieza hoy y crea una experiencia inolvidable para tus invitados.",
  primaryCta: "Crear invitación",
  secondaryCta: "Ver plantillas",
} as const;
