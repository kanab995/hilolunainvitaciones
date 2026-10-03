import type { FeatureId, LimitId, PlanId } from "@/lib/billing/plans";
import type { PurchaseStatusId } from "@/lib/billing/purchase";

/** Textos de planes y compras (módulo central de copy; español México/LatAm). Modelo: un pago único por evento. */
export const billingCopy = {
  /** Mensajes de límite (los que ven quienes llegan a la cuota del plan DE ESE EVENTO). */
  limitReached: {
    maxGuestsPerEvent: "Has alcanzado el límite de invitados de este evento.",
    maxGalleryImages: "Has alcanzado el límite de imágenes de la galería de este evento.",
    maxPublicRsvpResponses: "Por ahora no se pueden recibir más confirmaciones por el enlace general de este evento.",
  } satisfies Record<LimitId, string>,
  featureUnavailable: {
    publish: "El plan de este evento no incluye publicar la invitación.",
    personalizedGuestLinks: "El plan de este evento no incluye enlaces personalizados para invitados.",
    qr: "El plan de este evento no incluye códigos QR.",
    calendar: "El plan de este evento no incluye el calendario de la invitación.",
    customMedia: "El plan de este evento no incluye subir tus propias imágenes.",
  } satisfies Record<FeatureId, string>,
  planRequired: (planName: string) => `Esta plantilla requiere ${planName} para este evento.`,
  planRequiredGeneric: "Esta plantilla requiere un plan superior para este evento. Mejora tu evento para usarla.",

  /** Aviso reutilizable cuando algo supera el plan del evento (`UpgradePrompt`). */
  upgrade: {
    title: "Mejora tu evento",
    /** Con un evento concreto: abre el panel de mejora de ese evento. */
    action: "Mejorar evento",
    /** Sin evento (p. ej. al crear uno): ver los planes. */
    actionPlans: "Ver planes",
    hint: "Tus invitados, imágenes y respuestas actuales se conservan siempre.",
  },

  notConfigured: "Los pagos todavía no están configurados en este entorno.",
  invalidConfig: "La configuración de pagos de este entorno es inconsistente. Avísale al equipo de Hilo Luna.",
  checkoutFailed: "No pudimos iniciar el pago. Inténtalo de nuevo en unos instantes.",
  planNotAvailable: "Este plan no está disponible para contratar en este momento.",
  alreadyAtPlan: "Este evento ya tiene ese plan.",
  paymentProcessing: "Ya hay un pago de este evento en proceso. Estamos confirmándolo: en unos minutos verás tu plan actualizado.",
  downgrade: "Este evento ya tiene un plan superior: los planes de pago no se reducen.",
  eventNotFound: "No encontramos este evento.",
  unauthenticated: "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
  noCustomer: "Todavía no tienes pagos que consultar.",
  unavailable: "Los pagos no están disponibles en este entorno (falta la base de datos).",

  purchaseStatus: {
    PENDING: "Pendiente",
    PAID: "Pagado",
    FAILED: "Fallido",
    REFUNDED: "Reembolsado",
    CANCELED: "Cancelado",
  } satisfies Record<PurchaseStatusId, string>,

  pricing: {
    eyebrow: "Planes",
    title: "Elige el plan ideal para tu evento",
    subtitle: "Paga una sola vez por evento, sin mensualidades.",
    description: "Crea tu invitación digital con diseño elegante, RSVP, galería, ubicación, cuenta regresiva y enlace personalizado.",
    /** Línea corta bajo el hero: aclara que el precio mostrado es el total (sin afirmar una política fiscal que todavía no existe, ver docs/BILLING.md — misma sustitución acordada con el propietario la vez anterior). */
    priceNote: "El precio que ves es el total a pagar: no se suman cargos adicionales al confirmarlo.",
    oneTime: "Pago único por evento",
    freeNote: "Sin costo, para siempre.",
    /** Solo se muestra en el plan Esencial (`components/billing/pricing-plans.tsx`). */
    recommendedBadge: "Más elegido",
    idealFor: {
      FREE: "Explorar la plataforma antes de elegir un plan completo.",
      ESSENTIAL: "Bautizos, cumpleaños, baby shower, reuniones familiares y eventos medianos.",
      PREMIUM: "Bodas, XV años y eventos grandes.",
    } satisfies Record<PlanId, string>,
    /** Versión corta de `idealFor`, para la franja comparativa (`PricingSummaryStrip`). */
    idealForShort: {
      FREE: "Ideal para probar",
      ESSENTIAL: "Ideal para la mayoría de eventos",
      PREMIUM: "Ideal para bodas, XV y eventos grandes",
    } satisfies Record<PlanId, string>,
    upcomingTitle: "Próximamente",
    upcoming: "Marca personalizada y soporte prioritario llegarán más adelante; hoy no forman parte de ningún plan.",
    /** Nota de mejora de plan, con el precio real (`formatPrice`, nunca escrito a mano): ver `PricingPlans`. */
    upgradeNote: (price: string) => `¿Tu evento creció? Puedes subir de Esencial a Premium pagando solo la diferencia: ${price}.`,
    footnote: "Cada plan se compra para un evento, así eliges el adecuado para cada celebración.",
    access: "Tu invitación permanecerá disponible hasta 30 días después del evento.",
    cta: {
      FREE: "Empezar gratis",
      ESSENTIAL: "Elegir Esencial",
      PREMIUM: "Elegir Premium",
    },
    goToEvents: "Crear un evento",
    /** CTA de cierre, al final de la página (`PricingFinalCta`). */
    finalCta: {
      title: "¿Listo para crear tu invitación?",
      description: "Empieza gratis y mejora de plan cuando lo necesites: tu contenido siempre se conserva.",
      action: "Empezar gratis",
      secondaryAction: "Ver plantillas",
    },
    comparison: {
      title: "Comparación detallada",
      description: "Lo esencial de cada plan, lado a lado.",
      rowLabels: {
        price: "Precio",
        paymentType: "Tipo de pago",
        guests: "Invitados",
        gallery: "Imágenes de galería",
        giftRegistry: "Mesa de regalos",
        music: "Música",
        idealFor: "Ideal para",
      },
      paymentTypeFree: "Sin costo",
      paymentTypePaid: "Pago único",
    },
    faq: [
      {
        question: "¿El pago es mensual?",
        answer: "No. En Hilo Luna el pago es único por evento. Sin mensualidades.",
      },
      {
        question: "¿Los precios incluyen cargos adicionales?",
        answer: "No. El precio que ves en cada plan es el total a pagar: no se suma nada más al confirmarlo.",
      },
      {
        question: "¿Puedo empezar gratis?",
        answer: "Sí. Puedes crear una invitación con el plan Gratis y subir de plan cuando necesites más capacidad.",
      },
      {
        question: "¿Qué plan me conviene?",
        answer: "Gratis es ideal para probar. Esencial funciona para la mayoría de eventos familiares. Premium es mejor para bodas, XV años o eventos con más invitados y más fotos.",
      },
      {
        question: "¿Puedo subir de Esencial a Premium?",
        answer: "Sí. Si tu evento crece, puedes subir a Premium pagando solo la diferencia disponible.",
      },
      {
        question: "¿Qué pasa si necesito más invitados?",
        answer: "Puedes elegir Premium si tu evento requiere más capacidad. Si ya tienes Esencial, puedes subir a Premium pagando solo la diferencia.",
      },
      {
        question: "¿El plan se aplica a todos mis eventos?",
        answer: "No. Cada plan se compra por evento, así puedes elegir el plan adecuado para cada celebración.",
      },
    ] as readonly { question: string; answer: string }[],
  },

  /** Panel «Mejorar evento» (desde el dashboard de un evento). */
  upgradePanel: {
    title: "Mejorar evento",
    description: (eventTitle: string) => `Elige el plan de «${eventTitle}». Es un pago único, sin mensualidades.`,
    current: "Plan actual",
    pay: (price: string) => `Pagar ${price}`,
    upgradeFor: (price: string) => `Mejorar por ${price}`,
    upgradeNote: "Solo pagas la diferencia con lo que ya compraste.",
    confirming: "Estamos confirmando tu pago…",
    confirmingHint: "Puede tardar unos instantes. Tu plan se actualizará en cuanto el pago quede confirmado.",
    refresh: "Actualizar",
    confirmed: "Tu pago se confirmó. Tu evento ya tiene su nuevo plan.",
    canceled: "Cancelaste el pago; no se hizo ningún cargo y tu plan no cambió.",
    maxPlan: "Este evento ya tiene el plan más completo.",
    notConfigured: "Los pagos todavía no están configurados en este entorno.",
  },

  billing: {
    title: "Compras y planes",
    description: "El plan de cada uno de tus eventos y lo que has pagado.",
    plan: "Plan",
    noEvents: "Todavía no tienes eventos. Crea uno para elegir su plan.",
    createEvent: "Crear un evento",
    access: (date: string) => `Disponible hasta ${date}`,
    accessExpired: (date: string) => `El acceso terminó el ${date}`,
    accessFree: "Sin fecha de vencimiento",
    accessNote: "Tu invitación permanecerá disponible hasta 30 días después del evento.",
    guests: "Invitados",
    gallery: "Galería",
    upgrade: "Mejorar evento",
    seePlans: "Ver planes",
    overLimit: "Superas el límite del plan de este evento. Todo se conserva; solo no podrás añadir más hasta mejorarlo.",
    paid: "Pagado",
    of: (current: number, max: number | null) => (max === null ? `${current} · sin límite` : `${current} / ${max}`),
    purchasesTitle: "Historial de pagos",
    purchaseRow: (planName: string, price: string) => `${planName} · ${price}`,
    upgradeTag: "Mejora",
  },

  menu: { billing: "Compras y planes" },
} as const;

/** Nombre del límite para el usuario. */
export const limitLabel: Record<LimitId, string> = {
  maxGuestsPerEvent: "invitados por evento",
  maxGalleryImages: "imágenes de galería",
  maxPublicRsvpResponses: "respuestas por el enlace general",
};
