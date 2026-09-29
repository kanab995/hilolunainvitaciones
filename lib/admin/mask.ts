/**
 * MÁSCARA de identificadores externos (Stripe) para soporte: se conserva el prefijo del tipo de objeto y los últimos cuatro
 * caracteres, lo bastante para localizarlo en el panel del proveedor y no lo bastante para usarlo. `cus_1Nabc…9xyz` → `cus_••••••9xyz`.
 * Un id demasiado corto se oculta entero. Nunca se enmascara con la intención de proteger un secreto: los secretos no se muestran.
 */
/**
 * MÁSCARA de correo (D-36, punto 51): conserva los dos primeros caracteres del usuario y el dominio completo (localizable en el
 * proveedor de correo, no reutilizable para escribirle). `mariana@ejemplo.com` → `ma••••@ejemplo.com`.
 */
export function maskEmail(value: string): string {
  const [user = "", domain = ""] = value.split("@");
  if (!domain) return "••••";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

export function maskExternalId(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^([a-z]{2,8}_(?:(?:test|live)_)?)(.+)$/i.exec(value);
  const prefix = match?.[1] ?? "";
  const rest = match?.[2] ?? value;
  const tail = rest.length >= 12 ? rest.slice(-4) : "";
  return `${prefix}••••••${tail}`;
}
