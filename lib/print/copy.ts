import { siteConfig } from "@/lib/site-config";

/**
 * Textos de la versión impresa (D-47): los que van IMPRESOS en la tarjeta (`card`, diseño aprobado «Romántica elegante») y los de la
 * página del panel (`page`). Un único módulo de copy por área (CLAUDE.md §5).
 */
export const printCopy = {
  card: {
    intro: "Junto a sus familias",
    invite: "tienen el honor de invitarte a celebrar su matrimonio",
    closing: "Tu presencia hará este día todavía más especial",
    backTitle: "Celebremos juntos",
    ceremony: "CEREMONIA",
    reception: "RECEPCIÓN",
    dressCode: "VESTIMENTA",
    rsvpTitle: "Confirma tu asistencia",
    rsvpHint: "Escanea el código o visita",
  },
  page: {
    title: "Versión para imprimir",
    description: "Tu invitación como papelería fina: frente, reverso y el monograma para el sobre, listos para llevar a la imprenta.",
    notPublished: {
      title: "Publica tu invitación primero",
      description: "La versión para imprimir se arma con lo que ya publicaste, para que coincida con lo que ven tus invitados.",
      action: "Ir al editor",
    },
    unsupported: {
      title: "Disponible por ahora para bodas",
      description: "El diseño impreso de este tipo de evento todavía está en preparación.",
    },
    options: {
      legend: "Opciones",
      format: "Formato",
      back: "Incluir reverso",
      backHint: "Ceremonia, recepción, vestimenta y QR.",
      qr: "Código QR para confirmar",
      qrHint: "Lleva a tu invitación publicada.",
      qrUnavailable: "El QR necesita una invitación publicada y vigente.",
      initials: "Iniciales del monograma",
      initialsHint: "Una o dos letras. Por defecto, las de los nombres.",
      initialsInvalid: "Usa una o dos letras.",
      place: "Ciudad en el frente",
      placeHint: "Va bajo el nombre de la ceremonia. Revísala; déjala vacía para no imprimirla.",
    },
    previews: { front: "Frente", back: "Reverso", envelope: "Monograma para el sobre" },
    watermark: `VISTA PREVIA · ${siteConfig.name.toLocaleUpperCase("es-MX")}`,
    previewNote: "Vista previa con marca de agua. El archivo final es un PDF vectorial, sin marca de agua.",
    sourceNote: (version: number) => `Datos de la versión publicada n.º ${version}. Si cambias tu invitación, vuelve a publicarla para actualizar el impreso.`,
    warnings: {
      textFitted: "Un texto largo se ajustó para caber en la tarjeta. Revisa la vista previa.",
      spacingCompressed: "Hay mucho texto en el frente: se redujeron los espacios. Revisa la vista previa.",
      columnsTight: "El reverso queda justo de espacio. Revisa la vista previa.",
    },
    product: {
      title: "Archivo listo para imprimir",
      priceNote: "pago único por evento · impuestos incluidos",
      features: [
        "PDF vectorial con sangrado de 3 mm y zona segura",
        "Frente, reverso y monograma para el sobre",
        "Formatos 5×7\" y A5, con o sin marcas de corte",
        "Descargas ilimitadas desde tu versión publicada",
      ],
      eligibility: "Disponible para eventos Esencial y Premium.",
      comingSoon: "Muy pronto",
      comingSoonNote: "La compra todavía no está disponible.",
      notes: [
        "El dorado es un color de tinta, no metálico. El PDF va en RGB: tu imprenta lo convierte y el tono puede variar un poco; pide una prueba de color.",
        "El código QR funciona mientras tu invitación esté activa. Si tu evento tiene plan, deja de funcionar 30 días después del evento.",
      ],
      adminDownload: "Descargar PDF (prueba interna)",
      adminNote: "Solo administración: prueba interna, sin compra.",
      cropMarks: "Con marcas de corte",
      buy: (price: string) => `Comprar · ${price}`,
      buyNote: "Pago seguro con Stripe. Revisa la vista previa antes de pagar: el archivo se arma con tu invitación publicada.",
      upgradeFirst: "Mejorar evento",
      upgradeNote: "Primero mejora tu evento a Esencial o Premium; después podrás comprar el archivo.",
      pending: "Estamos confirmando tu pago…",
      pendingNote: "Puede tardar unos instantes. En cuanto se confirme podrás descargar tu archivo.",
      purchased: "Comprado",
      purchasedOn: (date: string) => `Comprado el ${date}. Descárgalo cuando quieras: las descargas son ilimitadas.`,
      download: "Descargar PDF para imprimir",
      downloadNote: "Se genera con tu versión publicada más reciente. Si cambias tu invitación, vuelve a publicarla y descárgalo de nuevo.",
      qrValidUntil: (date: string) => `El código QR impreso funcionará hasta el ${date}, 30 días después de tu evento; después dejará de abrir tu invitación.`,
    },
    /** Regreso del pago (`?payment=success|canceled` en esta página). No desbloquea nada: solo informa; quien desbloquea es el webhook. */
    payment: {
      confirming: "Estamos confirmando tu pago…",
      confirmingHint: "Puede tardar unos instantes. Tu archivo aparecerá aquí en cuanto el pago quede confirmado.",
      refresh: "Actualizar",
      confirmed: "¡Listo! Tu pago se confirmó y ya puedes descargar tu archivo listo para imprimir.",
      canceled: "Cancelaste el pago: no se hizo ningún cargo.",
    },
    /** Errores al abrir el pago (mensajes seguros para la persona; los detalles quedan en el registro). */
    checkout: {
      notFound: "No encontramos este evento.",
      notAvailable: "La compra del archivo todavía no está disponible.",
      notPrintable: "Publica tu invitación (de boda) para poder comprar su versión para imprimir.",
      ineligiblePlan: "El archivo listo para imprimir está disponible para eventos Esencial y Premium.",
      alreadyPurchased: "Ya compraste el archivo de este evento: puedes descargarlo cuando quieras.",
      paymentPending: "Ya hay un pago de este archivo en proceso. Estamos confirmándolo: en unos minutos podrás descargarlo.",
      invalidConfig: "No pudimos iniciar el pago por un problema de configuración. Inténtalo más tarde.",
      unavailable: "El servicio no está disponible en este momento. Inténtalo más tarde.",
      failed: "No pudimos iniciar el pago. Inténtalo de nuevo en unos minutos.",
    },
  },
} as const;
