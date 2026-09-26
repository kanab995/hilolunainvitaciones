"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Cambia (p. ej. al elegir otra sección) para restablecer el límite de error. */
  resetKey: string;
}

interface State {
  failed: boolean;
  key: string;
}

/**
 * Aísla el panel de edición: si el formulario de UNA sección falla al dibujarse, el resto del editor
 * (lista, borrador, vista previa, autoguardado) sigue intacto. No es el `SectionBoundary` de la
 * invitación (deuda técnica aparte): solo protege al editor.
 */
export class EditorErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lu-card border border-lu-error/30 bg-lu-error-bg p-5 text-lu-sm text-lu-text">
        <p>No pudimos mostrar este formulario. Tus cambios no se han perdido.</p>
        <Button variant="secondary" size="sm" onClick={() => this.setState({ failed: false })}>
          Reintentar
        </Button>
      </div>
    );
  }
}
