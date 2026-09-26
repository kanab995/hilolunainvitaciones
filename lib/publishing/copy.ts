/** Textos de la publicación (es-MX). Módulo de copy central del área. */
export const publishCopy = {
  first: {
    title: "Publicar invitación",
    description: "Tu invitación estará disponible públicamente.",
    confirm: "Publicar invitación",
  },
  republish: {
    title: "¿Publicar los cambios?",
    description: "Las personas que abran tu invitación verán la nueva versión.",
    confirm: "Publicar cambios",
  },
  published: {
    title: "Tu invitación está publicada",
    description: "No hay cambios sin publicar.",
  },
  done: {
    title: "¡Tu invitación está publicada!",
    description: "Ya puedes compartir el enlace.",
    doneChanges: "Los cambios ya están publicados.",
  },
  urlLabel: "Enlace público",
  open: "Abrir invitación",
  publishing: "Publicando...",
  cancel: "Cancelar",
  close: "Cerrar",
  savedNotPublished: "«Guardado» significa que tus cambios están a salvo en tu borrador; no que ya sean públicos.",
  demo: {
    title: "Modo demostración",
    description: "Publicar no está disponible en este entorno (no hay base de datos conectada). Tus cambios solo existen en esta ventana.",
    ok: "Entendido",
  },
  saveFailed: "No pudimos guardar tus últimos cambios, así que no se publicó nada. Corrígelos e inténtalo de nuevo.",
  share: {
    draftTitle: "Compartir invitación",
    draftDescription: "Publica tu invitación para poder compartirla.",
    draftAction: "Ir al editor",
  },
  list: {
    draft: "Continuar editando",
    published: "Abrir invitación",
    changes: "Publicar cambios",
  },
} as const;
