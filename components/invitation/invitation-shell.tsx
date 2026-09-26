"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createOpenController, type OpenController } from "@/lib/invitation/open-controller";

interface InvitationOpenState {
  opened: boolean;
  /** Abre la invitación. Llamar SIEMPRE desde un manejador de clic (gesto del usuario). */
  open: () => void;
  /** Para el reproductor de música futuro: suscribirse al gesto de apertura. */
  subscribe: OpenController["subscribe"];
}

const InvitationOpenContext = createContext<InvitationOpenState | null>(null);

/**
 * Estado de la apertura de la invitación. `useInvitationOpen()` lo expone a las secciones (hoy solo
 * la portada) y, más adelante, al `MusicController`, que se suscribe con `subscribe()`.
 */
export function useInvitationOpen(): InvitationOpenState {
  const context = useContext(InvitationOpenContext);
  if (!context) throw new Error("useInvitationOpen debe usarse dentro de <InvitationShell>.");
  return context;
}

type InvitationShellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "data-template": string;
  "data-reveal": string;
};

/**
 * Contenedor cliente de la invitación: aloja el estado `opened` y pinta `data-opened` en el
 * `<article>` (los estilos de transición cuelgan de ese atributo). Es la ÚNICA isla que envuelve
 * a las secciones; el resto sigue siendo Server Components.
 */
export function InvitationShell({ children, ...articleProps }: InvitationShellProps) {
  const [controller] = useState(createOpenController);
  const [opened, setOpened] = useState(false);

  const value = useMemo<InvitationOpenState>(
    () => ({
      opened,
      open: () => {
        if (controller.open()) setOpened(true);
      },
      subscribe: controller.subscribe,
    }),
    [controller, opened],
  );

  return (
    <InvitationOpenContext.Provider value={value}>
      <article data-opened={opened} {...articleProps}>
        {children}
      </article>
    </InvitationOpenContext.Provider>
  );
}
