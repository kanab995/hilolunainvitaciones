import type { Invitation } from "@/types/invitation";

/** Fotografías de la demostración (imágenes aprobadas, docs/ASSET_LICENSES.md §5.5). */
const DEMO_IMAGES = "/templates/spider-friends";
/** Todas las fotos de demostración miden 1122 × 1402 (igual que Magnolia, Level 12, Aurora XV y Celeste). */
const PHOTO = { width: 1122, height: 1402 } as const;

/**
 * Invitación MOCK de "Nico" (cumpleaños número 6, brief del propietario para la plantilla Spider
 * Friends). SOLO DATOS: ninguna referencia visual (colores, fuentes, layout…); se dibuja con
 * cualquier plantilla registrada, igual que `andreaFernandoInvitation`.
 *
 * Es contenido DISTINTO del de las demás demos a propósito: Spider Friends es `eventType =
 * "birthday"` (fiesta infantil de superhéroes arácnidos ORIGINALES — sin personajes registrados,
 * ver docs/ASSET_LICENSES.md §5.5) y reutilizar el contenido de Santiago (cumpleaños gamer) o de
 * cualquier otra demo no tendría sentido para quien la ve.
 *
 * Mapeo de copy del brief → esquema (mismo criterio que D-39/D-43): "Título principal: ¡Nico
 * cumple 6!" → `cover.eyebrow`; "Subtítulo: Una aventura de superhéroes" → `cover.tagline`; el
 * nombre grande (`names`) ya dice "Nico", así que el eyebrow+tagline no lo repiten aparte. "Frase
 * principal" y "Mensaje de bienvenida" (los dos textos largos del brief) se movieron tal cual,
 * completos, a los dos párrafos de `story`. El "Texto de ubicación" del brief no tiene una ranura
 * en el esquema (`LocationSection` no dibuja texto compartido antes de las sedes en NINGUNA
 * plantilla, no es un hueco de Spider Friends) — mismo caso ya documentado en
 * `lib/invitation/mock/mateo-celeste.ts`.
 */
export const nicoSpiderFriendsInvitation: Invitation = {
  id: "inv_demo_nico_spider_friends",
  slug: "nico-spider-friends",
  contentVersion: 1,
  eventType: "birthday",
  templateSlug: "spider-friends",
  styleOverrides: {},

  names: ["Nico"],
  event: { startsAt: "2027-05-15T16:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "¡Nico cumple 6!",
    tagline: "Una aventura de superhéroes",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Prepara tu antifaz y ven a celebrar una misión llena de juegos, pastel y mucha diversión.",
      "Nuestro pequeño héroe está listo para celebrar su cumpleaños número 6 y queremos que seas parte de esta gran aventura.",
    ],
  },

  locations: [
    {
      id: "loc_salon",
      kind: "other",
      name: "Salón Ciudad Aventura",
      addressLines: ["Av. de los Héroes 456", "Ciudad de México"],
      time: "4:00 PM",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n+Ciudad+Aventura+Ciudad+de+M%C3%A9xico",
      photo: { src: `${DEMO_IMAGES}/location-venue.png`, alt: "Salón infantil decorado con globos rojos, azules y amarillos y telarañas genéricas", ...PHOTO },
    },
  ],

  timeline: [
    { id: "tl_1", time: "4:00 PM", label: "Llegada de pequeños héroes", icon: "other" },
    { id: "tl_2", time: "4:30 PM", label: "Juegos y misiones", icon: "party" },
    { id: "tl_3", time: "5:30 PM", label: "Comida", icon: "dinner" },
    { id: "tl_4", time: "6:00 PM", label: "Pastel", icon: "toast" },
    { id: "tl_5", time: "6:30 PM", label: "Piñata", icon: "party" },
    { id: "tl_6", time: "7:00 PM", label: "Despedida", icon: "other" },
  ],

  gallery: [
    { id: "gal_cake", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Pastel infantil con telarañas genéricas, ciudad y el número 6", ...PHOTO },
    { id: "gal_sweets", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Mesa de cupcakes en tonos rojo, azul y amarillo", ...PHOTO },
    { id: "gal_kids", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Niños con antifaces genéricos celebrando el cumpleaños", ...PHOTO },
    { id: "gal_favors", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Bolsas de regalo con decoración de ciudad y telarañas genéricas", ...PHOTO },
    { id: "gal_table", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Mesa decorada con platos, vasos y temática de superhéroes arácnidos", ...PHOTO },
  ],

  dressCode: {
    style: "Disfraz de héroe o ropa cómoda",
    description: "Ven con tu outfit de héroe favorito o ropa cómoda para jugar.",
    palette: [
      { name: "Rojo brillante", hex: "#e33a3a" },
      { name: "Azul héroe", hex: "#2457c9" },
      { name: "Amarillo acento", hex: "#ffcc33" },
      { name: "Celeste", hex: "#aee3ff" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Sudadera, antifaz genérico, tenis sin marca y capa en rojo, azul y amarillo", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu presencia es el mejor regalo. Si deseas tener un detalle para Nico, puedes encontrar la información aquí.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalos infantiles envueltos con globos y decoración de ciudad", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-05-08T23:59:00-06:00",
    message: "Confirma si vienes a esta misión especial.",
    maxCompanions: 2,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "¡Gracias por ser parte de esta aventura!" },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, title: "Una *misión* especial" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "*Faltan*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "*Itinerario*" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Momentos de *aventura*" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Dress code", title: "Viste como *héroe*" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¡Únete a la *misión!*" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
