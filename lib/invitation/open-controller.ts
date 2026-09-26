/**
 * Controlador de la apertura de la invitación ("Abrir invitación"). Lógica pura, sin React.
 *
 * Es el punto de enganche para la música futura (docs/ARCHITECTURE.md §10.1): el reproductor se
 * suscribe con `subscribe()` y su `startFromGesture()` se ejecuta SÍNCRONAMENTE dentro de `open()`,
 * que a su vez se llama desde el manejador del clic (Safari/iOS exige que `play()` ocurra dentro
 * del gesto del usuario). Hoy no hay ningún suscriptor: no se reproduce nada.
 */
export type OpenListener = () => void;

export interface OpenController {
  /** ¿Ya se abrió? */
  isOpened(): boolean;
  /** Abre (una sola vez): avisa a los suscriptores de inmediato y en orden. Devuelve `true` si abrió ahora. */
  open(): boolean;
  /** Suscribe un oyente; devuelve la función para cancelarlo. Si ya está abierta no se reenvía el aviso. */
  subscribe(listener: OpenListener): () => void;
}

export function createOpenController(): OpenController {
  let opened = false;
  const listeners = new Set<OpenListener>();

  return {
    isOpened: () => opened,
    open() {
      if (opened) return false;
      opened = true;
      for (const listener of [...listeners]) listener();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
