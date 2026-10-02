import type { EventCategoryId } from "@/types/marketing";
import type {
  Template,
  TemplateCategoryFilter,
  TemplateFeatureId,
  TemplateScreen,
  TemplateStyleId,
} from "@/types/templates";

/**
 * Contenido de la galería (mockup 02) y del detalle (mockup 03) de plantillas, y catálogo.
 * Sin lógica. El catálogo de `templates` es la FUENTE DEL SEED (`server/seed/demo-data.ts` → tabla `Template`)
 * y todavía lo leen directamente la home y el diálogo de plantillas del editor; `/templates` y
 * `/templates/[slug]` ya lo leen de la base de datos (`server/repositories/templates.ts`). Deuda: migrar
 * esos dos consumidores para que la BD sea la única fuente. Las imágenes son
 * placeholders hasta que existan los assets aprobados (docs/ASSET_LICENSES.md §5).
 */

export const templatesPageCopy = {
  eyebrow: "Diseños para momentos inolvidables",
  title: "Plantillas",
  subtitle: "Encuentra un diseño que se sienta como tú.",
  description:
    "Explora nuestra colección de invitaciones digitales, creadas para cada historia, cada estilo y cada celebración.",
  metaDescription:
    "Explora plantillas de invitaciones digitales para bodas, XV años, bautizos y baby showers, y elige la que se sienta como tú.",
  filtersLabel: "Filtrar por categoría",
  allCategories: "Todas",
  styleLabel: "Filtrar por estilo",
  allStyles: "Todos los estilos",
  empty: {
    title: "No encontramos plantillas con esos filtros",
    description: "Prueba con otra categoría o estilo para ver más diseños.",
    action: "Ver todas las plantillas",
  },
} as const;

/** Copy del detalle de plantilla (mockup 03). */
export const templateDetailCopy = {
  breadcrumbRoot: "Plantillas",
  featuresTitle: "Incluye en tu invitación",
  useTemplate: "Usar esta plantilla",
  viewDemo: "Ver invitación completa",
  viewDemoHint: "(se abre en una pestaña nueva)",
  previewLabel: "Vista previa de la invitación",
  screensLabel: "Secciones de la invitación",
  status: {
    comingSoon: {
      badge: "Próximamente",
      note: "Estamos terminando el diseño de esta plantilla. Muy pronto podrás usarla.",
    },
    concept: {
      badge: "Vista conceptual",
      note: "Esta plantilla está en diseño: la vista previa es solo una muestra y la invitación completa aún no está aprobada.",
    },
  },
  related: {
    title: "Otros diseños que *podrían gustarte*",
    description: "Descubre más plantillas con un estilo similar.",
    cta: "Ver todas las plantillas",
  },
} as const;

/** Nombre singular de cada tipo de evento (metadatos de la tarjeta). */
export const eventTypeLabels: Record<EventCategoryId, string> = {
  wedding: "Boda",
  quinceanera: "XV años",
  baptism: "Bautizo",
  birthday: "Cumpleaños",
  "baby-shower": "Baby Shower",
  kids: "Infantil",
  graduation: "Graduación",
  other: "Otro",
};

export const styleLabels: Record<TemplateStyleId, string> = {
  floral: "Floral",
  romantic: "Romántica",
  minimal: "Minimal",
  elegant: "Elegante",
  rustic: "Rústico",
  modern: "Moderno",
  destination: "Destination",
  themed: "Temático",
  kids: "Infantil",
};

/** Título y descripción de cada función incluida ([03]: "INCLUYE EN TU INVITACIÓN"). */
export const templateFeatureCopy: Record<TemplateFeatureId, { title: string; description: string }> = {
  music: { title: "Música", description: "Añade tu canción especial" },
  rsvp: { title: "RSVP", description: "Confirma la asistencia" },
  gallery: { title: "Galería", description: "Comparte sus mejores fotos" },
  countdown: { title: "Cuenta regresiva", description: "Cuenta los días al gran día" },
  location: { title: "Ubicación", description: "Con mapa interactivo" },
  gifts: { title: "Mesa de regalos", description: "Comparte tu mesa de regalos" },
};

/**
 * Chips de categoría, en el orden del mockup [02]. El chip "Infantil" incluye también las
 * plantillas de estilo infantil (Safari es "Baby Shower · Infantil" en [02]; ver Q-14 en
 * docs/PROJECT_SPEC.md). "Cumpleaños" no tiene chip en [02]: sigue siendo un valor válido de
 * `?category=` (enlace desde la home) y muestra el estado sin resultados.
 */
export const categoryFilters: readonly TemplateCategoryFilter[] = [
  { id: "wedding", label: "Bodas", eventTypes: ["wedding"] },
  { id: "quinceanera", label: "XV años", eventTypes: ["quinceanera"] },
  { id: "kids", label: "Infantil", eventTypes: ["kids"], styles: ["kids"] },
  { id: "baptism", label: "Bautizo", eventTypes: ["baptism"] },
  { id: "baby-shower", label: "Baby Shower", eventTypes: ["baby-shower"] },
];

/** Funciones y pantallas que hoy incluyen todas las plantillas (MOCK). Cada plantilla podrá tener las suyas. */
const standardFeatures: readonly TemplateFeatureId[] = ["music", "rsvp", "gallery", "countdown", "location", "gifts"];
const standardScreens: readonly TemplateScreen[] = [
  { id: "cover", label: "Portada" },
  { id: "story", label: "Nuestra historia" },
  { id: "details", label: "Detalles" },
  { id: "gallery", label: "Galería" },
];

/** Catálogo MOCK en el orden de [02]. `premium` es solo un dato: los mockups no muestran distintivo. */
export const templates: readonly Template[] = [
  {
    id: "tpl_magnolia",
    slug: "magnolia",
    name: "Magnolia",
    status: "implemented",
    eventType: "wedding",
    style: "floral",
    secondaryStyles: ["romantic"],
    thumbnail: { alt: "Plantilla Magnolia", tone: "blush" },
    description:
      "Un diseño elegante y atemporal inspirado en la belleza de las magnolias. Ideal para parejas que buscan una invitación romántica, sofisticada y llena de detalles naturales.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Nuestra boda",
        names: ["Andrea", "&", "Fernando"],
        date: "12 de junio de 2027",
        venue: ["Jardín Los Olivos", "Valle de Guadalupe"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_ivory",
    slug: "ivory",
    name: "Ivory",
    status: "concept",
    eventType: "wedding",
    style: "minimal",
    secondaryStyles: ["elegant"],
    thumbnail: { alt: "Plantilla Ivory", tone: "sage" },
    description:
      "Papel marfil, ramas de olivo y mucho aire. Un minimalismo cálido para parejas que prefieren una invitación serena, limpia y elegante.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Nuestra boda",
        names: ["Valentina", "&", "Rodrigo"],
        date: "12 de junio de 2027",
        venue: ["Hacienda Los Olivos", "Valle de Guadalupe"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_etoile",
    slug: "etoile",
    name: "Étoile",
    status: "concept",
    eventType: "quinceanera",
    style: "elegant",
    thumbnail: { alt: "Plantilla Étoile", tone: "blush" },
    description:
      "Rosa suave, destellos dorados y un moño delicado. Pensada para unos XV años elegantes, con un toque de magia y mucho brillo.",
    premium: true,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Mis XV años",
        names: ["Camila"],
        date: "12 de septiembre de 2027",
        venue: ["Salón Las Estrellas", "Guadalajara"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_level_12",
    slug: "level-12",
    name: "Level 12",
    status: "implemented",
    eventType: "birthday",
    style: "themed",
    thumbnail: { alt: "Plantilla Level 12", tone: "sand" },
    description:
      "Una invitación gamer, arcade y llena de neón para celebrar un cumpleaños que sube de nivel. Ideal para festejados de 10 a 13 años que quieren una fiesta con mucha energía.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Nivel 12 desbloqueado",
        names: ["Santiago"],
        date: "14 de noviembre de 2027",
        venue: ["Zona Gamer"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_aurora_xv",
    slug: "aurora-xv",
    name: "Aurora XV",
    status: "implemented",
    eventType: "quinceanera",
    style: "elegant",
    secondaryStyles: ["romantic"],
    thumbnail: { alt: "Plantilla Aurora XV", tone: "blush" },
    description:
      "Una invitación romántica y luminosa para unos XV años premium: marfil cálido, rosa empolvado y dorado suave, con flores claras y detalles de lujo discreto.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Mis XV años",
        names: ["Valentina"],
        date: "14 de febrero de 2027",
        venue: ["Salón Aurora", "Querétaro"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_celeste",
    slug: "celeste",
    name: "Celeste",
    status: "implemented",
    eventType: "baptism",
    style: "elegant",
    secondaryStyles: ["romantic"],
    thumbnail: { alt: "Plantilla Celeste", tone: "cream" },
    description:
      "Una invitación tierna y luminosa para un bautizo premium: marfil cálido, blanco perla y azul cielo muy suave, con flores blancas, velas y detalles dorados delicados.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Mi bautizo",
        names: ["Mateo"],
        date: "14 de marzo de 2027",
        venue: ["Jardín Los Olivos", "Querétaro"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_tuscany",
    slug: "tuscany",
    name: "Tuscany",
    status: "comingSoon",
    eventType: "wedding",
    style: "rustic",
    thumbnail: { alt: "Plantilla Tuscany", tone: "sand" },
    description:
      "Paisaje toscano, cipreses y olivos sobre papel de algodón. Una invitación rústica y cálida para celebrar al aire libre.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Nuestra boda",
        names: ["Sofía", "&", "Mateo"],
        date: "24 de mayo de 2027",
        venue: ["Finca Los Cipreses", "Querétaro"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_noir",
    slug: "noir",
    name: "Noir",
    status: "comingSoon",
    eventType: "wedding",
    style: "modern",
    thumbnail: { alt: "Plantilla Noir", tone: "sand" },
    description:
      "Fondo oscuro con línea dorada. Una propuesta moderna y dramática para bodas de noche llenas de personalidad.",
    premium: true,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Nuestra boda",
        names: ["Valentina", "&", "Rodrigo"],
        date: "12 de junio de 2027",
        venue: ["Casa Noir", "Ciudad de México"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_blossom",
    slug: "blossom",
    name: "Blossom",
    status: "comingSoon",
    eventType: "baptism",
    style: "floral",
    thumbnail: { alt: "Plantilla Blossom", tone: "blush" },
    description:
      "Flores rosadas y una cruz discreta. Una invitación tierna y delicada para dar la bienvenida a un día muy especial.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Mi bautizo",
        names: ["Emilia"],
        date: "20 de abril de 2027",
        venue: ["Parroquia San José", "Puebla"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_riviera",
    slug: "riviera",
    name: "Riviera",
    status: "comingSoon",
    eventType: "wedding",
    style: "destination",
    thumbnail: { alt: "Plantilla Riviera", tone: "cream" },
    description:
      "Limoneros, arcos blancos y mar azul. Pensada para bodas de destino con aire mediterráneo y mucha luz.",
    premium: true,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Nuestra boda",
        names: ["Isabella", "&", "Marcelo"],
        date: "12 de junio de 2027",
        venue: ["Hotel Vista al Mar", "Los Cabos"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_dream",
    slug: "dream",
    name: "Dream",
    status: "comingSoon",
    eventType: "quinceanera",
    style: "themed",
    thumbnail: { alt: "Plantilla Dream", tone: "blush" },
    description:
      "Un castillo de cuento entre nubes rosadas. Ideal para unos XV años temáticos que parecen sacados de un sueño.",
    premium: true,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Mis XV años",
        names: ["Valentina"],
        date: "18 de septiembre de 2027",
        venue: ["Salón Castillo", "Monterrey"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
  {
    id: "tpl_safari",
    slug: "safari",
    name: "Safari",
    status: "comingSoon",
    eventType: "baby-shower",
    style: "kids",
    thumbnail: { alt: "Plantilla Safari", tone: "sage" },
    description:
      "Un leoncito entre hojas verdes. Una invitación llena de ternura para recibir al bebé con una fiesta de selva.",
    premium: false,
    minimumPlan: "FREE",
    features: standardFeatures,
    preview: {
      sample: {
        eyebrow: "Mi baby shower",
        names: ["Mateo"],
        date: "8 de mayo de 2027",
        venue: ["Jardín Las Palmas", "Mérida"],
        button: "Abrir invitación",
      },
      screens: standardScreens,
    },
  },
];

export function getTemplateBySlug(slug: string): Template | undefined {
  return templates.find((template) => template.slug === slug);
}
