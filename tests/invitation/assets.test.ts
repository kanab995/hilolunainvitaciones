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
const publicFiles = readdirSync(join(ROOT, "public/templates/magnolia")).filter((file) => file.endsWith(".png"));

/**
 * Assets `/templates/magnolia/*.png` referenciados en el código (plantillas y datos), sin tests ni docs:
 * ya sea con la ruta completa o a través de la constante de carpeta (`${assets}/cover-bg.png`).
 */
const referenced = new Set(
  ["lib", "components", "app"]
    .flatMap((dir) => sourceFiles(join(ROOT, dir)))
    .flatMap((file) => [...readFileSync(file, "utf8").matchAll(/(?:magnolia|\})\/([\w-]+\.(?:png|webp|jpg|svg))/g)].map((m) => m[1] as string)),
);

describe("registro de assets (docs/ASSET_LICENSES.md §5.1)", () => {
  it("el código usa los 10 assets aprobados de Magnolia", () => {
    expect([...referenced].sort()).toEqual(
      [
        "cover-bg.png",
        "ceremony-chapel.png",
        "reception-hacienda.png",
        "gallery-couple.png",
        "gallery-bouquet.png",
        "gallery-rings.png",
        "gallery-table.png",
        "dress-code.png",
        "gift-registry.png",
        "decor-corners.png",
      ].sort(),
    );
  });

  it("todo asset referenciado existe en public/ (nunca una imagen externa)", () => {
    for (const file of referenced) expect(existsSync(join(ROOT, "public/templates/magnolia", file)), file).toBe(true);
  });

  it("todo archivo de public/templates/magnolia está registrado, una fila por archivo", () => {
    for (const file of publicFiles) {
      const rows = licenses.split("\n").filter((line) => line.startsWith("| ") && line.includes(`| ${file} |`));
      expect(rows, `${file} debe tener una fila propia en ASSET_LICENSES.md`).toHaveLength(1);
      const row = rows[0] ?? "";
      expect(row).toContain("ChatGPT / OpenAI image generation");
      expect(row).toContain("OpenAI — generado bajo dirección del propietario de Hilo Luna");
      expect(row).toContain("OpenAI Terms of Use — Output ownership");
      expect(row).toContain("https://openai.com/policies/terms-of-use/");
      expect(row).toContain("2026-09-24");
      expect(row).toContain("activo");
    }
  });

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
