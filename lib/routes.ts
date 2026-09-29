/**
 * Mapa tipado de rutas. Fuente única para enlaces internos (docs/ROUTES.md).
 * Sin lógica de negocio: solo construcción de paths.
 */
export const routes = {
  home: "/",
  templates: "/templates",
  template: (slug: string) => `/templates/${slug}`,
  /** Galería filtrada por categoría (`?category=wedding|quinceanera|…`, docs/ROUTES.md §5). */
  templatesByCategory: (category: string) => `/templates?category=${category}`,

  /** Invitación de demostración de una plantilla ("Ver invitación completa" [03]). Ruta temporal. */
  templateDemo: (slug: string) => `/i/demo-${slug}`,
  newEvent: "/dashboard/events/new",
  /** Alta de evento con intención de plan (`?plan=essential|premium`): tras crearlo se abre el panel de mejora de ese evento. */
  newEventWithPlan: (plan: string) => `/dashboard/events/new?plan=${plan.toLowerCase()}`,
  /** Alta de evento con la plantilla elegida ("Usar esta plantilla" [03]). Ruta temporal (sin flujo todavía). */
  newEventFromTemplate: (slug: string) => `/dashboard/events/new?template=${slug}`,

  /** Anclas de la home. */
  howItWorks: "/#how-it-works",

  /** Planes y precios (D-31). */
  pricing: "/pricing",
  /** Marketing sin página todavía (docs/ROUTES.md §1.2): hoy responden con el 404 del producto. */
  contact: "/contact",
  terms: "/terms",
  privacy: "/privacy",

  /** Compras y planes (D-32): el plan de cada evento y lo pagado. El regreso del pago vuelve al dashboard del evento (`?payment=success|canceled`; NO activa nada: la autoridad es el webhook). */
  billing: "/dashboard/billing",
  /** Panel «Mejorar evento» abierto en el dashboard de un evento (`?upgrade=1|essential|premium`). */
  eventUpgrade: (id: string, plan?: string) => `/dashboard/events/${id}?upgrade=${plan ? plan.toLowerCase() : "1"}`,
  /** Webhook del proveedor de cobro (D-31). Sin sesión: se autentica con la firma del proveedor. */
  billingWebhook: "/api/webhooks/stripe",

  /** Consola interna (D-33). Todas exigen sesión Y el rol ADMIN (`requireAdmin()`); un usuario normal recibe 404. */
  admin: "/admin",
  adminUsers: "/admin/users",
  adminUser: (id: string) => `/admin/users/${id}`,
  adminEvents: "/admin/events",
  adminEvent: (id: string) => `/admin/events/${id}`,
  adminTemplates: "/admin/templates",
  adminPurchases: "/admin/purchases",
  adminPurchase: (id: string) => `/admin/purchases/${id}`,
  adminWebhooks: "/admin/webhooks",
  adminAudit: "/admin/audit",
  /** Envíos de correo transaccional (D-36): solo lectura, destinatario enmascarado. */
  adminEmails: "/admin/emails",

  dashboard: "/dashboard",
  events: "/dashboard/events",
  event: (id: string) => `/dashboard/events/${id}`,
  eventEdit: (id: string) => `/dashboard/events/${id}/edit`,
  eventGuests: (id: string) => `/dashboard/events/${id}/guests`,
  eventRsvp: (id: string) => `/dashboard/events/${id}/rsvp`,
  eventSettings: (id: string) => `/dashboard/events/${id}/settings`,
  eventMessages: (id: string) => `/dashboard/events/${id}/messages`,

  /** Invitación pública (decisión del propietario: prefijo /i/). */
  invitation: (slug: string) => `/i/${slug}`,
  /** Evento de calendario (`.ics`) de la versión PUBLICADA de la invitación (D-30). Pública, sin sesión. */
  invitationCalendar: (slug: string) => `/i/${slug}/calendar.ics`,

  /** Acceso (Clerk). `/login` y `/register` redirigen aquí (next.config.ts). */
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;
