/**
 * Gancho de arranque de Next.js (se ejecuta una vez al iniciar el servidor). En producción comprueba la configuración crítica y, si falta o es
 * incoherente algo, termina el proceso con un error claro (`runStartupCheck`, `server/config/startup.ts`). No corre en el runtime edge ni durante
 * `next build`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { runStartupCheck } = await import("@/server/config/startup");
  runStartupCheck();
}
