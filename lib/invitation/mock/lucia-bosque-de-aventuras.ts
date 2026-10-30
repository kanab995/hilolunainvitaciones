import type { Invitation } from "@/types/invitation";

/** Imágenes de la demostración: assets aportados por el propietario (docs/ASSET_LICENSES.md §5.10). */
const DEMO_IMAGES = "/templates/bosque-de-aventuras";
/** Medidas reales (verificadas el 2026-10-30 con el juego final; las comprueba `tests/invitation/bosque-de-aventuras.test.tsx`): sede y galería cuadradas, vestimenta y regalos verticales. */
const PORTRAIT = { width: 1122, height: 1402 } as const;
const DRESS = { width: 1072, height: 1467 } as const;
const SQUARE = { width: 1254, height: 1254 } as const;

/**
 * Invitación MOCK de "Lucía" (cumpleaños número 5, brief del propietario para la plantilla Bosque de
 * Aventuras). SOLO DATOS: ninguna referencia visual; se dibuja con cualquier plantilla registrada, igual
 * que `andreaFernandoInvitation`.
 *
 * Contenido propio a propósito (no reutiliza otra demo): Bosque de Aventuras es `eventType = "birthday"`
 * con estilo infantil y reskinar otro evento no tendría sentido para quien la ve. Identidad ORIGINAL: ningún
 * nombre, diálogo ni referencia de franquicias.
 *
 * Mapeo del brief → esquema (mismo criterio que D-39/D-43): edad → `cover.eyebrow` («¡Lucía cumple 5!»);
 * «¡Una aventura mágica está por comenzar!» → `cover.tagline`; bienvenida → `story`; cierre → `closing`; vestimenta: sin titular propio, así el encabezado es el texto configurable `dressCode.style`.
 */
export const luciaBosqueDeAventurasInvitation: Invitation = {
  id: "inv_demo_lucia_bosque_de_aventuras",
  slug: "lucia-bosque-de-aventuras",
  contentVersion: 1,
  eventType: "birthday",
  templateSlug: "bosque-de-aventuras",
  styleOverrides: {},

  names: ["Lucía"],
  event: { startsAt: "2027-06-12T16:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "¡Lucía cumple 5!",
    tagline: "¡Una aventura mágica está por comenzar!",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Entre flores, árboles y amigos del bosque, Lucía está lista para celebrar su cumpleaños número 5.",
      "Ven a compartir una tarde de juegos, pastel y muchas sorpresas. ¡Tu compañía hará esta aventura todavía más especial!",
    ],
  },

  locations: [
    {
      id: "loc_jardin",
      kind: "other",
      name: "Jardín El Bosque Encantado",
      addressLines: ["Camino de los Pinos 128", "Valle de Bravo, Estado de México"],
      time: "4:00 PM",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Camino+de+los+Pinos+128+Valle+de+Bravo",
      photo: { src: `${DEMO_IMAGES}/location-venue.png`, alt: "Salón de fiesta en el bosque con arco de globos verdes, crema y durazno, mesas decoradas y figuras de animalitos junto a la mesa del pastel", ...SQUARE },
    },
  ],

  timeline: [],

  gallery: [
    { id: "gal_cake", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Zorrito, conejo, osito y cervatillo tomando té alrededor de un pastel sobre un tocón, con una ardilla", ...SQUARE },
    { id: "gal_sweets", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Conejo, zorrito, cervatillo y tejón compartiendo pastel y té en un picnic del bosque", ...SQUARE },
    { id: "gal_party", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Fiesta de animalitos en un salón del bosque con letrero de cumpleaños, globos y un pastel con velas", ...SQUARE },
    { id: "gal_favors", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Zorrito, cervatillo, conejo, tejón y ardilla con pastel, cupcakes y regalos en un salón decorado", ...SQUARE },
    { id: "gal_picnic", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Conejo, zorrito, cervatillos y mapache alrededor de tocones en un claro decorado con globos", ...SQUARE },
  ],

  dressCode: {
    style: "Disfraz de animalito del bosque",
    description: "Ven disfrazado de tu animalito favorito del bosque o con ropa cómoda en tonos de bosque y flores. ¡Prepárate para jugar al aire libre!",
    palette: [
      { name: "Rosa campirano", hex: "#e69ba6" },
      { name: "Verde bosque", hex: "#627b51" },
      { name: "Miel", hex: "#ddae60" },
      { name: "Crema", hex: "#fff5e7" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Niñas y niños disfrazados de osito, zorrito, cervatillo, mapache y conejo junto a un perchero en el bosque", ...DRESS },
  },

  giftRegistry: {
    message: "Tu presencia es nuestro mejor regalo. Si deseas tener un detalle con Lucía, aquí encontrarás algunas ideas.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Conejo, zorrito, cervatillo y ardilla entre regalos apilados sobre tocones", ...PORTRAIT },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-06-05T23:59:00-06:00",
    message: "Cuéntanos si vienes a esta aventura en el bosque.",
    maxCompanions: 2,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "¡Gracias por ser parte de esta aventura mágica!" },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, title: "¡Bienvenidos al *bosque*!" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "Falta *poquito*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Momentos *mágicos*" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Vestimenta" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos", title: "Un detalle para *Lucía*" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¿Vienes al *bosque*?" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
