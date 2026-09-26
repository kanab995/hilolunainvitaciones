/** Hora del servidor (ms). Aislada para poder sustituirla en pruebas y no llamar a `Date.now()` dentro de componentes. */
export function getServerNow(): number {
  return Date.now();
}
