import { describe, expect, it } from "vitest";
import { changeTemplate, contentFingerprint } from "@/lib/invitation/change-template";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { getMockInvitation, STANDALONE_DEMO_BASES } from "@/lib/invitation/mock";
import { invitationTemplates } from "@/lib/invitation/templates";
import type { Invitation } from "@/types/invitation";
import { deepFreeze } from "./helpers";

const clone = (invitation: Invitation): Invitation => structuredClone(invitation);

describe("cambiar de plantilla no modifica los datos (regla 17)", () => {
  it("solo cambia templateSlug; todo lo demás queda idéntico", () => {
    const original = deepFreeze(clone(andreaFernandoInvitation));
    for (const template of invitationTemplates) {
      const changed = changeTemplate(original, template.slug);
      expect(changed.templateSlug).toBe(template.slug);
      expect({ ...changed, templateSlug: original.templateSlug }).toEqual(original);
    }
  });

  it("no muta la invitación original (congelada en profundidad)", () => {
    const original = deepFreeze(clone(andreaFernandoInvitation));
    const before = contentFingerprint(original);
    expect(() => changeTemplate(original, "ivory")).not.toThrow();
    expect(original.templateSlug).toBe("magnolia");
    expect(contentFingerprint(original)).toBe(before);
  });

  it("devuelve una copia, no la misma referencia", () => {
    const changed = changeTemplate(andreaFernandoInvitation, "etoile");
    expect(changed).not.toBe(andreaFernandoInvitation);
    // Comparte (no copia) el contenido: nada se reconstruye ni se pierde.
    expect(changed.names).toBe(andreaFernandoInvitation.names);
    expect(changed.sections).toBe(andreaFernandoInvitation.sections);
  });

  it("la huella del contenido es la misma antes y después de cualquier cadena de cambios", () => {
    const before = contentFingerprint(andreaFernandoInvitation);
    let current = andreaFernandoInvitation;
    for (const slug of ["ivory", "etoile", "magnolia", "etoile", "ivory", "magnolia"]) {
      current = changeTemplate(current, slug);
      expect(contentFingerprint(current)).toBe(before);
    }
    expect(current.templateSlug).toBe("magnolia");
  });

  it("la huella detecta un cambio real de contenido (la prueba no es vacía)", () => {
    const edited = { ...andreaFernandoInvitation, names: ["Andrea", "Fernanda"] };
    expect(contentFingerprint(edited)).not.toBe(contentFingerprint(andreaFernandoInvitation));
  });

  it("no borra secciones ocultas: ocultar es isVisible=false, no eliminar", () => {
    const hidden: Invitation = {
      ...andreaFernandoInvitation,
      sections: andreaFernandoInvitation.sections.map((s) => (s.type === "gallery" ? { ...s, isVisible: false } : s)),
    };
    const changed = changeTemplate(hidden, "ivory");
    expect(changed.sections).toHaveLength(andreaFernandoInvitation.sections.length);
    expect(changed.sections.find((s) => s.type === "gallery")?.isVisible).toBe(false);
    expect(changed.gallery).toEqual(andreaFernandoInvitation.gallery);
  });

  it("las personalizaciones por plantilla se conservan y volver a la anterior las restaura", () => {
    const customised: Invitation = {
      ...andreaFernandoInvitation,
      styleOverrides: { magnolia: { accent: "#123456" } },
    };
    const toIvory = changeTemplate(customised, "ivory");
    expect(toIvory.styleOverrides).toEqual({ magnolia: { accent: "#123456" } });
    const back = changeTemplate(toIvory, "magnolia");
    expect(back).toEqual(customised);
  });
});

describe("las invitaciones de demostración comparten datos entre plantillas de la MISMA base", () => {
  it("demo-<plantilla> = mismos datos de Andrea & Fernando con otra plantilla (plantillas de boda)", () => {
    const base = contentFingerprint({ ...andreaFernandoInvitation, slug: "x" });
    for (const template of invitationTemplates.filter((t) => !STANDALONE_DEMO_BASES[t.slug])) {
      const demo = getMockInvitation(`demo-${template.slug}`);
      expect(demo?.templateSlug).toBe(template.slug);
      expect(demo && contentFingerprint({ ...demo, slug: "x" })).toBe(base);
    }
  });

  it("las plantillas de otro eventType (STANDALONE_DEMO_BASES) tienen su propio contenido, no el de Andrea & Fernando", () => {
    const andreaBase = contentFingerprint({ ...andreaFernandoInvitation, slug: "x" });
    for (const [slug, standalone] of Object.entries(STANDALONE_DEMO_BASES)) {
      const demo = getMockInvitation(`demo-${slug}`);
      expect(demo?.templateSlug).toBe(slug);
      expect(demo?.eventType).toBe(standalone.eventType);
      expect(demo && contentFingerprint({ ...demo, slug: "x" })).toBe(contentFingerprint({ ...standalone, slug: "x" }));
      expect(demo && contentFingerprint({ ...demo, slug: "x" })).not.toBe(andreaBase);
    }
  });

  it("una plantilla que el motor no tiene no inventa una demo", () => {
    expect(getMockInvitation("demo-noir")).toBeUndefined();
    expect(getMockInvitation("no-existe")).toBeUndefined();
  });
});
