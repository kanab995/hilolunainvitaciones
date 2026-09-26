import { mediaMessages } from "@/lib/media/limits";

/**
 * SUBIDA DIRECTA del binario a la URL temporal que emitió el servidor (PUT). Usa XHR porque `fetch` no informa
 * del progreso real de la subida. El navegador nunca conoce bucket, endpoint ni credenciales: solo esta URL y
 * las cabeceras que debe reenviar. Sin progreso falso: `onProgress` solo se llama con bytes realmente enviados.
 */
export interface UploadRequest {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface XhrLike {
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  send(body: Blob): void;
  abort(): void;
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly aborted = false,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export function putFile(
  request: UploadRequest,
  file: Blob,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal; createXhr?: () => XhrLike } = {},
): Promise<void> {
  const { onProgress, signal, createXhr = () => new XMLHttpRequest() as unknown as XhrLike } = options;
  return new Promise<void>((resolve, reject) => {
    const xhr = createXhr();
    xhr.open(request.method, request.url);
    for (const [name, value] of Object.entries(request.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError(mediaMessages.uploadFailed)));
    xhr.onerror = () => reject(new UploadError(mediaMessages.uploadFailed));
    xhr.onabort = () => reject(new UploadError(mediaMessages.interrupted, true));
    if (signal) {
      if (signal.aborted) return reject(new UploadError(mediaMessages.interrupted, true));
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });
}
