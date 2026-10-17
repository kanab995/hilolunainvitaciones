import { describe, expect, it } from "vitest";
import { ADDONS, canDownloadPrintFile, formatAddonPrice, isAddonEligiblePlan } from "@/lib/billing/addons";
import { buildPrintData, initialOf, initialsFromNames, isPrintableEventType, parseInitials } from "@/lib/print/data";
import { DEFAULT_PRINT_OPTIONS, parsePrintOptions, printOptionsQuery } from "@/lib/print/options";
import { clockAt, parseClock, printableTime, socialTime } from "@/lib/print/time-words";
import { DEMO_URL, demo, longWedding, minimalWedding } from "./fixtures";

describe("hora «social» (aprobada: «a las cinco de la tarde»)", () => {
  it("escribe con letra las horas en punto, y cuarto y y media, con su periodo del día", () => {
    expect(socialTime({ hour: 17, minute: 0 })).toBe("a las cinco de la tarde");
    expect(socialTime({ hour: 19, minute: 0 })).toBe("a las siete de la noche");
    expect(socialTime({ hour: 13, minute: 30 })).toBe("a la una y media de la tarde");
    expect(socialTime({ hour: 12, minute: 0 })).toBe("a las doce del día");
    expect(socialTime({ hour: 0, minute: 0 })).toBe("a las doce de la noche");
    expect(socialTime({ hour: 1, minute: 15 })).toBe("a la una y cuarto de la madrugada");
    expect(socialTime({ hour: 11, minute: 0 })).toBe("a las once de la mañana");
  });

  it("otros minutos vuelven a la cifra", () => {
    expect(socialTime({ hour: 17, minute: 20 })).toBe("a las 17:20 horas");
    expect(socialTime({ hour: 9, minute: 45 })).toBe("a las 9:45 horas");
  });

  it("lee las horas que escribe el anfitrión en el editor", () => {
    expect(parseClock("17:00 hrs")).toEqual({ hour: 17, minute: 0 });
    expect(parseClock("4:00 PM")).toEqual({ hour: 16, minute: 0 });
    expect(parseClock("7 p. m.")).toEqual({ hour: 19, minute: 0 });
    expect(parseClock("12:30 am")).toEqual({ hour: 0, minute: 30 });
    expect(parseClock("19 h")).toEqual({ hour: 19, minute: 0 });
    expect(parseClock("Al atardecer")).toBeUndefined();
    expect(parseClock("2027")).toBeUndefined();
    expect(parseClock("25:00")).toBeUndefined();
    expect(printableTime("Al atardecer")).toBe("Al atardecer");
    expect(printableTime("  ")).toBeUndefined();
  });

  it("toma la hora del evento en SU zona horaria", () => {
    expect(clockAt("2027-05-17T17:00:00-06:00", "America/Mexico_City")).toEqual({ hour: 17, minute: 0 });
    expect(clockAt("2027-05-17T23:00:00Z", "America/Mexico_City")).toEqual({ hour: 17, minute: 0 });
  });
});

describe("iniciales del monograma", () => {
  it("salen de los nombres, sin acentos y en mayúscula (la Ñ se conserva)", () => {
    expect(initialsFromNames(["Andrea", "Fernando"])).toEqual(["A", "F"]);
    expect(initialOf("ángela")).toBe("A");
    expect(initialOf("Ñuri")).toBe("Ñ");
    expect(initialsFromNames(["  ", "Luis"])).toEqual(["L"]);
  });

  it("acepta una o dos letras escritas por el anfitrión; nada más", () => {
    expect(parseInitials("af")).toEqual(["A", "F"]);
    expect(parseInitials("A & F")).toEqual(["A", "F"]);
    expect(parseInitials("m")).toEqual(["M"]);
    expect(parseInitials("ABC")).toBeUndefined();
    expect(parseInitials("A1")).toBeUndefined();
    expect(parseInitials("")).toBeUndefined();
  });
});

describe("datos de la versión impresa (de la invitación publicada)", () => {
  it("la boda de demostración da exactamente lo del arte aprobado", () => {
    const data = buildPrintData(demo, { publicUrl: DEMO_URL });
    expect(data.names).toEqual(["Andrea", "Fernando"]);
    expect(data.dateLine).toBe("LUNES 17 DE MAYO DE 2027");
    expect(data.timeLine).toBe("a las cinco de la tarde");
    expect(data.ceremony).toMatchObject({ name: "Parroquia de San Miguel Arcángel", time: "a las cinco de la tarde", city: "San Miguel de Allende, Guanajuato" });
    expect(data.reception).toMatchObject({ name: "Hacienda Los Olivos", time: "a las siete de la noche" });
    expect(data.dressCode?.style).toBe("Formal y elegante");
    expect(data.qr).toEqual({ url: DEMO_URL, label: "hiloluna.com/i/demo-magnolia" });
  });

  it("sin URL pública no hay QR; con iniciales personalizadas, se usan esas", () => {
    const data = buildPrintData(demo, { initials: ["F", "A"] });
    expect(data.qr).toBeUndefined();
    expect(data.initials).toEqual(["F", "A"]);
  });

  it("respeta lo que el anfitrión ocultó y lo que falta", () => {
    const hidden = { ...demo, sections: demo.sections.map((section) => (section.type === "dressCode" ? { ...section, isVisible: false } : section)) };
    expect(buildPrintData(hidden).dressCode).toBeUndefined();
    const minimal = buildPrintData(minimalWedding);
    expect(minimal.reception).toBeUndefined();
    expect(minimal.dressCode).toBeUndefined();
    // Sin hora escrita en la sede, la ceremonia usa la hora del evento.
    expect(minimal.ceremony?.time).toBe("a las doce del día");
  });

  it("las horas libres del editor se escriben con letra", () => {
    const data = buildPrintData(longWedding);
    expect(data.ceremony?.time).toBe("a la una y media de la tarde");
    expect(data.reception?.time).toBe("a las ocho de la noche");
  });

  it("el diseño aprobado es de boda: los demás tipos esperan su texto", () => {
    expect(isPrintableEventType("wedding")).toBe(true);
    expect(isPrintableEventType("quinceanera")).toBe(false);
    expect(isPrintableEventType("baptism")).toBe(false);
  });
});

describe("opciones (llegan del navegador)", () => {
  it("valida todo y cae en los valores por defecto", () => {
    expect(parsePrintOptions(new URLSearchParams())).toEqual(DEFAULT_PRINT_OPTIONS);
    expect(parsePrintOptions(new URLSearchParams("format=a5&back=0&qr=0&marks=1&initials=mj"))).toEqual({ format: "a5", includeBack: false, includeQr: false, cropMarks: true, initials: ["M", "J"] });
    expect(parsePrintOptions(new URLSearchParams("format=a4&back=yes&initials=<script>"))).toEqual(DEFAULT_PRINT_OPTIONS);
  });

  it("ida y vuelta por la query string", () => {
    const options = { format: "a5" as const, includeBack: true, includeQr: false, cropMarks: true, initials: ["A", "L"] };
    expect(parsePrintOptions(new URLSearchParams(printOptionsQuery(options)))).toEqual(options);
  });
});

describe("complemento «Archivo listo para imprimir» (compra APAGADA)", () => {
  it("cuesta $199 MXN, solo para Esencial y Premium, y todavía no se puede comprar", () => {
    expect(ADDONS.PRINT_FILE).toMatchObject({ displayPrice: 199, currency: "MXN", purchasable: false });
    expect(formatAddonPrice("PRINT_FILE")).toBe("$199 MXN");
    expect(isAddonEligiblePlan("PRINT_FILE", "FREE")).toBe(false);
    expect(isAddonEligiblePlan("PRINT_FILE", "ESSENTIAL")).toBe(true);
    expect(isAddonEligiblePlan("PRINT_FILE", "PREMIUM")).toBe(true);
  });

  it("el PDF limpio solo con compra o como prueba interna de administración", () => {
    expect(canDownloadPrintFile({ purchased: false, isAdmin: false })).toBe(false);
    expect(canDownloadPrintFile({ purchased: false, isAdmin: true })).toBe(true);
    expect(canDownloadPrintFile({ purchased: true, isAdmin: false })).toBe(true);
  });
});
