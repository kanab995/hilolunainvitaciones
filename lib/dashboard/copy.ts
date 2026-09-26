/** Textos del panel del evento (mockup 05). Módulo de copy central (es-MX). Énfasis en cursiva: `*palabra*`. */
export const dashboardCopy = {
  banner: {
    title: "Un gran día comienza con una invitación *inolvidable.*",
    description: "Gestiona tu evento, invita a tus seres queridos y vive cada detalle en un solo lugar.",
  },
  rsvp: {
    confirmed: "Confirmados",
    pending: "Pendientes",
    declined: "No asistirán",
  },
  actions: {
    edit: { title: "Editar invitación", description: "Personaliza textos, fotos, colores y todos los detalles de tu invitación." },
    guests: { title: "Invitados", description: "Gestiona tu lista, agrega invitados y envía recordatorios." },
    rsvp: { title: "Confirmaciones", description: "Revisa en tiempo real las respuestas y estadísticas de tu evento." },
    share: { title: "Compartir", description: "Comparte tu invitación por WhatsApp, redes sociales o con un enlace directo." },
  },
  activity: { title: "Actividad reciente", action: "Ver toda la actividad", empty: "Todavía no hay actividad." },
  eventCard: { eyebrow: "Nuestro evento" },
  guestStatus: { confirmed: "Confirmado", pending: "Pendiente", declined: "No asistirá" },
  sidebarPromo: { title: "Cada historia merece una invitación *inolvidable.*", action: "Explorar plantillas" },
} as const;
