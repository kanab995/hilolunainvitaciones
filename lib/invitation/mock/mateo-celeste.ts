import type { Invitation } from "@/types/invitation";

/** Fotografías de la demostración (imágenes aprobadas, docs/ASSET_LICENSES.md §5.4). */
const DEMO_IMAGES = "/templates/celeste";
/** Todas las fotos de demostración miden 1122 × 1402 (igual que Magnolia, Level 12 y Aurora XV). */
const PHOTO = { width: 1122, height: 1402 } as const;

/**
 * Invitación MOCK de "Mateo" (bautizo, brief del propietario para la plantilla Celeste). SOLO DATOS:
 * ninguna referencia visual (colores, fuentes, layout…); se dibuja con cualquier plantilla registrada,
 * igual que `andreaFernandoInvitation`, `santiagoLevel12Invitation` y `valentinaAuroraXvInvitation`.
 *
 * Es contenido DISTINTO del de las demás demos a propósito: Celeste es `eventType = "baptism"`, con
 * un solo nombre (el bautizado) en vez de pareja. `lib/invitation/mock/index.ts` y
 * `lib/invitation/demo.ts` sirven esta invitación, sin pasar por base de datos, para `/i/demo-celeste`.
 *
 * Mapeo de copy del brief → esquema (el hero solo tiene eyebrow/nombre/frase corta, sin un cuarto ni
 * quinto campo para "Evento" y "Título principal" por separado): "Evento: Mi Bautizo" → `cover.eyebrow`
 * (coincide con el copy por defecto de bautizo en `lib/events/event-types.ts`: `cover.eyebrow = "Mi
 * bautizo"`); "Nombre: Mateo" → `names` (el nombre es el titular grande, debajo del eyebrow — junto los
 * dos ya comunican "Bautizo de Mateo", así que el "Título principal" del brief, literalmente esa misma
 * frase, no se repite aparte: sería redundante con lo que ya se lee en pantalla, mismo criterio que D-39
 * usó para Aurora XV); "Subtítulo: Con la bendición de Dios…" → `cover.tagline`; la "Frase principal" y
 * el "Mensaje de bienvenida" (los dos textos largos) se movieron tal cual, completos, a los dos párrafos
 * de `story`. El "Texto de ubicación" del brief ("Acompáñanos a celebrar…") no tiene una ranura en el
 * esquema: `LocationSection` no dibuja ningún texto compartido antes de las sedes (cada una solo
 * muestra su propio nombre/dirección/hora) en NINGUNA plantilla — no es un hueco de Celeste, es así en
 * todo el motor; añadir un campo nuevo solo para esta frase sería un cambio de esquema innecesario
 * fuera de alcance de esta tarea, así que se documenta aquí en vez de forzarlo en algún otro lado.
 */
export const mateoCelesteInvitation: Invitation = {
  id: "inv_demo_mateo_celeste",
  slug: "mateo-celeste",
  contentVersion: 1,
  eventType: "baptism",
  templateSlug: "celeste",
  styleOverrides: {},

  names: ["Mateo"],
  event: { startsAt: "2027-03-14T12:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "Mi Bautizo",
    tagline: "Con la bendición de Dios y el amor de nuestra familia",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Hoy recibo la luz de Dios y queremos compartir este momento tan especial contigo.",
      "Con mucha alegría, te invitamos a acompañarnos en el bautizo de nuestro pequeño Mateo. Será un día lleno de fe, amor y bendiciones.",
    ],
  },

  locations: [
    {
      id: "loc_ceremony",
      kind: "ceremony",
      name: "Parroquia de San Jerónimo",
      addressLines: ["Calle de la Fe 45", "Querétaro, Qro."],
      time: "12:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Parroquia+de+San+Jer%C3%B3nimo+Quer%C3%A9taro",
      photo: { src: `${DEMO_IMAGES}/location-church.png`, alt: "Interior de una parroquia luminosa decorada con flores blancas y velas", ...PHOTO },
    },
    {
      id: "loc_reception",
      kind: "reception",
      name: "Jardín Los Olivos",
      addressLines: ["Camino a los Olivos 88", "Querétaro, Qro."],
      time: "13:30 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Jard%C3%ADn+Los+Olivos+Quer%C3%A9taro",
      photo: { src: `${DEMO_IMAGES}/location-venue.png`, alt: "Jardín luminoso con flores blancas y detalles en azul cielo para la recepción", ...PHOTO },
    },
  ],

  timeline: [
    { id: "tl_1", time: "12:00", label: "Ceremonia religiosa", icon: "ceremony" },
    { id: "tl_2", time: "13:30", label: "Recepción", icon: "cocktail" },
    { id: "tl_3", time: "14:00", label: "Comida familiar", icon: "dinner" },
    { id: "tl_4", time: "15:30", label: "Fotografías", icon: "other" },
    { id: "tl_5", time: "16:00", label: "Pastel", icon: "toast" },
    { id: "tl_6", time: "17:00", label: "Agradecimiento", icon: "other" },
  ],

  gallery: [
    { id: "gal_outfit", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Detalle del ropón de bautizo con listón y cruz", ...PHOTO },
    { id: "gal_candle", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Vela de bautizo con detalles dorados", ...PHOTO },
    { id: "gal_cake", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Pastel de bautizo en tonos marfil y azul cielo", ...PHOTO },
    { id: "gal_sweets", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Mesa de dulces con decoración familiar en tonos claros", ...PHOTO },
    { id: "gal_family", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Momento familiar con luz natural y flores blancas", ...PHOTO },
  ],

  dressCode: {
    style: "Tonos claros / Formal familiar",
    description: "Nos encantaría que nos acompañes con un look formal en tonos claros para este día tan especial.",
    palette: [
      { name: "Marfil", hex: "#f3e9db" },
      { name: "Blanco perla", hex: "#f7f3ec" },
      { name: "Azul cielo suave", hex: "#cfe3ec" },
      { name: "Dorado suave", hex: "#c7a35c" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Atuendos formales familiares en tonos claros con accesorios delicados", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu presencia es el regalo más especial. Si deseas tener un detalle para Mateo, podrás encontrar la información en esta sección.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalos para bebé envueltos en tonos marfil y azul cielo", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-03-07T23:59:00-06:00",
    message: "Confirma tu asistencia para acompañarnos en este día tan especial.",
    maxCompanions: 2,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "Gracias por ser parte de esta bendición." },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, title: "Un momento *de fe*" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "*Faltan*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "*Itinerario*" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Momentos *de bendición*" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Dress code", title: "Tonos *claros*" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¡Nos encantaría contar *contigo!*" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
