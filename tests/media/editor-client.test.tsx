import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorProvider, type EditorContextValue } from "@/components/editor/editor-context";
import { ImageDropzone } from "@/components/editor/fields/image-dropzone";
import { PhotoField } from "@/components/editor/fields/photo-field";
import { GalleryEditor } from "@/components/editor/section-editors/gallery-editor";
import type { ManagedPhoto, MediaController, TargetStatus } from "@/components/editor/use-media-controller";
import { putFile, UploadError, type XhrLike } from "@/lib/editor/media-upload";
import { mediaMessages } from "@/lib/media/limits";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import type { Invitation } from "@/types/invitation";

const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const IDLE: TargetStatus = { phase: "idle" };
const photo = (over: Partial<ManagedPhoto> = {}): ManagedPhoto => ({ status: IDLE, enabled: true, onFile: () => undefined, onRemove: () => undefined, ...over });

function renderWith(node: React.ReactElement, media: Partial<MediaController> = {}, draft: Invitation = andreaFernandoInvitation) {
  const noop = () => undefined;
  const list = { add: noop, remove: noop, move: noop, patch: noop, reorder: noop };
  const context = {
    draft,
    api: { lists: { gallery: list, locations: list, timeline: list, giftEntries: list }, updateInvitation: noop, updateSection: noop },
    errors: {},
    template: {},
    images: { create: () => "blob:x", revoke: noop, revokeAll: noop, has: () => false, size: 0 },
    media: { cover: photo(), location: () => undefined, gallery: { status: IDLE, enabled: true, add: noop, remove: noop, removeStatus: () => IDLE }, ...media },
    selectRow: noop,
  } as unknown as EditorContextValue;
  return html(<EditorProvider value={context}>{node}</EditorProvider>);
}

describe("Selector de imagen (móvil primero)", () => {
  it("acepta solo JPG, PNG y WEBP, sin `capture` (el móvil ofrece galería y cámara), con nombre accesible completo", () => {
    const markup = html(<ImageDropzone label="Cambiar imagen" accessibleLabel="Cambiar imagen de portada" onFile={() => undefined} status={IDLE} />);
    expect(markup).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(markup).not.toMatch(/capture/i);
    expect(markup).toContain('aria-label="Cambiar imagen de portada"');
    expect(markup).not.toContain("disabled");
  });

  it("estados visibles: Subiendo… (con % solo si es real), Procesando…, Guardado y error — sin alert() del navegador", () => {
    const render = (status: TargetStatus) => html(<ImageDropzone label="Cambiar imagen" onFile={() => undefined} status={status} />);
    expect(render({ phase: "uploading" })).toContain("Subiendo…");
    expect(render({ phase: "uploading" })).not.toContain("%");
    expect(render({ phase: "uploading", progress: 0.436 })).toContain("Subiendo… 44 %");
    expect(render({ phase: "processing" })).toContain("Procesando…");
    expect(render({ phase: "saved" })).toContain("Guardado");
    const failed = render({ phase: "error", message: mediaMessages.uploadFailed });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain(mediaMessages.uploadFailed);
    // Mientras sube o procesa no se puede elegir otro archivo.
    expect(render({ phase: "uploading" })).toContain("disabled");
  });

  it("sin almacenamiento la carga se desactiva con un mensaje claro (no se finge guardar)", () => {
    const markup = html(<ImageDropzone label="Añadir imagen" onFile={() => undefined} disabledReason={mediaMessages.notConfigured} />);
    expect(markup).toContain("disabled");
    expect(markup).toContain(mediaMessages.notConfigured);
    expect(markup).not.toContain("Solo vista previa");
  });

  it("imagen local (campos aún sin guardar): dice que es solo vista previa", () => {
    expect(html(<ImageDropzone label="Añadir imagen" onFile={() => undefined} notice="Solo vista previa — aún no se guarda." />)).toContain("Solo vista previa");
  });

  it("PhotoField gestionado: nombres accesibles «Cambiar imagen de portada» y «Eliminar imagen de portada»; alt opcional", () => {
    const markup = renderWith(
      <PhotoField id="cover-photo" label="Imagen de portada" image={{ src: "https://media.test/users/u/events/e/x.webp", alt: "", mediaAssetId: "a1" }} defaultAlt="Foto" managed={photo()} subject="de portada" onChange={() => undefined} />,
    );
    expect(markup).toContain('aria-label="Cambiar imagen de portada"');
    expect(markup).toContain('aria-label="Eliminar imagen de portada"');
    expect(markup).toMatch(/dejarlo vacío|decorativa/);
    expect(markup).not.toContain("Solo vista previa");
  });

  it("PhotoField sin `managed` (p. ej. ilustración del dress code) conserva la vista previa local con su aviso", () => {
    const markup = renderWith(<PhotoField id="dress" label="Ilustración" image={undefined} defaultAlt="x" onChange={() => undefined} />);
    expect(markup).toContain("Solo vista previa");
  });
});

describe("Editor de galería", () => {
  it("conserva «Mover arriba/abajo» y nombres como «Eliminar foto 2 de la galería»", () => {
    const markup = renderWith(<GalleryEditor section={andreaFernandoInvitation.sections.find((section) => section.type === "gallery")} />);
    expect(markup).toContain('aria-label="Mover foto 2 de la galería arriba"');
    expect(markup).toContain('aria-label="Mover foto 2 de la galería abajo"');
    expect(markup).toContain('aria-label="Eliminar foto 2 de la galería"');
    expect(markup).toContain('aria-label="Agregar imagen a la galería"');
  });

  it("sin almacenamiento: mensaje claro en lugar de la nota de «demo»", () => {
    const markup = renderWith(<GalleryEditor section={andreaFernandoInvitation.sections.find((section) => section.type === "gallery")} />, {
      gallery: { status: IDLE, enabled: false, disabledReason: mediaMessages.notConfigured, add: () => undefined, remove: () => undefined, removeStatus: () => IDLE },
    });
    expect(markup).toContain(mediaMessages.notConfigured);
    expect(markup).not.toContain("no se guardan todavía");
  });
});

describe("Subida directa (PUT firmado) con progreso real", () => {
  function fakeXhr(status: number, script: (xhr: XhrLike) => void) {
    const sent: { method?: string; url?: string; headers: Record<string, string>; body?: unknown } = { headers: {} };
    const xhr: XhrLike = {
      status,
      upload: { onprogress: null },
      onload: null,
      onerror: null,
      onabort: null,
      open: (method, url) => Object.assign(sent, { method, url }),
      setRequestHeader: (name, value) => (sent.headers[name] = value),
      send: (body) => {
        sent.body = body;
        script(xhr);
      },
      abort: () => xhr.onabort?.(),
    };
    return { xhr, sent };
  }
  const request = { url: "https://upload.test/k?signature=x", method: "PUT" as const, headers: { "Content-Type": "image/png" } };

  it("envía el binario con las cabeceras del permiso e informa del progreso REAL (nunca falso)", async () => {
    const progress: number[] = [];
    const { xhr, sent } = fakeXhr(200, (x) => {
      x.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
      x.upload.onprogress?.({ lengthComputable: false, loaded: 50, total: 0 }); // sin dato real: se ignora
      x.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
      x.onload?.();
    });
    const file = new Blob(["abc"], { type: "image/png" });
    await putFile(request, file, { onProgress: (fraction) => progress.push(fraction), createXhr: () => xhr });
    expect(sent).toMatchObject({ method: "PUT", url: request.url, headers: { "Content-Type": "image/png" } });
    expect(sent.body).toBe(file);
    expect(progress).toEqual([0.25, 1]);
  });

  it("un error del servidor o de red da un mensaje humano, sin URL, firma ni códigos del proveedor", async () => {
    for (const script of [(x: XhrLike) => x.onload?.(), (x: XhrLike) => x.onerror?.()]) {
      const { xhr } = fakeXhr(403, script);
      const failure = await putFile(request, new Blob(["x"]), { createXhr: () => xhr }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(UploadError);
      expect((failure as Error).message).toBe(mediaMessages.uploadFailed);
      expect((failure as Error).message).not.toMatch(/signature|upload\.test|403/);
    }
  });

  it("se puede cancelar", async () => {
    const controller = new AbortController();
    const { xhr } = fakeXhr(0, () => controller.abort());
    const failure = await putFile(request, new Blob(["x"]), { signal: controller.signal, createXhr: () => xhr }).catch((error: unknown) => error);
    expect(failure).toMatchObject({ name: "UploadError", aborted: true });
  });
});
