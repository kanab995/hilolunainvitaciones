import { billingCopy } from "@/lib/billing/copy";
import { siteConfig } from "@/lib/site-config";

/** Textos de la sección «Música» del editor (D-46). Módulo de copy central del área (es-MX). */
export const musicEditorCopy = {
  legend: "Origen de la música",
  plan: "Esencial y Premium",
  soon: "Próximamente",
  choices: {
    none: { label: "Sin música", description: "La invitación no tendrá canción." },
    library: { label: `Biblioteca ${siteConfig.name}`, description: "Canciones con licencia para sonar en tu invitación." },
    upload: { label: "Subir archivo", description: "Tu propio audio, confirmando que tienes los derechos." },
    external: { label: "Enlace externo", description: "Un enlace a la canción en Spotify, YouTube u otro sitio." },
  },
  planNotice: billingCopy.featureUnavailable.musicLibrary,
  empty: "Estamos preparando la biblioteca: pronto encontrarás aquí canciones con licencia para tu invitación.",
  emptyCategory: "Aún no hay canciones en esta categoría.",
  all: "Todas",
  categories: "Categorías",
  tracks: "Canciones",
  use: "Usar",
  inUse: "Elegida",
  sample: (title: string) => `Escuchar una muestra de «${title}»`,
  stopSample: (title: string) => `Detener la muestra de «${title}»`,
  selected: "Canción elegida",
  unavailable: "Esta canción ya no está disponible y no sonará en tu invitación. Elige otra de la biblioteca.",
  enabled: { label: "Música activada", hint: "Si la apagas, la canción elegida se conserva para cuando quieras volver a encenderla." },
  startOnOpen: { label: "Empezar al abrir la invitación", hint: "Suena cuando tu invitado pulsa «Abrir invitación». Siempre podrá pausarla." },
  credit: (text: string) => `Esta canción requiere mostrar el crédito «${text}» al final de tu invitación (se añade solo).`,
  externalNote: "Un enlace externo es solo un enlace: no se reproduce como música de fondo dentro de la invitación.",
  rules: "La música nunca empieza al cargar la página: solo después de que tu invitado pulse «Abrir invitación» o el botón de música.",
} as const;
