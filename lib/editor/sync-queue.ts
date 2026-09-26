/**
 * COLA DE SINCRONIZACIÓN del editor (D-29). Guardar el borrador, subir/quitar imágenes y publicar hablan todos con
 * el servidor sobre la MISMA revisión del borrador: se ejecutan de UNA en UNA, en orden, para que ninguna petición
 * salga con una revisión vieja (y para que publicar nunca adelante a un guardado pendiente). También guarda la última
 * revisión conocida del borrador (`revision`), que cada operación del servidor actualiza al terminar.
 */
export class SyncQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private current: number;

  constructor(initialRevision: number) {
    this.current = initialRevision;
  }

  getRevision(): number {
    return this.current;
  }

  /** Registra una revisión mayor que la conocida (las respuestas fuera de orden no la hacen retroceder). */
  advance(value: number): void {
    if (Number.isInteger(value) && value > this.current) this.current = value;
  }

  /** Fuerza la revisión (p. ej. tras un conflicto, con la que informa el servidor). */
  reset(value: number): void {
    this.current = value;
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.catch(() => undefined);
    return run;
  }
}
