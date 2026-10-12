import type { Invitation } from "@/types/invitation";

/** Ilustraciones de la demostración (aprobadas, docs/ASSET_LICENSES.md §5.9). */
const DEMO_IMAGES = "/templates/nova-grad";
/** Las ilustraciones verticales miden 1122 × 1402; las sedes son horizontales y declaran su propio tamaño. */
const PHOTO = { width: 1122, height: 1402 } as const;
const LANDSCAPE = { width: 1402, height: 1122 } as const;

/**
 * Invitación MOCK de "Camila" (graduación, brief del propietario para la plantilla Nova Grad). SOLO
 * DATOS: ninguna referencia visual (colores, fuentes, layout…); se dibuja con cualquier plantilla
 * registrada, igual que `andreaFernandoInvitation`.
 *
 * `eventType = "graduation"` (tipo exacto, ya existente en el dominio y en el alta de eventos). Los
 * lugares son ficticios. La mesa de regalos existe como CONTENIDO pero su sección va oculta
 * (`isVisible: false`): el brief de esta demo no la incluye; el anfitrión puede mostrarla desde el
 * editor sin perder nada (regla 17).
 */
export const camilaNovaGradInvitation: Invitation = {
  id: "inv_demo_camila_nova_grad",
  slug: "camila-nova-grad",
  contentVersion: 1,
  eventType: "graduation",
  templateSlug: "nova-grad",
  styleOverrides: {},

  names: ["Camila"],
  event: { startsAt: "2027-07-17T19:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "Graduación",
    tagline: "Una nueva etapa comienza.",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Una nueva etapa comienza.",
      "Después de años de esfuerzo, desvelos y sueños, llegó el momento de celebrar. Acompáñame a cerrar este capítulo y a abrir el siguiente.",
    ],
  },

  locations: [
    {
      id: "loc_ceremonia",
      kind: "ceremony",
      name: "Auditorio Universitario Nova",
      addressLines: ["Av. del Conocimiento 300", "Guadalajara, Jal."],
      time: "17:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Auditorio+Universitario+Guadalajara",
      photo: { src: `${DEMO_IMAGES}/location-ceremony.png`, alt: "Auditorio de ceremonia con escenario iluminado, pasillo central y butacas decoradas en negro y dorado", ...LANDSCAPE },
    },
    {
      id: "loc_fiesta",
      kind: "reception",
      name: "Terraza Skyline",
      addressLines: ["Av. Américas 1500, piso 18", "Guadalajara, Jal."],
      time: "19:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Terraza+Skyline+Guadalajara",
      photo: { src: `${DEMO_IMAGES}/location-venue.png`, alt: "Salón de fiesta con mesas redondas, globos negros y dorados y vista nocturna de la ciudad", ...LANDSCAPE },
    },
  ],

  timeline: [
    { id: "tl_1", time: "17:00", label: "Ceremonia de graduación", icon: "ceremony" },
    { id: "tl_2", time: "19:00", label: "Recepción y brindis", icon: "toast" },
    { id: "tl_3", time: "20:00", label: "Cena", icon: "dinner" },
    { id: "tl_4", time: "21:30", label: "Fiesta", icon: "party" },
    { id: "tl_5", time: "01:00", label: "Cierre de la noche", icon: "other" },
  ],

  gallery: [
    { id: "gal_caps", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Graduados con toga negra y dorada lanzan sus birretes al aire entre confeti y copas de champán", ...PHOTO },
    { id: "gal_diploma", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Pastel de graduación blanco y negro con birrete y flores, junto a una mesa de postres al atardecer", ...PHOTO },
    { id: "gal_toast", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Mesa de postres y copas de champán con un birrete de graduación y la ciudad iluminada al fondo", ...LANDSCAPE },
    { id: "gal_flash", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Grupo de amigos bailando con una graduada con toga entre confeti dorado", ...PHOTO },
    { id: "gal_balloons", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Retrato de una graduada con birrete y toga negra y dorada sosteniendo su diploma, con globos al fondo", ...PHOTO },
  ],

  dressCode: {
    style: "Formal nocturno",
    description: "Elegante y con brillo: negro, dorado o champán. Es una noche para celebrar un logro.",
    palette: [
      { name: "Negro", hex: "#0b0b0f" },
      { name: "Oro", hex: "#e0b84f" },
      { name: "Champán", hex: "#f5efe0" },
      { name: "Plata", hex: "#c9ccd6" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Vestido dorado de satén, saco negro, bolso, tacones y accesorios dorados sobre mármol, sin marcas visibles", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu compañía es el mejor regalo. Si quieres tener un detalle con Camila, aquí encontrarás opciones.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalos negros y dorados con listones, flores blancas y velas, sin marcas visibles", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-07-05T23:59:00-06:00",
    message: "Confirma tu asistencia para celebrar contigo esta noche tan especial.",
    maxCompanions: 1,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "Gracias por ser parte de este logro." },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, eyebrow: "Nuevo capítulo", title: "Lo logramos" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "Cuenta regresiva" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "Itinerario" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Momentos" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Código de vestimenta", title: "Negro y oro" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: false, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¿Vienes?" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
