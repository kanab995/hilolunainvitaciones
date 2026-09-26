let counter = 0;

/**
 * Id estable para un elemento nuevo de una lista (itinerario, fotos, sedes, tiendas). No se usa el
 * índice como identidad: al reordenar o eliminar, cada elemento conserva su id (y su `key` en React).
 */
export function newId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  counter += 1;
  return `${prefix}_${random}${counter}`;
}
