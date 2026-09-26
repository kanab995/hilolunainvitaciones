/** Textos del onboarding de creación de eventos (es-MX). Módulo de copy central del área (facilita i18n futura). */
export const onboardingCopy = {
  title: "Crea tu invitación",
  description: "Tres pasos cortos. Nada se guarda hasta el final.",
  steps: ["Tipo", "Detalles", "Listo"],
  progressLabel: (current: number, total: number, name: string) => `Paso ${current} de ${total}: ${name}`,

  type: {
    heading: "¿Qué vas a celebrar?",
    legend: "Tipo de evento",
    templateLabel: "Plantilla",
    changeTemplate: "Cambiar plantilla",
    pickTemplate: "Elige una plantilla",
    noTemplates: (typeLabel: string) => `Todavía no tenemos plantillas disponibles para ${typeLabel.toLowerCase()}. Estamos trabajando en ellas.`,
    seeTemplates: "Ver plantillas",
    templateNotice: {
      unknown: "No encontramos esa plantilla. Elige una de las disponibles.",
      unavailable: "Esta plantilla estará disponible próximamente.",
    },
  },
  details: {
    heading: "Cuéntanos lo esencial",
    name1: "Nombre 1",
    name2: "Nombre 2",
    date: "Fecha",
    time: "Hora",
    timezone: "Zona horaria",
    timezoneHint: "La hora del evento se guarda en esta zona.",
    pastDate: "Esa fecha ya pasó. Puedes continuar, pero revisa que sea la correcta.",
    namesHint: "Puedes cambiarlos después.",
  },
  confirm: {
    heading: "Todo listo",
    summaryLabel: "Resumen del evento",
    event: "Evento",
    date: "Fecha",
    template: "Plantilla",
    type: "Tipo",
    draftNote: "Tu invitación se crea como borrador: nadie más la ve hasta que la publiques.",
  },
  actions: {
    backToTemplates: "Volver a plantillas",
    back: "Atrás",
    next: "Continuar",
    create: "Crear invitación",
    creating: "Creando...",
  },
  errors: {
    generic: "No pudimos crear tu evento. Inténtalo de nuevo.",
  },
  unavailable: {
    heading: "Esta plantilla estará disponible próximamente",
    description: "Todavía no podemos crear eventos con ella. Elige una de las plantillas disponibles.",
  },
} as const;
