import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import { withAssetVersion, versionedAssetPatterns } from "@/lib/images/asset-version";
import versions from "@/lib/images/asset-versions.json";
import { camilaNovaGradInvitation } from "@/lib/invitation/mock/camila-nova-grad";
import { sofiaLuzDeFeInvitation } from "@/lib/invitation/mock/sofia-luz-de-fe";
import { valeriaMateoMarDeAmorInvitation } from "@/lib/invitation/mock/valeria-mateo-mar-de-amor";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { mateoCelesteInvitation } from "@/lib/invitation/mock/mateo-celeste";
import { nicoSpiderFriendsInvitation } from "@/lib/invitation/mock/nico-spider-friends";
import { santiagoLevel12Invitation } from "@/lib/invitation/mock/santiago-level-12";
import { valentinaAuroraXvInvitation } from "@/lib/invitation/mock/valentina-aurora-xv";
import { babyMateoBabyBloomInvitation } from "@/lib/invitation/mock/baby-mateo-baby-bloom";
import { auroraXvTemplate } from "@/lib/invitation/templates/aurora-xv";
import { babyBloomTemplate } from "@/lib/invitation/templates/baby-bloom";
import { celesteTemplate } from "@/lib/invitation/templates/celeste";
import { level12Template } from "@/lib/invitation/templates/level-12";
import { spiderFriendsTemplate } from "@/lib/invitation/templates/spider-friends";
import { luzDeFeTemplate } from "@/lib/invitation/templates/luz-de-fe";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { marDeAmorTemplate } from "@/lib/invitation/templates/mar-de-amor";
import { novaGradTemplate } from "@/lib/invitation/templates/nova-grad";
import { getTemplateCoverImage } from "@/lib/templates/status";
import { dashboardAssets } from "@/lib/dashboard/assets";
import { render } from "../invitation/helpers";
// @ts-expect-error — módulo .mjs de scripts/, sin tipos (lo usan `predev` y `prebuild`)
import { computeVersions } from "../../scripts/asset-versions.mjs";

const ROOT = process.cwd();
const table = versions as Record<string, string>;

/**
 * Causa raíz de las "imágenes antiguas" (D-45): las URLs de `public/templates/**` no cambian al
 * reemplazar un archivo y el optimizador de Next las guarda `minimumCacheTTL` (4 h por defecto, sin
 * invalidación). La huella de contenido en la URL lo resuelve; estas pruebas impiden que se quede vieja.
 */
describe("huellas de versión de las imágenes de plantilla", () => {
  it("lib/images/asset-versions.json coincide con el contenido REAL de public/templates (si falla: `npm run assets:versions`)", () => {
    expect(table).toEqual(computeVersions());
  });

  it("hay una huella por carpeta de plantilla, incluidas las de las plantillas anteriores", () => {
    const folders = readdirSync(join(ROOT, "public", "templates")).filter((entry) => statSync(join(ROOT, "public", "templates", entry)).isDirectory());
    expect(Object.keys(table).sort()).toEqual(folders.map((folder) => `/templates/${folder}`).sort());
    for (const slug of ["magnolia", "level-12", "aurora-xv", "celeste", "spider-friends", "baby-bloom", "luz-de-fe", "mar-de-amor", "nova-grad"]) {
      expect(table[`/templates/${slug}`], slug).toMatch(/^[0-9a-f]{10}$/);
    }
  });

  it("la huella depende del CONTENIDO y de la carpeta: dos plantillas con los mismos nombres de archivo no comparten huella", () => {
    const hashes = Object.values(table);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(table["/templates/luz-de-fe"]).not.toBe(table["/templates/mar-de-amor"]);
  });
});

describe("withAssetVersion: URL nueva cuando cambia el archivo", () => {
  it("las imágenes de plantilla llevan ?v=<huella de su carpeta>", () => {
    expect(withAssetVersion("/templates/luz-de-fe/cover-bg.png")).toBe(`/templates/luz-de-fe/cover-bg.png?v=${table["/templates/luz-de-fe"]}`);
  });

  it("al cambiar el contenido de la carpeta cambia la URL (por eso ya no hay caché vieja que invalidar)", () => {
    const before = withAssetVersion("/templates/luz-de-fe/gallery-1.png", { "/templates/luz-de-fe": "aaaaaaaaaa" });
    const after = withAssetVersion("/templates/luz-de-fe/gallery-1.png", { "/templates/luz-de-fe": "bbbbbbbbbb" });
    expect(before).toBe("/templates/luz-de-fe/gallery-1.png?v=aaaaaaaaaa");
    expect(after).toBe("/templates/luz-de-fe/gallery-1.png?v=bbbbbbbbbb");
  });

  it("no toca fuentes que no son de plantilla: marca, R2, estáticos de Next, blob:, ni rutas sin huella", () => {
    expect(withAssetVersion("/brand/hiloluna-wordmark.png")).toBe("/brand/hiloluna-wordmark.png");
    expect(withAssetVersion("https://media.example.com/users/u1/foto.jpg")).toBe("https://media.example.com/users/u1/foto.jpg");
    expect(withAssetVersion("/_next/static/media/x.png")).toBe("/_next/static/media/x.png");
    expect(withAssetVersion("blob:http://localhost/abc")).toBe("blob:http://localhost/abc");
    expect(withAssetVersion("/templates/no-existe/x.png")).toBe("/templates/no-existe/x.png");
    expect(withAssetVersion("/templates")).toBe("/templates");
    expect(withAssetVersion("/templates/magnolia/cover-bg.png?v=otro")).toBe("/templates/magnolia/cover-bg.png?v=otro");
  });
});

describe("todo punto que dibuja una imagen de plantilla usa la URL versionada", () => {
  const encodedVersion = (slug: string) => encodeURIComponent(`?v=${table[`/templates/${slug}`]}`);

  it("getTemplateCoverImage (catálogo, detalle, home, asistente de alta)", () => {
    for (const slug of ["magnolia", "level-12", "aurora-xv", "celeste", "spider-friends", "baby-bloom", "luz-de-fe", "mar-de-amor", "nova-grad"]) {
      expect(getTemplateCoverImage(slug)?.src, slug).toBe(`/templates/${slug}/cover-bg.png?v=${table[`/templates/${slug}`]}`);
    }
  });

  it.each([
    ["luz-de-fe", sofiaLuzDeFeInvitation, luzDeFeTemplate],
    ["mar-de-amor", valeriaMateoMarDeAmorInvitation, marDeAmorTemplate],
    ["nova-grad", camilaNovaGradInvitation, novaGradTemplate],
    ["magnolia", andreaFernandoInvitation, magnoliaTemplate],
  ] as const)("la invitación de %s (portada, esquinas, sedes, galería, vestimenta, regalos) pide solo URLs con su huella", (slug, invitation, template) => {
    const html = render(invitation, template);
    const urls = [...html.matchAll(/\/_next\/image\?url=([^&"]+)/g)].map((m) => decodeURIComponent(m[1] ?? "")).filter((u) => u.startsWith("/templates/"));
    expect(urls.length).toBeGreaterThanOrEqual(10);
    for (const url of urls) expect(url, url).toMatch(new RegExp(`^/templates/${slug}/[\\w-]+\\.png\\?v=${table[`/templates/${slug}`]}$`));
    expect(html).toContain(encodedVersion(slug));
  });

  it("el panel (assets de Magnolia) también", () => {
    for (const asset of Object.values(dashboardAssets)) expect(asset.src).toContain(`?v=${table["/templates/magnolia"]}`);
  });
});

describe("next.config: images.localPatterns acepta exactamente las URLs versionadas", () => {
  const patterns = nextConfig.images?.localPatterns ?? [];

  it("deja una entrada exacta (carpeta + huella) por cada plantilla y no activa un cargador personalizado", () => {
    // `loader: "custom"` desactivaría el optimizador interno de Next (/_next/image → 404): se versiona en el `src`.
    expect(nextConfig.images?.loader).toBeUndefined();
    expect(nextConfig.images?.loaderFile).toBeUndefined();
    for (const entry of versionedAssetPatterns()) {
      expect(patterns.some((p) => p.pathname === entry.pathname && p.search === entry.search), `${entry.pathname}${entry.search}`).toBe(true);
    }
    expect(patterns.length).toBe(Object.keys(table).length + 1);
  });

  it("respeta el máximo de 25 entradas de Next (al llegar al límite hay que cambiar de estrategia, ver D-45)", () => {
    expect(patterns.length).toBeLessThanOrEqual(25);
  });

  it("el resto de rutas locales sigue permitido SIN query string (una huella ajena o inventada no pasa)", () => {
    expect(patterns).toContainEqual({ pathname: "/**", search: "" });
    expect(patterns.some((p) => p.search === "?v=deadbeef00")).toBe(false);
  });
});

describe("las referencias del código apuntan a archivos físicos con las dimensiones reales", () => {
  /** Ancho × alto reales leídos de la cabecera IHDR del PNG. */
  const png = (path: string) => {
    const buffer = readFileSync(join(ROOT, "public", path));
    expect(buffer.subarray(1, 4).toString(), path).toBe("PNG");
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  };

  interface Ref {
    src: string;
    width?: number | undefined;
    height?: number | undefined;
  }

  const CASES = [
    { slug: "luz-de-fe", template: luzDeFeTemplate, invitation: sofiaLuzDeFeInvitation },
    { slug: "mar-de-amor", template: marDeAmorTemplate, invitation: valeriaMateoMarDeAmorInvitation },
    { slug: "nova-grad", template: novaGradTemplate, invitation: camilaNovaGradInvitation },
  ] as const;

  const refsOf = ({ template, invitation }: { template: InvitationTemplate; invitation: Invitation }): Ref[] => {
    const refs: Ref[] = [];
    for (const asset of Object.values(template.decor)) if (asset && asset.kind === "image") refs.push({ src: asset.src, width: asset.width, height: asset.height });
    const images = [...invitation.locations.map((l) => l.photo), ...invitation.gallery, invitation.dressCode?.illustration, invitation.giftRegistry?.photo];
    for (const image of images) if (image?.src) refs.push({ src: image.src, width: image.width, height: image.height });
    return refs;
  };

  it.each(CASES)("$slug: portada, esquinas y fotos de la demo existen y declaran su tamaño real", (testCase) => {
    const refs = refsOf(testCase);
    expect(refs.length).toBeGreaterThanOrEqual(10);
    for (const ref of refs) {
      expect(ref.src.startsWith(`/templates/${testCase.slug}/`), ref.src).toBe(true);
      expect(ref.src, "extensión y ruta exactas").toMatch(/\.png$/);
      expect(existsSync(join(ROOT, "public", ref.src)), ref.src).toBe(true);
      expect(statSync(join(ROOT, "public", ref.src)).size, ref.src).toBeGreaterThan(50_000);
      expect({ width: ref.width, height: ref.height }, ref.src).toEqual(png(ref.src));
    }
  });

  it.each(CASES)("$slug: todos los PNG de la carpeta se usan (ninguno huérfano ni referencia a un archivo inexistente)", (testCase) => {
    const used = [...new Set(refsOf(testCase).map((ref) => ref.src))].sort();
    const onDisk = readdirSync(join(ROOT, "public", "templates", testCase.slug))
      .filter((file) => file.endsWith(".png"))
      .map((file) => `/templates/${testCase.slug}/${file}`)
      .sort();
    expect(used).toEqual(onDisk);
  });

  it.each([
    { slug: "celeste", template: celesteTemplate, invitation: mateoCelesteInvitation },
    { slug: "spider-friends", template: spiderFriendsTemplate, invitation: nicoSpiderFriendsInvitation },
    { slug: "level-12", template: level12Template, invitation: santiagoLevel12Invitation },
    { slug: "aurora-xv", template: auroraXvTemplate, invitation: valentinaAuroraXvInvitation },
    { slug: "baby-bloom", template: babyBloomTemplate, invitation: babyMateoBabyBloomInvitation },
  ] as const)("$slug (plantilla anterior): las dimensiones declaradas coinciden con el PNG real", (testCase) => {
    const refs = refsOf(testCase);
    expect(refs.length).toBeGreaterThanOrEqual(8);
    for (const ref of refs) {
      expect(existsSync(join(ROOT, "public", ref.src)), ref.src).toBe(true);
      expect({ width: ref.width, height: ref.height }, ref.src).toEqual(png(ref.src));
    }
  });

  it("decor-corners.png es una hoja 2 × 2 cuadrada con canal alfa (fondo transparente)", () => {
    for (const { slug } of CASES) {
      const buffer = readFileSync(join(ROOT, "public", "templates", slug, "decor-corners.png"));
      expect({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }).toEqual({ width: 1254, height: 1254 });
      // IHDR byte 25 = tipo de color: 6 = RGBA
      expect(buffer[25], slug).toBe(6);
    }
  });
});
