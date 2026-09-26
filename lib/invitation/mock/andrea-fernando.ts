import type { Invitation } from "@/types/invitation";

/** Fotografías de la demostración (imágenes aprobadas, docs/ASSET_LICENSES.md §5.1). */
const DEMO_IMAGES = "/templates/magnolia";
/** Todas las fotos de demostración miden 1122 × 1402. */
const PHOTO = { width: 1122, height: 1402 } as const;

/**
 * Invitación MOCK de "Andrea & Fernando" (contenido del mockup 06). SOLO DATOS: no hay una sola
 * referencia visual (colores, fuentes, layout…). Se dibuja con cualquier plantilla registrada.
 *
 * Las fotos son las imágenes aprobadas de la demostración (`/templates/magnolia/*`): son CONTENIDO de
 * la invitación (`ImageRef`), no de la plantilla, y cada una es opcional (sin `src` se dibuja un
 * placeholder). La portada y la decoración floral, en cambio, son de la plantilla Magnolia.
 * La fecha es ficticia (2027); no es un dato real.
 */
export const andreaFernandoInvitation: Invitation = {
  id: "inv_demo_andrea_fernando",
  slug: "andrea-y-fernando",
  contentVersion: 1,
  eventType: "wedding",
  templateSlug: "magnolia",
  styleOverrides: {},

  names: ["Andrea", "Fernando"],
  event: { startsAt: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City" },

  cover: {
    eyebrow: "Nos casamos",
    tagline: "Nos encantaría celebrar contigo",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Hay momentos en la vida que se sienten distintos, que se guardan para siempre en el corazón. Este es uno de ellos.",
      "Queremos compartir contigo el inicio de nuestro para siempre, rodeados de las personas que más queremos.",
    ],
  },

  locations: [
    {
      id: "loc_ceremony",
      kind: "ceremony",
      name: "Parroquia de San Miguel Arcángel",
      addressLines: ["Calle de la Paz 123", "San Miguel de Allende, Gto."],
      time: "17:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Parroquia+de+San+Miguel+Arc%C3%A1ngel+San+Miguel+de+Allende",
      photo: { src: `${DEMO_IMAGES}/ceremony-chapel.png`, alt: "Capilla de piedra con arcos y arreglos de flores", ...PHOTO },
    },
    {
      id: "loc_reception",
      kind: "reception",
      name: "Hacienda Los Olivos",
      addressLines: ["Carretera San Miguel a Dolores Km 4", "San Miguel de Allende, Gto."],
      time: "19:00 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Hacienda+Los+Olivos+San+Miguel+de+Allende",
      photo: { src: `${DEMO_IMAGES}/reception-hacienda.png`, alt: "Patio de hacienda con mesas, luces cálidas y enredaderas floridas", ...PHOTO },
    },
  ],

  timeline: [
    { id: "tl_1", time: "17:00", label: "Ceremonia", icon: "ceremony" },
    { id: "tl_2", time: "19:00", label: "Cóctel de bienvenida", icon: "cocktail" },
    { id: "tl_3", time: "20:00", label: "Cena", icon: "dinner" },
    { id: "tl_4", time: "22:00", label: "Fiesta", icon: "party" },
    { id: "tl_5", time: "00:00", label: "Brindis", icon: "toast" },
  ],

  gallery: [
    { id: "gal_couple", src: `${DEMO_IMAGES}/gallery-couple.png`, alt: "Los novios caminando de espaldas por una calle empedrada", ...PHOTO },
    { id: "gal_bouquet", src: `${DEMO_IMAGES}/gallery-bouquet.png`, alt: "Ramo de magnolias y rosas", ...PHOTO },
    { id: "gal_rings", src: `${DEMO_IMAGES}/gallery-rings.png`, alt: "Dos anillos dorados sobre una piedra con pétalos", ...PHOTO },
    { id: "gal_table", src: `${DEMO_IMAGES}/gallery-table.png`, alt: "Mesa con vajilla, velas y flores", ...PHOTO },
  ],


  dressCode: {
    style: "Formal y elegante",
    description: "Nos encantaría que te sientas increíble y nos acompañes con un look formal.",
    palette: [
      { name: "Rosa empolvado", hex: "#ebd8d0" },
      { name: "Arena", hex: "#d9cbbb" },
      { name: "Verde salvia", hex: "#7a8b5a" },
      { name: "Verde oliva", hex: "#55603a" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Ilustración de una pareja con vestimenta formal", ...PHOTO },
  },

  giftRegistry: {
    message:
      "Si deseas tener un detalle adicional, puedes hacerlo a través de nuestra mesa de regalos.",
    entries: [
      { id: "gift_1", name: "Liverpool", url: "https://www.liverpool.com.mx/" },
      { id: "gift_2", name: "Amazon", url: "https://www.amazon.com.mx/" },
    ],
    moreUrl: "https://www.liverpool.com.mx/",
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Caja de regalo con moño rosa y magnolias", ...PHOTO },
  },

  music: {
    sourceType: "external",
    externalUrl: "https://open.spotify.com/search/Perfect%20Ed%20Sheeran",
    title: "Perfect",
    artist: "Ed Sheeran",
    autoplayAfterInteraction: false,
    volume: 0.6,
    loop: true,
  },

  rsvp: {
    enabled: true,
    deadline: "2027-04-17T23:59:00-06:00",
    message: "Por favor, confirma tu asistencia para poder organizar cada detalle de este día tan especial.",
    maxCompanions: 3,
    allowMaybe: true,
    askDietaryNotes: false,
  },

  closing: { message: "Gracias por ser parte de nuestra historia" },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, title: "Nuestra *historia*" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "*Faltan*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "*Itinerario*", subtitle: "Un día lleno de momentos especiales" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Nuestros *momentos*", subtitle: "Un poco de nuestra historia en imágenes." },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Dress code", title: "Formal y *elegante*" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos", title: "Tu presencia es nuestro mejor regalo" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "Confirma tu asistencia", title: "¡Nos encantaría contar *contigo!*" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
