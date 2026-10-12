import type { Invitation } from "@/types/invitation";

/** Ilustraciones de la demostración (aprobadas, docs/ASSET_LICENSES.md §5.7). */
const DEMO_IMAGES = "/templates/luz-de-fe";
/** Las ilustraciones verticales miden 1122 × 1402; las sedes son horizontales y declaran su propio tamaño. */
const PHOTO = { width: 1122, height: 1402 } as const;
const LANDSCAPE = { width: 1402, height: 1122 } as const;
const SQUARE = { width: 1254, height: 1254 } as const;

/**
 * Invitación MOCK de "Sofía" (Primera Comunión, brief del propietario para la plantilla Luz de Fe).
 * SOLO DATOS: ninguna referencia visual (colores, fuentes, layout…); se dibuja con cualquier
 * plantilla registrada, igual que `andreaFernandoInvitation`.
 *
 * `eventType = "baptism"`: el dominio NO tiene un tipo "primera comunión" (`EventType` solo
 * distingue WEDDING, QUINCEANERA, BAPTISM, BIRTHDAY, BABY_SHOWER, KIDS, GRADUATION y OTHER); el más
 * cercano es el bautizo (sacramento católico, mismo tono ceremonial). Se informa al propietario: agregar
 * un tipo nuevo es un cambio de esquema de base de datos que no se hizo sin aprobación.
 *
 * Mapeo de copy del brief → esquema (mismo criterio que D-39/D-43): la frase "Con alegría recibimos
 * este día de fe y amor." es la `cover.tagline` (la línea pequeña bajo el nombre) y abre la historia;
 * el evento ("Primera Comunión de Sofía") es `cover.eyebrow` + `names`.
 */
export const sofiaLuzDeFeInvitation: Invitation = {
  id: "inv_demo_sofia_luz_de_fe",
  slug: "sofia-luz-de-fe",
  contentVersion: 1,
  eventType: "baptism",
  templateSlug: "luz-de-fe",
  styleOverrides: {},

  names: ["Sofía"],
  event: { startsAt: "2027-05-08T12:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "Mi Primera Comunión",
    tagline: "Con alegría recibimos este día de fe y amor.",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Con alegría recibimos este día de fe y amor.",
      "Recibiré por primera vez a Jesús en mi corazón y quiero compartir este momento tan especial con las personas que más quiero.",
    ],
  },

  locations: [
    {
      id: "loc_parroquia",
      kind: "ceremony",
      name: "Parroquia de San Miguel Arcángel",
      addressLines: ["Calle de la Paz 120", "Querétaro, Qro."],
      time: "12:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Parroquia+de+San+Miguel+Arc%C3%A1ngel+Quer%C3%A9taro",
      photo: { src: `${DEMO_IMAGES}/location-church.png`, alt: "Interior luminoso de una iglesia con pasillo central, velas, flores blancas y un crucifijo al fondo", ...LANDSCAPE },
    },
    {
      id: "loc_jardin",
      kind: "reception",
      name: "Jardín Los Lirios",
      addressLines: ["Camino Real 45", "Querétaro, Qro."],
      time: "14:30 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Jard%C3%ADn+Los+Lirios+Quer%C3%A9taro",
      photo: { src: `${DEMO_IMAGES}/location-venue.png`, alt: "Mesa larga de recepción al aire libre bajo una pérgola con luces, flores blancas y sillas de madera", ...SQUARE },
    },
  ],

  timeline: [
    { id: "tl_1", time: "12:00", label: "Misa de Primera Comunión", icon: "ceremony" },
    { id: "tl_2", time: "13:30", label: "Fotografías familiares", icon: "other" },
    { id: "tl_3", time: "14:30", label: "Recepción familiar", icon: "cocktail" },
    { id: "tl_4", time: "15:30", label: "Comida", icon: "dinner" },
    { id: "tl_5", time: "17:00", label: "Pastel", icon: "toast" },
  ],

  gallery: [
    { id: "gal_dress", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Padre, niña con vestido blanco de primera comunión y madre, de espaldas y de la mano, caminando por una iglesia con flores", ...PHOTO },
    { id: "gal_book", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Cáliz dorado y hostia con una cruz sobre un mantel de encaje, junto a flores blancas", ...SQUARE },
    { id: "gal_chalice", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Una niña sonríe entre sus padres en una mesa decorada con flores blancas y velas", ...PHOTO },
    { id: "gal_cake", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Niña con vestido de comunión y ramo de flores blancas mira sonriendo sobre su hombro dentro de una iglesia", ...PHOTO },
    { id: "gal_candles", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Pastel blanco con una cruz y mesa de postres con velas y flores blancas", ...PHOTO },
  ],

  dressCode: {
    style: "Tonos claros y elegantes",
    description: "Te invitamos a vestir en tonos claros y sobrios: blanco, marfil, champán o azul cielo.",
    palette: [
      { name: "Marfil", hex: "#fffaf0" },
      { name: "Champán", hex: "#efe4cc" },
      { name: "Dorado suave", hex: "#c9a14a" },
      { name: "Azul cielo", hex: "#cfe0ee" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Vestido blanco con listón dorado, traje de lino beige, zapatos, rosario y flores en tonos marfil, sin marcas visibles", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu presencia es el mejor regalo. Si deseas tener un detalle para Sofía, aquí encontrarás opciones.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalos envueltos en papel marfil con listones dorados, velas y flores blancas, con un crucifijo al fondo, sin marcas visibles", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-05-01T23:59:00-06:00",
    message: "Confirma tu asistencia para acompañar a Sofía en este día tan especial.",
    maxCompanions: 3,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "Gracias por acompañarme en este día de fe y amor." },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, eyebrow: "Con alegría", title: "Un día de fe y amor" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "Faltan" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "Itinerario" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Momentos de luz" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Código de vestimenta", title: "Tonos claros" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "Nos encantará contar contigo" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
