"use client";

import { useEffect, useState } from "react";
import { invitationCopy } from "@/lib/invitation/copy";
import { getCountdown } from "@/lib/invitation/countdown";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Isla cliente de la cuenta regresiva. El primer render usa la hora del SERVIDOR (`serverNowMs`,
 * mismo HTML en servidor y cliente); después avanza cada segundo desde esa referencia, sin fiarse
 * del reloj del dispositivo (docs/ARCHITECTURE.md §4.7). Genérica: no sabe de plantillas ni guarda
 * estado fuera de su propio reloj.
 *
 * Accesible: el conjunto es un `timer` con una etiqueta hablada completa que solo cambia cada
 * minuto (no se anuncia cada segundo); las cifras visibles son decorativas para lectores.
 */
export function CountdownDisplay({ targetIso, serverNowMs }: { targetIso: string; serverNowMs: number }) {
  const [now, setNow] = useState(serverNowMs);

  useEffect(() => {
    const offset = serverNowMs - Date.now();
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [serverNowMs]);

  const parts = getCountdown(targetIso, now);

  if (parts.isPast) {
    return <p className="text-center font-inv-display text-2xl text-inv-ink italic">{invitationCopy.countdown.past}</p>;
  }

  const units = [
    { value: String(parts.days), label: invitationCopy.countdown.days },
    { value: pad(parts.hours), label: invitationCopy.countdown.hours },
    { value: pad(parts.minutes), label: invitationCopy.countdown.minutes },
    { value: pad(parts.seconds), label: invitationCopy.countdown.seconds },
  ];
  const spoken = `${parts.days} días, ${parts.hours} horas y ${parts.minutes} minutos`;

  return (
    <div role="timer" aria-label={spoken} aria-live="off" className="grid grid-cols-4 divide-x divide-inv-line/70 md:grid-cols-[repeat(4,minmax(6.875rem,1fr))]">
      {units.map((unit) => (
        <div key={unit.label} aria-hidden="true" className="flex min-w-0 flex-col items-center gap-2 px-1 md:gap-3 md:px-3">
          <span className="font-inv-display text-[2.5rem] leading-none text-inv-accent [font-variant-numeric:lining-nums_tabular-nums] md:text-[3.25rem]">
            {unit.value}
          </span>
          <span className="block text-center font-inv-body text-[0.625rem] tracking-[0.18em] whitespace-nowrap text-inv-ink-muted uppercase md:text-[clamp(0.75rem,1vw,1rem)] md:tracking-[0.14em]">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
