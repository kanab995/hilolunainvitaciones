import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === ".next") return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const licenses = readFileSync(join(ROOT, "docs/ASSET_LICENSES.md"), "utf8");
const codeFiles = ["lib", "components", "app"].flatMap((dir) => sourceFiles(join(ROOT, dir)));

/**
 * Assets `/templates/<carpeta>/*.png` referenciados en el código (plantillas y datos), sin tests ni docs:
 * ya sea con la ruta completa o a través de la constante local de carpeta de ESE archivo (`${assets}/x.png`,
 * `${DEMO_IMAGES}/x.png`…). Resuelve la constante por archivo para no mezclar los assets de dos plantillas
 * que usan el mismo patrón `${var}/archivo.ext`.
 */
function referencedIn(folder: string): Set<string> {
  const result = new Set<string>();
  for (const file of codeFiles) {
    const source = readFileSync(file, "utf8");
    const localFolders = new Map<string, string>();
    for (const m of source.matchAll(/const\s+(\w+)\s*=\s*["'`]\/templates\/([\w-]+)["'`]/g)) localFolders.set(m[1] as string, m[2] as string);
    for (const m of source.matchAll(/\/templates\/([\w-]+)\/([\w-]+\.(?:png|webp|jpg|svg))/g)) {
      if (m[1] === folder) result.add(m[2] as string);
    }
    for (const m of source.matchAll(/\$\{(\w+)\}\/([\w-]+\.(?:png|webp|jpg|svg))/g)) {
      if (localFolders.get(m[1] as string) === folder) result.add(m[2] as string);
    }
  }
  return result;
}

/** Un activo aprobado de una plantilla: su carpeta de `public/`, sus 10 archivos exactos y los datos fijos de su fila en ASSET_LICENSES.md. */
interface TemplateAssetSet {
  template: string;
  folder: string;
  files: readonly string[];
  /** Encabezado `### 5.x …` que abre la subsección propia de esta plantilla (las filas no se buscan en todo el documento: dos plantillas pueden compartir un nombre de archivo). */
  section: string;
  /** Fragmentos que DEBEN aparecer en la fila de cada archivo (procedencia). */
  rowMustContain: readonly string[];
  /** Fecha de obtención esperada en la fila. */
  date: string;
}

const MAGNOLIA: TemplateAssetSet = {
  template: "magnolia",
  folder: "public/templates/magnolia",
  files: ["cover-bg.png", "ceremony-chapel.png", "reception-hacienda.png", "gallery-couple.png", "gallery-bouquet.png", "gallery-rings.png", "gallery-table.png", "dress-code.png", "gift-registry.png", "decor-corners.png"],
  section: "### 5.1 Imágenes incorporadas — plantilla Magnolia",
  rowMustContain: ["ChatGPT / OpenAI image generation", "OpenAI — generado bajo dirección del propietario de Hilo Luna", "OpenAI Terms of Use — Output ownership", "https://openai.com/policies/terms-of-use/"],
  date: "2026-09-24",
};

const LEVEL_12: TemplateAssetSet = {
  template: "level-12",
  folder: "public/templates/level-12",
  files: ["cover-bg.png", "decor-corners.png", "location-arena.png", "gallery-1.png", "gallery-2.png", "gallery-3.png", "gallery-4.png", "gallery-5.png", "dress-code.png", "gift-registry.png"],
  section: "### 5.2 Imágenes incorporadas — plantilla Level 12",
  rowMustContain: ["Imagen generada por IA, bajo dirección del propietario", "Original para Hilo Luna, según declaración del propietario"],
  date: "2026-10-01",
};

/** Texto del documento desde el encabezado de ESTA plantilla hasta el siguiente encabezado `##`/`###`. */
function sectionOf(heading: string): string {
  const start = licenses.indexOf(heading);
  expect(start, `no se encontró el encabezado «${heading}»`).toBeGreaterThanOrEqual(0);
  const rest = licenses.slice(start + heading.length);
  const next = rest.search(/\n#{2,3} /);
  return rest.slice(0, next >= 0 ? next : undefined);
}

describe.each([MAGNOLIA, LEVEL_12])("registro de assets de $template (docs/ASSET_LICENSES.md)", ({ template, folder, files, section, rowMustContain, date }) => {
  const publicFiles = readdirSync(join(ROOT, folder)).filter((file) => file.endsWith(".png"));
  const referenced = referencedIn(template);
  const scoped = sectionOf(section);

  it(`el código usa exactamente los ${files.length} assets aprobados`, () => {
    expect([...referenced].sort()).toEqual([...files].sort());
  });

  it("todo asset referenciado existe en public/ (nunca una imagen externa)", () => {
    for (const file of referenced) expect(existsSync(join(ROOT, folder, file)), file).toBe(true);
  });

  it(`todo archivo de ${folder} está registrado, una fila por archivo, en su propia subsección`, () => {
    for (const file of publicFiles) {
      const rows = scoped.split("\n").filter((line) => line.startsWith("| ") && line.includes(`| ${file} |`));
      expect(rows, `${file} debe tener una fila propia en la subsección «${section}»`).toHaveLength(1);
      const row = rows[0] ?? "";
      for (const fragment of rowMustContain) expect(row, `${file}: ${fragment}`).toContain(fragment);
      expect(row).toContain("activo");
    }
  });

  it("la fila de cada archivo está fechada", () => {
    for (const file of publicFiles) {
      const row = scoped.split("\n").find((line) => line.startsWith("| ") && line.includes(`| ${file} |`)) ?? "";
      expect(row.includes(date) || scoped.includes(`Fecha de obtención: **${date}**`), file).toBe(true);
    }
  });
});

describe("imágenes de la invitación: sin externas ni base64", () => {
  it("no hay imágenes externas ni base64 en el código de la invitación", () => {
    const files = ["components/invitation", "lib/invitation"].flatMap((dir) => sourceFiles(join(ROOT, dir)));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(ROOT, file)).not.toMatch(/src\s*[:=]\s*["'`]https?:/);
      expect(source, relative(ROOT, file)).not.toMatch(/data:image\//);
      expect(source, relative(ROOT, file)).not.toMatch(/url\(\s*["']?https?:/);
    }
  });
});
