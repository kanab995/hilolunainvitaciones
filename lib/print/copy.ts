import type { PrintQrTarget } from "@/lib/print/qr-target";
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
    /** Bloque del QR según su destino (D-49). El título de la invitación es el del diseño aprobado; las indicaciones, las del propietario. */
    qr: {
      invitation: { title: "Confirma tu asistencia", hint: "Escanea para ver nuestra invitación digital" },
      gifts: { title: "Mesa de regalos", hint: "Escanea para ver nuestra mesa de regalos" },
      "gift-link": { title: "Mesa de regalos", hint: "Escanea para ver nuestra mesa de regalos" },
    },
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
      initials: "Iniciales del monograma",
      initialsHint: "Una o dos letras. Por defecto, las de los nombres.",
      initialsInvalid: "Usa una o dos letras.",
      place: "Ciudad en el frente",
      placeHint: "Va bajo el nombre de la ceremonia. Revísala; déjala vacía para no imprimirla.",
    },
    /** Destino del QR del reverso (D-49). */
    qr: {
      legend: "Código QR del reverso",
      hint: "Elige a dónde lleva el código impreso.",
      noBack: "Activa el reverso para incluir un código QR.",
      options: {
        invitation: { label: "Invitación digital", description: "Abre tu invitación completa, donde tus invitados también confirman su asistencia." },
        gifts: { label: "Mesa de regalos", description: "Abre tu invitación directamente en la mesa de regalos, donde tus invitados eligen la tienda." },
        "gift-link": { label: "Enlace directo a la tienda", description: "Abre tu única mesa de regalos sin pasar por la invitación." },
        none: { label: "Sin código QR", description: "El reverso se reacomoda para conservar el diseño." },
      } satisfies Record<PrintQrTarget, { label: string; description: string }>,
      giftLinkStore: (store: string) => `Abre ${store} sin pasar por la invitación.`,
      invitationUnavailable: "Necesita una invitación publicada y vigente.",
      giftsMissing: {
        title: "Tu invitación publicada no tiene mesa de regalos",
        description: "Agrégala en el editor (sección «Mesa de regalos»), publica los cambios y vuelve aquí para elegir esta opción.",
        action: "Ir al editor",
      },
      giftLinkProblem: {
        insecure: "El enlace de tu tienda no empieza con https://: por seguridad no lo imprimimos directo. Usa «Mesa de regalos».",
        invalid: "El enlace de tu tienda no es una dirección pública válida: no lo imprimimos directo. Usa «Mesa de regalos».",
        too_long: "El enlace de tu tienda es demasiado largo para un código legible en papel. Usa «Mesa de regalos».",
      },
      savedUnavailable: "La opción que habías elegido ya no está disponible en tu invitación publicada: el código vuelve a tu invitación digital.",
      previewTitle: "Así se imprimirá",
      opens: "Abre",
      validity: (date: string) => `Este código depende de tu invitación digital: funcionará hasta el ${date}, 30 días después de tu evento.`,
      validityOpen: "Este código depende de tu invitación digital: funciona mientras tu invitación esté publicada.",
      directValidity: "Este código abre la tienda directamente: no depende de la vigencia de tu invitación, sino de que la tienda conserve ese enlace.",
      noneNote: "El reverso no llevará código.",
      saving: "Guardando…",
      saved: "Elección guardada.",
      save: {
        invalid: "Esa opción no es válida.",
        notFound: "No encontramos este evento.",
        unavailable: {
          invitation: "Publica tu invitación (y mantenla vigente) para imprimir su código.",
          gifts: "Configura y publica tu mesa de regalos antes de elegir esta opción.",
          "gift-link": "El enlace directo solo está disponible con una única tienda con un enlace https:// válido.",
          none: "No pudimos guardar tu elección.",
        } satisfies Record<PrintQrTarget, string>,
        store: "No pudimos guardar tu elección. Inténtalo de nuevo.",
      },
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
