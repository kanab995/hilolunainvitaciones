/** Límites y constantes compartidas entre el formulario (cliente) y la validación (servidor). */
export const GUEST_LIMITS = { name: 100, email: 254, groupName: 60, maxCompanions: 20, phoneDigits: { min: 7, max: 15 } } as const;

/** Valor del selector de grupo que significa "crear un grupo nuevo con `newGroupName`". */
export const NEW_GROUP_VALUE = "__new__";
