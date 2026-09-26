"use client";

import { ArrowRight } from "lucide-react";
import { useInvitationOpen } from "@/components/invitation/invitation-shell";
import { invButtonClass } from "@/components/invitation/primitives/inv-button";

/**
 * Botón "Abrir invitación →" de la portada. Al pulsarlo: (1) marca `opened = true` (transición
 * suave de la portada), (2) avisa a los suscriptores del gesto (música futura; hoy ninguno) y
 * (3) desplaza suavemente a la siguiente sección. Sin JS sigue funcionando como un enlace ancla.
 * No reproduce audio.
 */
export function OpenInvitationButton({
  label,
  targetId,
  variant,
}: {
  label: string;
  /** `id` de la siguiente sección visible. */
  targetId?: string;
  variant: "solid" | "outline";
}) {
  const { open } = useInvitationOpen();

  return (
    <a
      href={targetId ? `#${targetId}` : undefined}
      className={invButtonClass(variant, "lg")}
      onClick={(event) => {
        // Síncrono dentro del gesto: aquí (y solo aquí) podrá arrancar la música en el futuro.
        open();
        if (!targetId) return;
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        // Mantiene el foco en el destino para teclado y lectores de pantalla.
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }}
    >
      {label}
      <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
    </a>
  );
}
