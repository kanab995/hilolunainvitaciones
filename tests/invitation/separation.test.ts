import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { sectionRegistry } from "@/components/invitation/sections/registry";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { invitationTemplates } from "@/lib/invitation/templates";
import type { InvitationSectionType } from "@/types/invitation";
import { collectKeys, collectStrings } from "./helpers";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(path, "utf8");

/** Código sin comentarios: los avisos en comentarios ("nunca --lu-*") no cuentan como uso. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Claves permitidas en una plantilla: SOLO presentación. */
const TEMPLATE_KEYS = ["slug", "name", "colors", "fonts", "layout", "effects", "decor", "background", "componentStyles", "animations"];

/** Claves que delatan presentación dentro de los datos. */
const PRESENTATION_KEYS = ["colors", "fonts", "layout", "effects", "decor", "background", "componentStyles", "animations"];

describe("DATA ↔ TEMPLATE: los tipos no se conocen entre sí", () => {
  it("types/invitation.ts (datos) no importa nada de la plantilla", () => {
    expect(read(join(ROOT, "types/invitation.ts"))).not.toMatch(/from\s+["']@\/types\/invitation-template["']/);
  });

  it("types/invitation-template.ts (presentación) no importa nada de los datos", () => {
    const source = read(join(ROOT, "types/invitation-template.ts"));
    expect(source).not.toMatch(/from\s+["']@\/types\/invitation["']/);
    expect(source).not.toMatch(/from\s+["']@\/types\/marketing["']/);
  });

  it("los datos no contienen ninguna clave de presentación", () => {
    const keys = collectKeys(andreaFernandoInvitation);
    for (const key of PRESENTATION_KEYS) expect(keys.has(key)).toBe(false);
  });

  it("los datos solo llevan colores como contenido del usuario (paleta de dress code y acento por plantilla)", () => {
    const { dressCode, styleOverrides, ...rest } = andreaFernandoInvitation;
    void dressCode;
    void styleOverrides;
    expect(JSON.stringify(rest)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("las plantillas solo contienen presentación", () => {
  it.each(invitationTemplates.map((template) => [template.slug, template] as const))("%s: solo claves de presentación", (_slug, template) => {
    for (const key of Object.keys(template)) expect(TEMPLATE_KEYS).toContain(key);
  });

  it.each(invitationTemplates.map((template) => [template.slug, template] as const))(
    "%s: no incluye ningún texto de la invitación",
    (_slug, template) => {
      const templateText = JSON.stringify(template);
      // Texto natural del usuario: con espacios o que empieza en mayúscula (excluye identificadores y URLs).
      const userStrings = collectStrings(andreaFernandoInvitation).filter(
        (text) => text.length > 3 && /^\p{Lu}|\s/u.test(text) && !/^https?:|^#|^\d{4}-/.test(text),
      );
      expect(userStrings.length).toBeGreaterThan(20);
      for (const text of userStrings) expect(templateText).not.toContain(text);
    },
  );

  it("cada plantilla tiene un slug único", () => {
    const slugs = invitationTemplates.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(expect.arrayContaining(["magnolia", "ivory", "etoile"]));
  });

  it("los archivos de plantilla no importan datos ni componentes", () => {
    const dir = join(ROOT, "lib/invitation/templates");
    for (const file of sourceFiles(dir)) {
      const source = read(file);
      expect(source, relative(ROOT, file)).not.toMatch(/lib\/invitation\/mock|types\/invitation["']|components\//);
    }
  });
});

describe("las secciones son genéricas (sin código por plantilla)", () => {
  const files = sourceFiles(join(ROOT, "components/invitation"));

  it("existen componentes de invitación que revisar", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(["magnolia", "ivory", "etoile"])("ningún archivo de components/invitation menciona «%s»", (name) => {
    for (const file of files) {
      expect(relative(ROOT, file).toLowerCase(), "nombre de archivo").not.toContain(name);
      expect(read(file).toLowerCase(), relative(ROOT, file)).not.toContain(name);
    }
  });

  it("ninguna sección ramifica por plantilla (slug) ni importa el registro de plantillas", () => {
    for (const file of files) {
      const source = read(file);
      expect(source, relative(ROOT, file)).not.toMatch(/template\.slug\s*[!=]==?|templateSlug\s*[!=]==?|switch\s*\(\s*template\.slug/);
      expect(source, relative(ROOT, file)).not.toMatch(/lib\/invitation\/templates/);
    }
  });

  it("la invitación no usa tokens ni clases del producto (--lu-* / lu-*)", () => {
    for (const file of files) {
      expect(code(file), relative(ROOT, file)).not.toMatch(/--lu-|(?:^|[\s"'`:])(?:text|bg|border|rounded|shadow|font|ring)-lu-|\blu-(?:container|section|reveal|enter)\b/);
    }
  });

  it("hay una única implementación por tipo de sección y cubre todos los tipos", () => {
    const expected: InvitationSectionType[] = ["hero", "story", "countdown", "locations", "timeline", "gallery", "dressCode", "giftRegistry", "rsvp", "footer"];
    expect(Object.keys(sectionRegistry).sort()).toEqual([...expected].sort());
    expect(new Set(Object.values(sectionRegistry)).size).toBe(expected.length);
  });

  it("la invitación de ejemplo usa exactamente los tipos de sección del registro", () => {
    const types = andreaFernandoInvitation.sections.map((section) => section.type);
    for (const type of types) expect(Object.keys(sectionRegistry)).toContain(type);
  });
});
