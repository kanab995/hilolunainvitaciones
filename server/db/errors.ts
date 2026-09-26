/**
 * Detección de errores de Prisma sin importar su runtime (solo `server/db/client.ts` lo importa).
 * P2002 = violación de restricción única; `meta.target` lista las columnas.
 */
export function uniqueViolationFields(error: unknown): string[] | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  if (code !== "P2002") return undefined;
  const target = meta?.target;
  return Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
}

/**
 * ¿Es un fallo TEMPORAL de la base de datos (sin conexión, tiempo agotado, pool saturado, conflicto de escritura o interbloqueo)? Códigos de
 * Prisma: P1001/P1002 (no alcanzable), P1008 (tiempo de operación), P1017 (conexión cerrada), P2024 (tiempo del pool), P2034 (conflicto de
 * escritura). Los usa el webhook de pagos para responder 503 (Stripe reintenta) en lugar de tratarlo como un error permanente.
 */
export function isTransientDatabaseError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, name } = error as { code?: unknown; name?: unknown };
  return (typeof code === "string" && ["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"].includes(code)) || name === "PrismaClientInitializationError";
}

/** No hay base de datos configurada (origen de demostración, solo lectura): las escrituras públicas se rechazan con un mensaje claro. */
export class StoreUnavailableError extends Error {
  constructor() {
    super("Guardar requiere DATABASE_URL: el origen de demostración es de solo lectura.");
    this.name = "StoreUnavailableError";
  }
}
