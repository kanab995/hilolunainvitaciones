/**
 * ANCLAS PÚBLICAS ESTABLES de la invitación (`/i/<slug>#<ancla>`). A diferencia del `id` de cada sección (que cambia de una invitación a otra),
 * estas no dependen de los datos: un enlace o un QR impreso puede apuntar a ellas. Cortas a propósito (un QR con menos caracteres tiene módulos
 * más grandes). Cambiar una rompe los QR ya impresos: nunca se renombran.
 */
export const GIFT_REGISTRY_ANCHOR = "regalos";
