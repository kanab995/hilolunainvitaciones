import type { Invitation } from "@/types/invitation";

/** Ilustraciones de la demostración (aprobadas, docs/ASSET_LICENSES.md §5.8). */
const DEMO_IMAGES = "/templates/mar-de-amor";
/** Las ilustraciones verticales miden 1122 × 1402; las sedes son horizontales y declaran su propio tamaño. */
const PHOTO = { width: 1122, height: 1402 } as const;
const LANDSCAPE = { width: 1402, height: 1122 } as const;

/**
 * Invitación MOCK de "Valeria & Mateo" (boda en playa, brief del propietario para la plantilla Mar de
 * Amor). SOLO DATOS: ninguna referencia visual (colores, fuentes, layout…); se dibuja con cualquier
 * plantilla registrada, igual que `andreaFernandoInvitation`.
 *
 * `eventType = "wedding"` (tipo exacto: una boda en playa es una boda). Es contenido DISTINTO del de
 * Andrea & Fernando a propósito: si Mar de Amor reutilizara esa base, el lugar, la hora y el dress code
 * de una boda en jardín contradecirían el tema de playa. Los nombres y lugares son ficticios.
 */
export const valeriaMateoMarDeAmorInvitation: Invitation = {
  id: "inv_demo_valeria_mateo_mar_de_amor",
  slug: "valeria-mateo-mar-de-amor",
  contentVersion: 1,
  eventType: "wedding",
  templateSlug: "mar-de-amor",
  styleOverrides: {},

  names: ["Valeria", "Mateo"],
  event: { startsAt: "2027-11-06T17:30:00-05:00", timezone: "America/Cancun" },

  cover: {
    eyebrow: "Nuestra boda",
    tagline: "Nos encontramos frente al mar para celebrar nuestro amor.",
    openLabel: "Abrir invitación",
  },

  story: {
    paragraphs: [
      "Nos encontramos frente al mar para celebrar nuestro amor.",
      "Con los pies en la arena y el atardecer de testigo, queremos compartir contigo el día en que decimos que sí.",
    ],
  },

  locations: [
    {
      id: "loc_playa",
      kind: "ceremony",
      name: "Playa Palmar del Sol",
      addressLines: ["Zona costera, km 12", "Tulum, Q. Roo"],
      time: "17:30 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Playa+Tulum+Quintana+Roo",
      photo: { src: `${DEMO_IMAGES}/location-ceremony.png`, alt: "Arco floral y pasillo con pétalos frente al mar al atardecer, con sillas de madera a los lados", ...LANDSCAPE },
    },
    {
      id: "loc_terraza",
      kind: "reception",
      name: "Terraza Brisa Marina",
      addressLines: ["Boulevard de la Costa 210", "Tulum, Q. Roo"],
      time: "19:30 hrs",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Terraza+Tulum+Quintana+Roo",
      photo: { src: `${DEMO_IMAGES}/location-venue.png`, alt: "Mesas largas con flores y velas bajo árboles con luces colgantes, frente al mar al atardecer", ...LANDSCAPE },
    },
  ],

  timeline: [
    { id: "tl_1", time: "17:30", label: "Ceremonia en la playa", icon: "ceremony" },
    { id: "tl_2", time: "18:30", label: "Brindis al atardecer", icon: "toast" },
    { id: "tl_3", time: "19:30", label: "Cena bajo las luces", icon: "dinner" },
    { id: "tl_4", time: "21:00", label: "Baile", icon: "party" },
    { id: "tl_5", time: "23:30", label: "Despedida", icon: "other" },
  ],

  gallery: [
    { id: "gal_shells", src: `${DEMO_IMAGES}/gallery-1.png`, alt: "Pareja de novios caminando de la mano por la orilla de la playa al atardecer", ...PHOTO },
    { id: "gal_sunset", src: `${DEMO_IMAGES}/gallery-2.png`, alt: "Pareja de novios abrazada junto a un arco de flores con el mar de fondo", ...PHOTO },
    { id: "gal_flowers", src: `${DEMO_IMAGES}/gallery-3.png`, alt: "Pareja de novios bailando al anochecer bajo luces colgantes frente al mar", ...PHOTO },
    { id: "gal_table", src: `${DEMO_IMAGES}/gallery-4.png`, alt: "Pastel de bodas blanco de tres pisos con flores y conchas, junto a velas y postres frente al mar", ...PHOTO },
    { id: "gal_palms", src: `${DEMO_IMAGES}/gallery-5.png`, alt: "Mesa de banquete con platos, copas, flores, conchas y velas frente al mar", ...PHOTO },
  ],

  dressCode: {
    style: "Lino, tonos arena y blanco",
    description: "Playa elegante: lino ligero en tonos arena o blanco. Te recomendamos calzado cómodo para caminar sobre la arena.",
    palette: [
      { name: "Blanco", hex: "#fffaf0" },
      { name: "Arena", hex: "#e4cfa8" },
      { name: "Lino", hex: "#efe3cc" },
      { name: "Terracota suave", hex: "#e98a5b" },
    ],
    illustration: { src: `${DEMO_IMAGES}/dress-code.png`, alt: "Vestido de lino estampado, saco beige, camisa, pantalón, sandalias y sombrero de paja en tonos arena, sin marcas visibles", ...PHOTO },
  },

  giftRegistry: {
    message: "Tu presencia en este día es nuestro mejor regalo. Si quieres tener un detalle con nosotros, aquí encontrarás opciones.",
    entries: [],
    photo: { src: `${DEMO_IMAGES}/gift-registry.png`, alt: "Regalos envueltos en papel claro con listones y flores blancas, con conchas y el mar al fondo, sin marcas visibles", ...PHOTO },
  },

  rsvp: {
    enabled: true,
    deadline: "2027-10-15T23:59:00-05:00",
    message: "Confirma tu asistencia para acompañarnos frente al mar.",
    maxCompanions: 1,
    allowMaybe: true,
    askDietaryNotes: true,
  },

  closing: { message: "Gracias por ser parte de nuestra historia." },

  sections: [
    { id: "sec_hero", type: "hero", isVisible: true },
    { id: "sec_story", type: "story", isVisible: true, eyebrow: "Frente al mar", title: "Nuestra *historia*" },
    { id: "sec_countdown", type: "countdown", isVisible: true, title: "*Faltan*" },
    { id: "sec_locations", type: "locations", isVisible: true },
    { id: "sec_timeline", type: "timeline", isVisible: true, title: "*Itinerario*" },
    { id: "sec_gallery", type: "gallery", isVisible: true, eyebrow: "Galería", title: "Postales *del mar*" },
    { id: "sec_dresscode", type: "dressCode", isVisible: true, eyebrow: "Dress code", title: "Lino y *arena*" },
    { id: "sec_gifts", type: "giftRegistry", isVisible: true, eyebrow: "Mesa de regalos" },
    { id: "sec_rsvp", type: "rsvp", isVisible: true, eyebrow: "RSVP", title: "¿Nos *acompañas?*" },
    { id: "sec_footer", type: "footer", isVisible: true },
  ],
};
