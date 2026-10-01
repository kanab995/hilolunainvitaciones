import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { sectionEditors } from "@/components/editor/section-editors/registry";
import type { EditorRowType } from "@/lib/editor/rows";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const editorFiles = [...sourceFiles(join(ROOT, "components/editor")), ...sourceFiles(join(ROOT, "lib/editor"))];

describe("arquitectura del editor", () => {
  it("el editor NO crea otra implementación de la invitación: solo la vista previa usa InvitationRenderer", () => {
    const users = editorFiles.filter((file) => /InvitationRenderer/.test(code(file))).map((file) => relative(ROOT, file).replaceAll("\\", "/"));
    expect(users).toEqual(["components/editor/preview-surface.tsx"]);
  });

  it("el editor no importa las secciones de la invitación ni sus primitivas", () => {
    for (const file of editorFiles) expect(code(file), relative(ROOT, file)).not.toMatch(/components\/invitation\/(sections|primitives)/);
  });

  it("el editor modifica DATOS: nunca importa ni escribe el tema de una plantilla", () => {
    for (const file of editorFiles) {
      expect(code(file), relative(ROOT, file)).not.toMatch(/templates\/(magnolia|ivory|etoile)/);
      expect(code(file), relative(ROOT, file)).not.toMatch(/\.(colors|layout|effects|decor|componentStyles|animations)\s*=[^=]/);
    }
  });

  it("hay un editor por tipo de fila y el panel no se ramifica por tipo de sección", () => {
    const expected: EditorRowType[] = ["hero", "date", "countdown", "locations", "story", "gallery", "timeline", "giftRegistry", "rsvp", "music", "dressCode", "footer"];
    expect(Object.keys(sectionEditors).sort()).toEqual([...expected].sort());
    expect(new Set(Object.values(sectionEditors)).size).toBe(expected.length);
    expect(code(join(ROOT, "components/editor/editor-panel.tsx"))).not.toMatch(/\.type\s*===|switch\s*\(/);
  });

  it("solo la API central del borrador escribe en él: los editores no crean estado propio del contenido", () => {
    for (const file of sourceFiles(join(ROOT, "components/editor/section-editors"))) {
      // Solo estado local de interfaz (campos parciales de fecha/hora, opción recordada), nunca el contenido.
      const useStates = [...code(file).matchAll(/useState[(<]/g)].length;
      expect(useStates, relative(ROOT, file)).toBeLessThanOrEqual(3);
    }
  });

  it("no se usa HTML arbitrario ni fuentes no aprobadas", () => {
    for (const file of [...editorFiles, ...sourceFiles(join(ROOT, "components/invitation"))]) {
      expect(code(file), relative(ROOT, file)).not.toMatch(/dangerouslySetInnerHTML/);
    }
    for (const file of editorFiles) expect(code(file), relative(ROOT, file)).not.toMatch(/Playfair|Montserrat/);
  });

  it("no hay alertas del navegador ni persistencia en localStorage", () => {
    for (const file of editorFiles) {
      expect(code(file), relative(ROOT, file)).not.toMatch(/\balert\(|\bconfirm\(|\bprompt\(/);
      expect(code(file), relative(ROOT, file)).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    }
  });

  it("la música no incorpora reproductores de terceros", () => {
    for (const file of editorFiles) expect(code(file), relative(ROOT, file)).not.toMatch(/<iframe[^>]*(spotify|youtube)|new Audio\(|<audio|Spotify\.Player|YT\.Player/i);
  });

  it("las únicas dependencias añadidas al stack base son Prisma (D-22), Clerk (D-24), el SDK de AWS S3 (D-27), el generador de QR (D-30), el SDK oficial de Stripe (D-31), el de Resend (D-36) y el de Sentry (D-37); ni drag & drop, formularios ni Zod", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "@clerk/nextjs", "@prisma/client", "@sentry/node", "class-variance-authority", "cn", "lucide-react", "next", "prisma", "qrcode-generator", "radix-ui", "react", "react-dom", "resend", "shadcn", "stripe", "tw-animate-css"]);
  });
});
