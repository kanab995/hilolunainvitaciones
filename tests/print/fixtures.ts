import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import type { Invitation } from "@/types/invitation";

/** Datos de prueba de la versión impresa (D-47). La demo es la boda aprobada; las otras dos estresan la composición (inventadas). */
export const demo: Invitation = andreaFernandoInvitation;

export const longWedding: Invitation = {
  ...andreaFernandoInvitation,
  names: ["María Fernanda", "Juan Sebastián"],
  event: { startsAt: "2027-11-20T13:30:00-06:00", timezone: "America/Mexico_City" },
  locations: [
    { id: "l1", kind: "ceremony", name: "Templo Expiatorio del Sagrado Corazón de Jesús", addressLines: ["Madero 721, Zona Centro", "León, Gto."], time: "13:30 hrs" },
    { id: "l2", kind: "reception", name: "Jardín La Antigua Hacienda de San José del Valle", addressLines: ["Boulevard Juan Alonso de Torres Poniente 2002", "León, Gto."], time: "8:00 PM" },
  ],
  dressCode: { style: "Etiqueta rigurosa", description: "Caballeros de smoking y damas de vestido largo, por favor.", palette: [] },
};

export const minimalWedding: Invitation = {
  ...andreaFernandoInvitation,
  names: ["Ana", "Luis"],
  event: { startsAt: "2027-03-06T12:00:00-06:00", timezone: "America/Mexico_City" },
  locations: [{ id: "l1", kind: "ceremony", name: "Capilla del Rosario", addressLines: ["Av. Juárez 45", "Puebla, Pue."] }],
  dressCode: undefined,
};

export const DEMO_URL = "https://hiloluna.com/i/demo-magnolia";
