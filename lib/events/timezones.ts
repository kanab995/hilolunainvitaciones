/**
 * Zonas horarias IANA que ofrece el alta de eventos (las habituales de LatAm y algunas de Norteamérica y
 * Europa). Se guarda SIEMPRE el nombre IANA, nunca solo el desfase (docs/ARCHITECTURE.md §4.7).
 */
export const timezoneOptions: readonly { value: string; label: string }[] = [
  { value: "America/Mexico_City", label: "Ciudad de México (CST)" },
  { value: "America/Cancun", label: "Cancún (EST)" },
  { value: "America/Monterrey", label: "Monterrey (CST)" },
  { value: "America/Chihuahua", label: "Chihuahua (CST)" },
  { value: "America/Hermosillo", label: "Sonora (MST)" },
  { value: "America/Mazatlan", label: "Mazatlán (MST)" },
  { value: "America/Tijuana", label: "Tijuana (PST)" },
  { value: "America/Guatemala", label: "Guatemala" },
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Lima", label: "Lima" },
  { value: "America/Santiago", label: "Santiago" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/New_York", label: "Nueva York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Ángeles (PT)" },
  { value: "Europe/Madrid", label: "Madrid" },
];
