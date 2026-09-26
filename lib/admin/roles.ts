/**
 * ROLES INTERNOS (D-33). Espejo en código del enum `UserRole` de PostgreSQL, para que el dominio y la interfaz no importen Prisma.
 * El rol vive SOLO en la base de datos y solo lo lee `requireAdmin()`; nunca se deduce del email, del dominio, de un parámetro ni de
 * metadatos que envíe el cliente.
 */
export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRoleId = (typeof USER_ROLES)[number];

export const isUserRole = (value: unknown): value is UserRoleId => typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);

/** ÚNICA comparación de privilegio de la aplicación: estricta, sin coerciones. */
export const isAdminRole = (role: unknown): role is "ADMIN" => role === "ADMIN";
