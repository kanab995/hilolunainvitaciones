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
  title: "Invitaciones digitales que se sienten tan *especiales* como tu evento.",
  description:
    "Crea una invitación elegante con RSVP, galería, ubicación, cuenta regresiva y un enlace personalizado para compartir con tus invitados.",
  primaryCta: "Crear mi invitación",
  secondaryCta: "Ver plantillas",
  highlights: ["RSVP", "Galería", "Ubicación", "Cuenta regresiva", "QR", "Música"],
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
    description: "Explora diseños listos para bodas, XV años, bautizos y cumpleaños.",
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
  /** Genérico a propósito: sin una dirección ficticia concreta. */
  location: { name: "Ubicación del evento", address: "Se verá en el mapa de tu invitación" },
  /** Genérico a propósito: sin nombres de tiendas reales (docs/PROJECT_SPEC.md Q-05). */
  gifts: ["Mesa 1", "Tienda", "Sobre"],
  /** Genérico a propósito: sin título/artista reales. Solo UI de demostración: no se reproduce ni se integra ningún servicio de música. */
  music: { title: "Tu canción especial", artist: "Artista" },
  calendar: "Agregar al calendario",
} as const;

export const featuredTemplatesCopy = {
  title: "Plantillas que se sienten como tu *evento*",
  description: "Explora estilos elegantes, modernos, florales y editoriales",
  cta: "Ver todas las plantillas",
} as const;

/**
 * Mini-collage de la tarjeta "Galería" (`FeatureShowcase`): una foto real de 3 de las plantillas
 * listas, no un placeholder con degradado. Rutas directas (ya aprobadas, `docs/ASSET_LICENSES.md`
 * §5.2–5.4): es una composición de marketing, no la invitación en sí, así que no pasa por el motor.
 */
export const galleryShowcaseImages = [
  { src: "/templates/aurora-xv/gallery-1.png", alt: "" },
  { src: "/templates/celeste/gallery-1.png", alt: "" },
  { src: "/templates/level-12/gallery-1.png", alt: "" },
] as const;

export const finalCtaCopy = {
  title: "Tu historia comienza con una *invitación.*",
  description: "Elige una plantilla, personaliza tu evento y comparte una experiencia elegante con tus invitados.",
  primaryCta: "Crear invitación",
  secondaryCta: "Ver plantillas",
} as const;
