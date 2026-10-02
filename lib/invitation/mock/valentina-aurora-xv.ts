import type { Invitation } from "@/types/invitation";

/** Fotografías de la demostración (imágenes aprobadas, docs/ASSET_LICENSES.md §5.3). */
const DEMO_IMAGES = "/templates/aurora-xv";
/** La mayoría de las fotos de demostración miden 1122 × 1402 (igual que Magnolia y Level 12); las sedes
 * y `gallery-4` son horizontales y declaran su propio `width`/`height` junto a su `src`. */
const PHOTO = { width: 1122, height: 1402 } as const;

/**
 * Invitación MOCK de "Valentina" (XV años, brief del propietario para la plantilla Aurora XV).
 * SOLO DATOS: ninguna referencia visual (colores, fuentes, layout…); se dibuja con cualquier
 * plantilla registrada, igual que `andreaFernandoInvitation` y `santiagoLevel12Invitation`.
 *
 * Es contenido DISTINTO del de Andrea & Fernando y de Santiago a propósito: Aurora XV es
 * `eventType = "quinceanera"`, con un solo nombre (festejada) en vez de pareja. `lib/invitation/mock/index.ts`
 * y `lib/invitation/demo.ts` sirven esta invitación, sin pasar por base de datos, para `/i/demo-aurora-xv`.
 *
 * Mapeo de copy del brief → esquema (el hero solo tiene eyebrow/nombre/frase corta, sin un cuarto
 * campo para una frase larga): "Título principal: Mis XV años" → `cover.eyebrow` (coincide con el
 * copy por defecto de XV años en `lib/events/event-types.ts`); "Subtítulo: Valentina" → `names` (el
 * nombre es el titular grande); la "Frase principal" (el texto largo y poético) y el "Mensaje de
 * bienvenida" se movieron tal cual, tu texto completo, a los dos párrafos de `story` — en la tarjeta
 * de la portada un texto tan largo en mayúsculas pequeñas se vería apretado y rompería "sin texto
 * encimado"; en la sección de historia tienen todo el espacio para respirar. El tagline de portada
 * queda corto, en el mismo tono.
 */
export const valentinaAuroraXvInvitation: Invitation = {
  id: "inv_demo_valentina_aurora_xv",
  slug: "valentina-aurora-xv",
  contentVersion: 1,
  eventType: "quinceanera",
  templateSlug: "aurora-xv",
  styleOverrides: {},

  names: ["Valentina"],
  event: { startsAt: "2027-02-14T17:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "Mis XV años",
    tagline: "Acompáñame a vivir este sueño",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Hay momentos que se sueñan toda la vida… y hoy quiero compartir este contigo.",
      "Con mucha ilusión, te invito a celebrar conmigo una noche llena de alegría, música y recuerdos inolvidables.",
    ],
  },

  locations: [
    {
      id: "loc_ceremony",
      kind: "ceremony",
      name: "Parroquia de San Jerónimo",
      addressLines: ["Calle de la Fe 45", "Querétaro, Qro."],
      time: "17:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Parroquia+de+San+Jer%C3%B3nimo+Quer%C3%A9taro",
      photo: { src: `${DEMO_IMAGES}/location-church.png`, alt: "Interior de una parroquia luminosa decorada con flores claras", width: 1448, height: 1086 },
    },
    {
      id: "loc_reception",
      kind: "reception",
      name: "Salón Aurora",
      addressLines: ["Av. de las Rosas 120", "Querétaro, Qro."],
      time: "18:30 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n+Aurora+Quer%C3%A9taro",
      photo: { src: `${DEMO_IMAGES}/location-salon.png`, alt: "Salón elegante con mesas, flores y luces cálidas para la recepción", width: 1402, height: 1122 },
    },
  ],

  timeline: [
    { id: "tl_1", time: "17:00", label: "Ceremonia", icon: "ceremony" },
    { id: "tl_2", time: "18:30", label: "Recepción", icon: "cocktail" },
    { id: "tl_3", time: "19:00", label: "Entrada de la quinceañera", icon: "toast" },
    { id: "tl_4", time: "20:00", label: "Cena", icon: "dinner" },
    { id: "tl_5", time: "21:00", label: "Vals", icon: "party" },
    { id: "tl_6", time: "22:00", label: "Baile y celebración", icon: "party" },
  ],

  gallery: [
    { id: "gal_dress", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Detalle del vestido de XV años con bordado y perlas", ...PHOTO },
    { id: "gal_friends", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Momento con amigas, entre risas y flores", ...PHOTO },
    { id: "gal_cake", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Pastel de XV años con flores y tonos champagne", ...PHOTO },
    { id: "gal_sweets", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Mesa de dulces con decoración floral elegante", width: 1402, height: 1122 },
    { id: "gal_waltz", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Vals en la pista de baile con luces cálidas", ...PHOTO },
  ],

  dressCode: {
    style: "Formal elegante",
    description: "Nos encantaría que nos acompañes con un look formal y elegante para esta noche tan especial.",
    palette: [
      { name: "Marfil", hex: "#f3e8db" },
      { name: "Rosa empolvado", hex: "#e8c7bf" },
      { name: "Champagne", hex: "#d9b98a" },
      { name: "Dorado suave", hex: "#c79a5c" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Atuendos formales elegantes con accesorios en tonos champagne", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu presencia es el regalo más especial. Si deseas tener un detalle conmigo, podrás encontrar la información de mesa de regalos en esta sección.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalos envueltos con moños y flores en tonos champagne", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-02-07T23:59:00-06:00",
    message: "Confirma tu asistencia para acompañarme en esta noche tan especial.",
    maxCompanions: 2,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "Gracias por formar parte de este sueño." },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, title: "Un sueño *hecho realidad*" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "*Faltan*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "*Itinerario*" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Momentos *inolvidables*" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Dress code", title: "Formal *elegante*" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¡Nos encantaría contar *contigo!*" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
