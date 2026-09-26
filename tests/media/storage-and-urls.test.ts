import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMediaCapability } from "@/server/services/media-capability";
import { readStorageConfig } from "@/server/storage/config";
import { buildMediaKey, MEDIA_KEY_PATTERN } from "@/server/storage/keys";
import { buildMediaUrl, getMediaUrl } from "@/server/storage/public-url";

const ROOT = process.cwd();
const FULL_ENV = {
  S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  S3_REGION: "auto",
  S3_BUCKET: "hiloluna-media",
  S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
  S3_SECRET_ACCESS_KEY: "secret-example",
  S3_PUBLIC_BASE_URL: "https://media.hiloluna.com/",
};

afterEach(() => vi.unstubAllEnvs());

describe("Configuración del almacenamiento", () => {
  it("con las variables completas está configurado; la región por defecto es «auto»", () => {
    expect(readStorageConfig(FULL_ENV)).toMatchObject({ bucket: "hiloluna-media", region: "auto", publicBaseUrl: "https://media.hiloluna.com/" });
    expect(readStorageConfig({ ...FULL_ENV, S3_REGION: undefined })?.region).toBe("auto");
  });

  it("si falta CUALQUIER variable (o una URL no es http/https) las subidas quedan desactivadas", () => {
    for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"] as const) {
      expect(readStorageConfig({ ...FULL_ENV, [key]: "" }), key).toBeUndefined();
      expect(readStorageConfig({ ...FULL_ENV, [key]: undefined }), key).toBeUndefined();
    }
    expect(readStorageConfig({ ...FULL_ENV, S3_ENDPOINT: "ftp://x" })).toBeUndefined();
    expect(readStorageConfig({ ...FULL_ENV, S3_PUBLIC_BASE_URL: "no es url" })).toBeUndefined();
  });

  it("la capacidad del editor: sin almacenamiento o sin base de datos, desactivada con un mensaje claro y sin detalles", () => {
    const off = getMediaCapability({});
    expect(off).toEqual({ enabled: false, persisted: false, reason: "La carga de imágenes no está disponible en este entorno." });
    expect(getMediaCapability({ DATABASE_URL: "postgresql://x" })).toMatchObject({ enabled: false, persisted: true });
    expect(getMediaCapability({ ...FULL_ENV })).toMatchObject({ enabled: false, persisted: false });
    expect(getMediaCapability({ ...FULL_ENV, DATABASE_URL: "postgresql://x" })).toEqual({ enabled: true, persisted: true });
    expect(JSON.stringify(getMediaCapability({ ...FULL_ENV, DATABASE_URL: "postgresql://x" }))).not.toMatch(/secret|AKIA|hiloluna-media|r2\./);
  });
});

describe("Claves y URL derivadas", () => {
  it("las claves son opacas, únicas y con la forma acordada (sin nombre de archivo ni datos personales)", () => {
    const keys = Array.from({ length: 50 }, () => buildMediaKey({ userId: "cmusr1", eventId: "cmevt1", mimeType: "image/webp" }));
    expect(new Set(keys).size).toBe(50);
    for (const key of keys) {
      expect(key).toMatch(MEDIA_KEY_PATTERN);
      expect(key).toMatch(/^users\/cmusr1\/events\/cmevt1\/[0-9a-f]{32}\.webp$/);
    }
    expect(buildMediaKey({ userId: "u", eventId: "e", mimeType: "image/jpeg" })).toMatch(/\.jpg$/);
    expect(MEDIA_KEY_PATTERN.test("users/u/events/e/../../otro.png")).toBe(false);
  });

  it("12. la URL pública se DERIVA de la clave y la base (cambiar de dominio no requiere migrar datos)", () => {
    const key = "users/u1/events/e1/abc123.webp".replace("abc123", "a".repeat(32));
    expect(buildMediaUrl("https://media.hiloluna.com", key)).toBe(`https://media.hiloluna.com/${key}`);
    expect(buildMediaUrl("https://media.hiloluna.com///", key)).toBe(`https://media.hiloluna.com/${key}`);
    expect(buildMediaUrl("https://pub-x.r2.dev", key)).toBe(`https://pub-x.r2.dev/${key}`); // mismo dato, otro dominio
    vi.stubEnv("S3_ENDPOINT", FULL_ENV.S3_ENDPOINT);
    vi.stubEnv("S3_BUCKET", FULL_ENV.S3_BUCKET);
    vi.stubEnv("S3_ACCESS_KEY_ID", FULL_ENV.S3_ACCESS_KEY_ID);
    vi.stubEnv("S3_SECRET_ACCESS_KEY", FULL_ENV.S3_SECRET_ACCESS_KEY);
    vi.stubEnv("S3_PUBLIC_BASE_URL", "https://media.hiloluna.com");
    expect(getMediaUrl(key)).toBe(`https://media.hiloluna.com/${key}`);
    vi.stubEnv("S3_PUBLIC_BASE_URL", "");
    expect(getMediaUrl(key)).toBeUndefined();
  });

  it("el esquema no guarda URL ni firmas: solo la clave y metadatos", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    const model = /model MediaAsset \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(model).toMatch(/storageKey\s+String\s+@unique/);
    expect(model).not.toMatch(/\b(url|signedUrl|publicUrl|bucket|endpoint)\b\s+String/i);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("Los secretos nunca llegan al navegador", () => {
  const clientish = [...sourceFiles(join(ROOT, "components")), ...sourceFiles(join(ROOT, "lib")), ...sourceFiles(join(ROOT, "types"))];

  it("13. ningún componente, utilidad compartida ni tipo importa el SDK ni lee S3_*", () => {
    for (const file of clientish) {
      const code = readFileSync(file, "utf8");
      const where = relative(ROOT, file);
      expect(code, where).not.toMatch(/@aws-sdk/);
      expect(code, where).not.toMatch(/\bS3_(SECRET|ACCESS|ENDPOINT|BUCKET)/);
      expect(code, where).not.toMatch(/process\.env\.S3_/);
    }
  });

  it("los archivos «use client» solo hablan con el servidor por Server Actions (jamás importan `server/`)", () => {
    const all = [...clientish, ...sourceFiles(join(ROOT, "app"))];
    for (const file of all) {
      const code = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(code)) continue;
      expect(code, relative(ROOT, file)).not.toMatch(/^import(?! type).*from "@\/server\//m); // los `import type` no llevan código al navegador
    }
  });

  it("ninguna variable de almacenamiento es pública (`NEXT_PUBLIC_`) y `.env.example` no lleva valores reales", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(example).not.toMatch(/NEXT_PUBLIC_S3/);
    for (const name of ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"]) expect(example).toMatch(new RegExp(`^${name}=`, "m"));
    expect(example).not.toMatch(/^S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)=.+/m);
  });

  it("los tipos compartidos y las acciones no exponen claves de objeto ni credenciales al navegador", () => {
    const types = readFileSync(join(ROOT, "types/media.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(types).not.toMatch(/storageKey|bucket|endpoint|accessKey|secret/i);
  });
});

describe("next.config: imágenes remotas solo desde el host configurado", () => {
  async function loadConfig() {
    vi.resetModules();
    return (await import("../../next.config")).default;
  }

  it("sin S3_PUBLIC_BASE_URL no se permite ningún host remoto", async () => {
    vi.stubEnv("S3_PUBLIC_BASE_URL", "");
    expect((await loadConfig()).images?.remotePatterns ?? []).toEqual([]);
  });

  it("con la variable, solo ese host y solo la ruta de los archivos gestionados; nunca comodines de host", async () => {
    vi.stubEnv("S3_PUBLIC_BASE_URL", "https://media.hiloluna.com");
    const patterns = (await loadConfig()).images?.remotePatterns ?? [];
    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({ protocol: "https", hostname: "media.hiloluna.com", pathname: "/users/**" });
    for (const pattern of patterns as { hostname: string }[]) expect(pattern.hostname).not.toMatch(/\*/);
    expect((await loadConfig()).images?.dangerouslyAllowLocalIP).toBeUndefined();
  });

  it("un host local de pruebas solo se admite fuera de producción", async () => {
    vi.stubEnv("S3_PUBLIC_BASE_URL", "http://localhost:4568/hiloluna");
    const dev = await loadConfig();
    expect(dev.images?.remotePatterns?.[0]).toMatchObject({ protocol: "http", hostname: "localhost", port: "4568", pathname: "/hiloluna/users/**" });
    expect(dev.images?.dangerouslyAllowLocalIP).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect((await loadConfig()).images?.dangerouslyAllowLocalIP).toBeUndefined();
  });
});
