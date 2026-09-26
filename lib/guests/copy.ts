import type { GuestStatus, GuestStatusFilter, GuestStatusGroup } from "@/types/guests";

/** Textos del Guest Manager (es-MX). Módulo de copy central del área. */
export const guestsCopy = {
  title: "Invitados",
  description: "Administra a las personas que formarán parte de este momento.",
  add: "Agregar invitado",
  import: "Importar",
  importSoon: "Próximamente",
  search: { label: "Buscar invitados", placeholder: "Buscar por nombre, correo o teléfono" },
  filters: { statusLabel: "Filtrar por estado", groupLabel: "Grupo", allGroups: "Todos los grupos", noGroup: "Sin grupo", clear: "Quitar filtros" },
  summary: { total: "Total de invitados", confirmed: "Confirmados", pending: "Pendientes", declined: "No asistirán", companions: "Acompañantes potenciales" },
  columns: { guest: "Invitado", group: "Grupo", contact: "Contacto", companions: "Acompañantes", status: "Estado", actions: "Acciones" },
  empty: {
    title: "Aún no has agregado invitados.",
    description: "Empieza creando tu lista para después enviar invitaciones personalizadas.",
    cta: "Agregar primer invitado",
  },
  noResults: { title: "No encontramos invitados con esos filtros", description: "Prueba con otra búsqueda o quita los filtros." },
  shown: (shown: number, total: number) => (shown === total ? `${total} ${total === 1 ? "invitado" : "invitados"}` : `Mostrando ${shown} de ${total}`),
  attendees: (count: number) => `${count} ${count === 1 ? "asistente" : "asistentes"}`,
  companions: (count: number) => (count > 0 ? `+${count} ${count === 1 ? "acompañante" : "acompañantes"}` : "Sin acompañantes"),
  copied: (name: string) => `Enlace copiado ✓ · ${name}`,
  manualCopy: {
    title: "Copia el enlace",
    description: (name: string) => `Tu navegador no permitió copiarlo automáticamente. Copia el enlace personalizado de ${name} desde aquí.`,
    label: (name: string) => `Enlace de invitación de ${name}`,
    close: "Listo",
  },
  form: {
    createTitle: "Agregar invitado",
    editTitle: "Editar invitado",
    createDescription: "Guarda a la persona en tu lista. Podrás enviarle su invitación personalizada más adelante.",
    editDescription: "Actualiza los datos de este invitado.",
    name: "Nombre",
    email: "Correo electrónico",
    phone: "Teléfono",
    group: "Grupo",
    noGroup: "Sin grupo",
    newGroup: "Crear grupo nuevo…",
    newGroupName: "Nombre del grupo",
    newGroupPlaceholder: "Por ejemplo, Familia de Andrea",
    companions: "Acompañantes permitidos",
    companionsHint: "Cuántas personas más puede traer (0 a 20). No se crean como invitados aparte.",
    status: "Estado",
    save: "Guardar cambios",
    create: "Agregar invitado",
    cancel: "Cancelar",
  },
  delete: {
    title: (name: string) => `¿Eliminar a ${name}?`,
    description: "Se quitará de tu lista y su enlace personalizado dejará de estar asociado a ti. Si ya respondió, su respuesta también se eliminará. Esta acción no se puede deshacer.",
    confirm: "Eliminar invitado",
  },
} as const;

export const statusLabels: Record<GuestStatusGroup, string> = { confirmed: "Confirmado", pending: "Pendiente", declined: "No asistirá" };

export const statusFilterLabels: Record<GuestStatusFilter, string> = { all: "Todos", confirmed: "Confirmados", pending: "Pendientes", declined: "No asistirán" };

/** Opciones del selector de estado del formulario (la de "Tal vez" solo aparece si el invitado ya la tiene). */
export const statusOptions: readonly { value: GuestStatus; label: string }[] = [
  { value: "PENDING", label: "Pendiente" },
  { value: "ATTENDING", label: "Confirmado" },
  { value: "DECLINED", label: "No asistirá" },
];
export const maybeOption = { value: "MAYBE", label: "Tal vez (cuenta como pendiente)" } as const;
