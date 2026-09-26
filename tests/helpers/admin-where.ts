/**
 * Intérprete mínimo de condiciones `where` de Prisma (el subconjunto que usa la consola: igualdad, `in`, `not`, `gt/gte/lt/lte`, `contains`,
 * `AND`/`OR`, relaciones `some`/`none`/`is` y referencias a columnas `{ __ref }`). Sirve para contrastar, SIN base de datos, que los filtros
 * de la consola (`eventPlanWhere`, `eventPublicationWhere`) equivalen a las funciones del dominio (`getEffectiveEventPlan`,
 * `derivePublicationState`). La equivalencia con PostgreSQL real se comprobó además contra una base temporal.
 */
export type Where = Record<string, unknown>;
export interface FieldRef {
  __ref: string;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !(value instanceof Date);

function scalarMatches(condition: unknown, value: unknown, row: Record<string, unknown>): boolean {
  if (!isObject(condition)) return value === condition;
  const resolve = (operand: unknown) => (isObject(operand) && "__ref" in operand ? row[(operand as unknown as FieldRef).__ref] : operand);
  return Object.entries(condition).every(([operator, operand]) => {
    const target = resolve(operand);
    switch (operator) {
      case "in":
        return Array.isArray(operand) && operand.includes(value);
      case "not":
        return isObject(operand) ? !scalarMatches(operand, value, row) : value !== target;
      case "gt":
        return (value as number) > (target as number);
      case "gte":
        return (value as number) >= (target as number);
      case "lt":
        return (value as number) < (target as number);
      case "lte":
        return (value as number) <= (target as number);
      case "contains":
        return typeof value === "string" && value.toLowerCase().includes(String(operand).toLowerCase());
      case "mode":
        return true;
      default:
        throw new Error(`Operador no soportado por el intérprete: ${operator}`);
    }
  });
}

export function matches(where: Where, row: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return (condition as Where[]).every((part) => matches(part, row));
    if (key === "OR") return (condition as Where[]).some((part) => matches(part, row));
    if (isObject(condition) && ("some" in condition || "none" in condition)) {
      const related = (row[key] as Record<string, unknown>[] | undefined) ?? [];
      if ("some" in condition) return related.some((item) => matches(condition.some as Where, item));
      return !related.some((item) => matches(condition.none as Where, item));
    }
    if (isObject(condition) && "is" in condition) {
      const related = row[key] as Record<string, unknown> | null | undefined;
      if (condition.is === null) return related === null || related === undefined;
      return related !== null && related !== undefined && matches(condition.is as Where, related);
    }
    return scalarMatches(condition, row[key], row);
  });
}
