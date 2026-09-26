/**
 * Cuenta regresiva: función pura. La hora "actual" se inyecta (`nowMs`) para que sea determinista
 * y testeable; en el cliente se toma la hora del servidor como referencia inicial
 * (docs/ARCHITECTURE.md §4.7), no el reloj del dispositivo.
 */

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** El instante objetivo ya pasó. */
  isPast: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function getCountdown(targetIso: string, nowMs: number): CountdownParts {
  const target = Date.parse(targetIso);
  if (Number.isNaN(target)) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };

  const remaining = target - nowMs;
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    isPast: false,
  };
}
