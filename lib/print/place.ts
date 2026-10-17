/**
 * CIUDAD Y ESTADO del frente impreso (D-47). Las sedes NO tienen ciudad ni estado estructurados (solo líneas de dirección libres,
 * `EventLocation.addressLines`), así que el orden de preferencia es:
 *  1. Lo que el anfitrión confirma en la página «Versión para imprimir» (`PrintOptions.place`): el único dato estructurado que existe.
 *  2. Lectura de la dirección: se busca un estado mexicano (nombre o abreviatura: «Gto.», «CDMX», «Q. Roo»…) quitando el país y el
 *     código postal; la ciudad es lo que va justo antes. «San Miguel de Allende, Gto.» → «San Miguel de Allende, Guanajuato».
 *  3. Alternativa segura: sin estado reconocible, solo se usa la última línea si NO tiene números (una calle nunca se imprime como
 *     ciudad); si no, la línea se omite.
 */
export interface Place {
  city?: string;
  state?: string;
}

const STATES: readonly (readonly [string, readonly string[]])[] = [
  ["Aguascalientes", ["Ags."]],
  ["Baja California", ["B.C.", "BC"]],
  ["Baja California Sur", ["B.C.S.", "BCS"]],
  ["Campeche", ["Camp."]],
  ["Chiapas", ["Chis."]],
  ["Chihuahua", ["Chih."]],
  ["Ciudad de México", ["CDMX", "Cd. Mx.", "Cd. de México", "D.F.", "México, D.F."]],
  ["Coahuila", ["Coah.", "Coahuila de Zaragoza"]],
  ["Colima", ["Col."]],
  ["Durango", ["Dgo."]],
  ["Estado de México", ["Edomex", "Edo. Mex.", "Edo. de Méx.", "Edo. Méx.", "Méx."]],
  ["Guanajuato", ["Gto."]],
  ["Guerrero", ["Gro."]],
  ["Hidalgo", ["Hgo."]],
  ["Jalisco", ["Jal."]],
  ["Michoacán", ["Mich.", "Michoacán de Ocampo"]],
  ["Morelos", ["Mor."]],
  ["Nayarit", ["Nay."]],
  ["Nuevo León", ["N.L.", "NL"]],
  ["Oaxaca", ["Oax."]],
  ["Puebla", ["Pue."]],
  ["Querétaro", ["Qro.", "Querétaro de Arteaga"]],
  ["Quintana Roo", ["Q. Roo", "Q.R.", "QRoo"]],
  ["San Luis Potosí", ["S.L.P.", "SLP"]],
  ["Sinaloa", ["Sin."]],
  ["Sonora", ["Son."]],
  ["Tabasco", ["Tab."]],
  ["Tamaulipas", ["Tamps.", "Tamp."]],
  ["Tlaxcala", ["Tlax."]],
  ["Veracruz", ["Ver.", "Veracruz de Ignacio de la Llave"]],
  ["Yucatán", ["Yuc."]],
  ["Zacatecas", ["Zac."]],
];

/** Clave de comparación: sin acentos, sin puntos ni espacios, en minúsculas («Q. Roo» → «qroo»). */
const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.\s]/g, "");

const STATE_BY_KEY = new Map<string, string>(STATES.flatMap(([name, aliases]) => [name, ...aliases].map((alias) => [key(alias), name] as const)));
const COUNTRY = new Set(["mexico", "mx"]);
/** Un segmento que empieza como calle («Av. Hidalgo», «Calle Morelos») no es un estado aunque termine en uno. */
const STREET = /^(av(enida)?|calle|blvd|boulevard|bulevar|calz(ada)?|carretera|carr|privada|priv|paseo|camino|circuito|prolongaci[oó]n|prol|andador|cerrada|km)\b\.?/i;

/** Quita el código postal («C.P. 37700», «37700») de un segmento. */
const withoutPostalCode = (segment: string) => segment.replace(/\b(?:c\.?\s?p\.?\s*)?\d{5}\b/gi, "").replace(/\s{2,}/g, " ").trim();

/** Estado al FINAL de un segmento (1 a 5 palabras): devuelve el estado y lo que queda antes («San Miguel de Allende Gto.»). */
function trailingState(segment: string): { state: string; rest: string } | undefined {
  const words = segment.split(/\s+/).filter(Boolean);
  for (let take = Math.min(5, words.length); take >= 1; take--) {
    const state = STATE_BY_KEY.get(key(words.slice(-take).join(" ")));
    if (state) return { state, rest: words.slice(0, -take).join(" ").trim() };
  }
  return undefined;
}

const looksLikeCity = (segment: string) => /\p{L}/u.test(segment) && !/\d/.test(segment) && segment.length <= 48;

export function placeFromAddress(addressLines: readonly string[]): Place {
  const lines = addressLines.map((line) => line.trim()).filter(Boolean);
  const segments = lines
    .join(", ")
    .split(",")
    .map((segment) => withoutPostalCode(segment.trim()))
    .filter(Boolean);
  while (segments.length > 0 && COUNTRY.has(key(segments[segments.length - 1] ?? ""))) segments.pop();

  // El estado va al final: solo se buscan los dos últimos segmentos (más atrás suele estar la calle).
  for (let index = segments.length - 1; index >= Math.max(0, segments.length - 2); index--) {
    const segment = segments[index] ?? "";
    if (STREET.test(segment)) continue;
    const found = trailingState(segment);
    if (!found) continue;
    const before = found.rest || segments[index - 1] || "";
    const city = looksLikeCity(before) ? before : undefined;
    return { ...(city ? { city } : {}), state: found.state };
  }

  // Sin estado reconocible: solo una última línea sin números (nunca una calle con su número).
  const last = lines.length >= 2 ? lines[lines.length - 1] : undefined;
  return last && looksLikeCity(last) ? { city: last } : {};
}

/** «San Miguel de Allende, Guanajuato»; si ciudad y estado coinciden («Ciudad de México»), una sola vez. */
export function formatPlace(place: Place): string | undefined {
  const { city, state } = place;
  if (city && state) return key(city) === key(state) || (state === "Ciudad de México" && /^(cdmx|ciudaddemexico)$/.test(key(city))) ? state : `${city}, ${state}`;
  return city ?? state;
}

/** Lo que escribe el anfitrión en «Ciudad y estado»: texto plano, una línea, ≤ 60 caracteres. Vacío = no imprimir la línea. */
export function cleanPlaceInput(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 60);
}
