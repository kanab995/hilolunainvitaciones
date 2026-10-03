import type { Invitation } from "@/types/invitation";

/** Fotografías de la demostración (imágenes aprobadas, docs/ASSET_LICENSES.md §5.6). */
const DEMO_IMAGES = "/templates/baby-bloom";
/** Todas las fotos de demostración miden 1122 × 1402 (igual que Magnolia, Level 12, Aurora XV, Celeste y Spider Friends). */
const PHOTO = { width: 1122, height: 1402 } as const;

/**
 * Invitación MOCK de "Baby Mateo" (baby shower, brief del propietario para la plantilla Baby
 * Bloom). SOLO DATOS: ninguna referencia visual (colores, fuentes, layout…); se dibuja con
 * cualquier plantilla registrada, igual que `andreaFernandoInvitation`.
 *
 * Es contenido DISTINTO del de las demás demos a propósito: Baby Bloom es `eventType =
 * "baby-shower"` (tipo exacto, ya existente en el dominio — `lib/events/event-types.ts` ya tiene
 * su configuración de alta de evento) y reutilizar el contenido de cualquier otra demo no tendría
 * sentido para quien la ve.
 *
 * Mapeo de copy del brief → esquema (mismo criterio que D-39/D-43/Spider Friends): el brief rotula
 * sus campos como "Título principal" / "Subtítulo", pero por CONTENIDO (no por el nombre del campo)
 * "Subtítulo: Baby Mateo" es literalmente el nombre del bebé → `names` (el nombre grande ya
 * comunica eso, un `tagline` que repitiera "BABY MATEO" en mayúsculas pequeñas justo debajo se leería
 * redundante); "Evento: Baby Shower" → `cover.eyebrow` (coincide con el copy por defecto de
 * `lib/events/event-types.ts`); "Título principal: Un pequeño sueño está por llegar" SÍ es una frase
 * evocadora que encaja como `cover.tagline` (la línea pequeña bajo el nombre, mismo lugar que usó
 * "Con la bendición de Dios…" en Celeste). "Frase principal" y "Mensaje de bienvenida" (los dos
 * textos largos) se movieron tal cual, completos, a los dos párrafos de `story`. El "Texto de
 * ubicación" del brief no tiene ranura en el esquema (`LocationSection` no dibuja texto compartido
 * antes de las sedes en NINGUNA plantilla) — mismo caso ya documentado en
 * `lib/invitation/mock/mateo-celeste.ts` y `lib/invitation/mock/nico-spider-friends.ts`.
 */
export const babyMateoBabyBloomInvitation: Invitation = {
  id: "inv_demo_baby_mateo_baby_bloom",
  slug: "baby-mateo-baby-bloom",
  contentVersion: 1,
  eventType: "baby-shower",
  templateSlug: "baby-bloom",
  styleOverrides: {},

  names: ["Baby Mateo"],
  event: { startsAt: "2027-06-12T16:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "Baby Shower",
    tagline: "Un pequeño sueño está por llegar",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Con amor e ilusión, esperamos la llegada de nuestro bebé.",
      "Acompáñanos a celebrar este momento tan especial rodeados de amor, alegría y buenos deseos para nuestro bebé.",
    ],
  },

  locations: [
    {
      id: "loc_jardin",
      kind: "other",
      name: "Jardín Luna Azul",
      addressLines: ["Camino de la Luna 120", "Querétaro, Qro."],
      time: "4:00 PM",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Jard%C3%ADn+Luna+Azul+Quer%C3%A9taro",
      // Única foto horizontal del set (plano abierto del jardín): dimensiones propias, no PHOTO.
      photo: { src: `${DEMO_IMAGES}/location-venue.png`, alt: "Jardín elegante decorado con globos pastel, flores y detalles dorados para baby shower", width: 1402, height: 1122 },
    },
  ],

  timeline: [
    { id: "tl_1", time: "4:00 PM", label: "Bienvenida", icon: "other" },
    { id: "tl_2", time: "4:30 PM", label: "Juegos y dinámicas", icon: "party" },
    { id: "tl_3", time: "5:30 PM", label: "Merienda", icon: "dinner" },
    { id: "tl_4", time: "6:00 PM", label: "Apertura de regalos", icon: "other" },
    { id: "tl_5", time: "6:30 PM", label: "Pastel", icon: "toast" },
    { id: "tl_6", time: "7:00 PM", label: "Agradecimiento", icon: "other" },
  ],

  gallery: [
    { id: "gal_portrait", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Retrato maternal elegante rodeado de flores y decoración de baby shower", ...PHOTO },
    { id: "gal_sweets", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Mesa de dulces con pastel, cupcakes, flores y globos en tonos pastel", ...PHOTO },
    { id: "gal_gifts", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Regalos elegantes con osito, flores y decoración en tonos pastel", ...PHOTO },
    { id: "gal_celebration", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Celebración familiar en un ambiente alegre, elegante y luminoso", ...PHOTO },
    { id: "gal_decor", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Decoración suave con globos, flores, regalos y detalles dorados", ...PHOTO },
  ],

  dressCode: {
    style: "Tonos claros / Pastel elegante",
    description: "Nos encantaría que nos acompañes con un look elegante en tonos claros y pastel para este día tan especial.",
    palette: [
      { name: "Marfil cálido", hex: "#fdf8f0" },
      { name: "Champagne", hex: "#f6ede0" },
      { name: "Azul cielo claro", hex: "#aee3ff" },
      { name: "Rosa empolvado", hex: "#e8c4c0" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Flat lay de ropa elegante en tonos claros y pastel para mamá, papá e invitados, sin marcas", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu presencia es el regalo más especial. Si deseas tener un detalle para nuestro bebé, podrás encontrar la información aquí.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalos para bebé envueltos con moños en tonos pastel, sin marcas", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-06-05T23:59:00-06:00",
    message: "Confirma tu asistencia para acompañarnos en esta celebración tan especial.",
    maxCompanions: 2,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "Gracias por ser parte de esta dulce espera." },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, title: "Un momento *de amor*" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "*Faltan*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "*Itinerario*" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Momentos *dulces*" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Dress code", title: "Tonos *claros*" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¡Nos encantaría contar *contigo!*" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
