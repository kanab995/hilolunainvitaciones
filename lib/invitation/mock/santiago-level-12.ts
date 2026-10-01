import type { Invitation } from "@/types/invitation";

/** Fotografías de la demostración (imágenes aprobadas, docs/ASSET_LICENSES.md §5.2). */
const DEMO_IMAGES = "/templates/level-12";
/** Todas las fotos de demostración miden 1122 × 1402 (igual que las de Magnolia). */
const PHOTO = { width: 1122, height: 1402 } as const;

/**
 * Invitación MOCK de "Santiago" (cumpleaños número 12, brief del propietario para la plantilla
 * Level 12). SOLO DATOS: ninguna referencia visual (colores, fuentes, layout…); se dibuja con
 * cualquier plantilla registrada, igual que `andreaFernandoInvitation`.
 *
 * Es contenido DISTINTO del de Andrea & Fernando a propósito: Level 12 es `eventType = "birthday"`
 * y reutilizar el contenido de una boda bajo un tema gamer no tendría sentido para el visitante.
 * `lib/invitation/mock/index.ts` y `lib/invitation/demo.ts` sirven esta invitación, sin pasar por
 * base de datos, para cualquier plantilla cuya demo deba mostrar un cumpleaños en vez de una boda.
 *
 * Las fotos son las imágenes aprobadas de la demostración (`/templates/level-12/*`): son CONTENIDO
 * de la invitación (`ImageRef`), no de la plantilla, y cada una es opcional (sin `src` se dibuja un
 * placeholder). El fondo de portada y la decoración de esquinas, en cambio, son de la plantilla
 * Level 12. La fecha es ficticia (2027); no es un dato real.
 */
export const santiagoLevel12Invitation: Invitation = {
  id: "inv_demo_santiago_level_12",
  slug: "santiago-nivel-12",
  contentVersion: 1,
  eventType: "birthday",
  templateSlug: "level-12",
  styleOverrides: {},

  names: ["Santiago"],
  event: { startsAt: "2027-11-14T17:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "Nivel 12 desbloqueado",
    tagline: "Santiago sube al Nivel 12",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Prepárate para una tarde llena de juegos, comida, retos y mucha diversión. Queremos celebrar contigo el cumpleaños número 12 de Santiago.",
      "Te esperamos para celebrar juntos este nuevo nivel.",
    ],
  },

  locations: [
    {
      id: "loc_arena",
      kind: "other",
      name: "Zona Gamer",
      addressLines: ["Av. de los Videojuegos 212", "Ciudad de México"],
      time: "17:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Zona+Gamer+Ciudad+de+Mexico",
      photo: { src: `${DEMO_IMAGES}/location-arena.png`, alt: "Entrada en forma de arco de neón sobre un piso de rejilla luminosa", ...PHOTO },
    },
  ],

  timeline: [
    { id: "tl_1", time: "17:00", label: "Llegada", icon: "other" },
    { id: "tl_2", time: "17:30", label: "Juegos y retos", icon: "party" },
    { id: "tl_3", time: "18:30", label: "Comida", icon: "dinner" },
    { id: "tl_4", time: "19:30", label: "Pastel", icon: "toast" },
    { id: "tl_5", time: "20:00", label: "Piñata y dinámica", icon: "party" },
    { id: "tl_6", time: "21:00", label: "Fin del evento", icon: "other" },
  ],

  gallery: [
    { id: "gal_controller", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Control de videojuego genérico con contorno de neón", ...PHOTO },
    { id: "gal_arcade", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Gabinetes de arcade abstractos sobre un piso en perspectiva", ...PHOTO },
    { id: "gal_trophy", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Trofeo con resplandor morado y turquesa", ...PHOTO },
    { id: "gal_levelup", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Medalla de nivel desbloqueado con barra de progreso iluminada", ...PHOTO },
    { id: "gal_balloons", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Globos de colores bajo un letrero de neón con el número 12", ...PHOTO },
  ],

  dressCode: {
    style: "Cómodo para jugar",
    description: "Ven cómodo para jugar.",
    palette: [
      { name: "Azul marino", hex: "#0a0e1f" },
      { name: "Azul eléctrico", hex: "#39e5ff" },
      { name: "Morado neón", hex: "#8b5cf6" },
      { name: "Verde lima", hex: "#9dfa5d" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Ilustración de una silueta con sudadera y gorra, sin rasgos", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu presencia es el mejor regalo, pero si deseas tener un detalle, puedes traer algo que le guste a Santiago.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalo envuelto con contorno de neón morado y turquesa", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-11-07T23:59:00-06:00",
    message: "Confirma si vienes a desbloquear este nivel con Santiago.",
    maxCompanions: 2,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "¡Gracias por ser parte de esta misión!" },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, title: "Un día *especial*" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "*Faltan*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "*Itinerario*" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Nuestros *momentos*" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Dress code", title: "Cómodo para *jugar*" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¡Nos encantaría contar *contigo!*" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
