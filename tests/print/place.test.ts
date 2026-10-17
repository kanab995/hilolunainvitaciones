import { describe, expect, it } from "vitest";
import { buildPrintData, detectedPlace } from "@/lib/print/data";
import { parsePrintOptions, printOptionsQuery, DEFAULT_PRINT_OPTIONS } from "@/lib/print/options";
import { cleanPlaceInput, formatPlace, placeFromAddress } from "@/lib/print/place";
import { demo, minimalWedding } from "./fixtures";

const read = (lines: string[]) => formatPlace(placeFromAddress(lines));

describe("ciudad y estado del frente (sin campos estructurados en la sede)", () => {
  it("reconoce el estado por nombre o abreviatura y lo escribe completo", () => {
    expect(read(["Calle de la Paz 123", "San Miguel de Allende, Gto."])).toBe("San Miguel de Allende, Guanajuato");
    expect(read(["Av. Vallarta 1000", "Guadalajara, Jalisco, México"])).toBe("Guadalajara, Jalisco");
    expect(read(["Carretera federal km 2", "Tulum, Q. Roo"])).toBe("Tulum, Quintana Roo");
    expect(read(["Blvd. Kukulcán km 9", "Cancún, QRoo, C.P. 77500"])).toBe("Cancún, Quintana Roo");
    expect(read(["Calle 60 x 47", "Mérida, Yuc."])).toBe("Mérida, Yucatán");
    expect(read(["Av. Constitución 100", "Monterrey, N.L."])).toBe("Monterrey, Nuevo León");
    expect(read(["Calzada 5", "Toluca, Edo. Méx."])).toBe("Toluca, Estado de México");
  });

  it("todo en una sola línea, con código postal y país", () => {
    expect(read(["Calle de la Paz 123, Centro, 37700 San Miguel de Allende, Gto., México"])).toBe("San Miguel de Allende, Guanajuato");
    expect(read(["Madero 721, Zona Centro, León, Guanajuato"])).toBe("León, Guanajuato");
  });

  it("ciudad y estado iguales se escriben una vez", () => {
    expect(read(["Av. Juárez 45", "Puebla, Pue."])).toBe("Puebla");
    expect(read(["Paseo de la Reforma 50", "Ciudad de México, CDMX"])).toBe("Ciudad de México");
    expect(read(["Reforma 50", "CDMX"])).toBe("Ciudad de México");
  });

  it("alternativa segura: nunca imprime una calle como ciudad", () => {
    expect(read(["Calle de la Paz 123"])).toBeUndefined();
    expect(read(["Hacienda Los Olivos", "Carretera San Miguel a Dolores km 4"])).toBeUndefined();
    expect(read(["Av. Hidalgo"])).toBeUndefined();
    // Sin estado reconocible: la última línea solo si no tiene números.
    expect(read(["Camino Real 12", "Valle de Bravo"])).toBe("Valle de Bravo");
    expect(read([])).toBeUndefined();
  });

  it("la demostración vuelve a decir «Guanajuato» como el arte aprobado", () => {
    expect(detectedPlace(demo)).toBe("San Miguel de Allende, Guanajuato");
    expect(buildPrintData(demo).ceremony?.city).toBe("San Miguel de Allende, Guanajuato");
    expect(buildPrintData(minimalWedding).ceremony?.city).toBe("Puebla");
  });

  it("lo que confirma el anfitrión manda; vacío quita la línea", () => {
    expect(buildPrintData(demo, { place: "San Miguel de Allende, Gto." }).ceremony?.city).toBe("San Miguel de Allende, Gto.");
    expect(buildPrintData(demo, { place: "" }).ceremony?.city).toBeUndefined();
  });

  it("el texto del anfitrión se limpia y viaja por la URL (ausente ≠ vacío)", () => {
    expect(cleanPlaceInput("  León,\n Guanajuato  ")).toBe("León, Guanajuato");
    expect(cleanPlaceInput("x".repeat(80))).toHaveLength(60);
    expect(parsePrintOptions(new URLSearchParams()).place).toBeUndefined();
    expect(parsePrintOptions(new URLSearchParams("place=")).place).toBe("");
    const options = { ...DEFAULT_PRINT_OPTIONS, place: "Tulum, Quintana Roo" };
    expect(parsePrintOptions(new URLSearchParams(printOptionsQuery(options))).place).toBe("Tulum, Quintana Roo");
  });
});
