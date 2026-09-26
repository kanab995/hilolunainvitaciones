import type { PublicGuestContext } from "@/types/public-rsvp";

/**
 * SALUDO PERSONALIZADO de la portada. Lógica pura y aislada (la portada no la contiene). Reglas:
 *  - Invitado individual: "Mariana, nos encantará compartir este día contigo."
 *  - Grupo familiar (el NOMBRE del grupo contiene «familia»): "Luis y familia, … con ustedes."
 *  - Nombre ya plural ("Familia López", "Ana y Luis", "Los Pérez"): se usa tal cual, en plural.
 *  - Sin grupo: solo el nombre. Tener acompañantes permitidos NO implica «y familia».
 *  - Nombres largos: solo el primer nombre (o, si es plural y muy largo, el nombre recortado).
 * Limitación conocida: «grupo familiar» se detecta por el nombre del grupo (no hay un tipo de grupo en
 * el esquema); si hace falta más precisión se añadirá un campo a `GuestGroup`.
 */
export interface GuestGreeting {
  /** Quién es saludado ("Mariana", "Luis y familia"). */
  addressee: string;
  /** El resto de la frase ("nos encantará compartir este día contigo."). */
  message: string;
  /** Frase completa: `addressee` + ", " + `message`. */
  text: string;
}

const MAX_NAME_LENGTH = 28;
const collapse = (text: string) => text.trim().replace(/\s+/g, " ");
const isFamilyGroup = (groupName?: string) => Boolean(groupName && /\bfamilia/i.test(groupName));
const isPluralName = (name: string) => /^(familia|los|las)\s/i.test(name) || /\s(y|e|&)\s/i.test(name) || name.includes(",");

export function getGuestGreeting(guest: Pick<PublicGuestContext, "displayName" | "groupName">): GuestGreeting {
  const name = collapse(guest.displayName);
  const first = name.split(" ")[0] ?? name;
  const plural = isPluralName(name);

  let addressee: string;
  let together: boolean;
  if (plural) {
    addressee = name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH).trimEnd()}…` : name;
    together = true;
  } else if (isFamilyGroup(guest.groupName)) {
    addressee = `${first} y familia`;
    together = true;
  } else {
    addressee = first;
    together = false;
  }
  const message = together ? "nos encantará compartir este día con ustedes." : "nos encantará compartir este día contigo.";
  return { addressee, message, text: `${addressee}, ${message}` };
}
