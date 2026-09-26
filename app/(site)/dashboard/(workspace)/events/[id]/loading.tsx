import { Skeleton } from "@/components/ui/skeleton";

/** Carga del panel de un evento: la forma de la página (encabezado, banner, tres tarjetas), sin adornos. */
export default function EventLoading() {
  return (
    <div role="status" aria-label="Cargando el evento" className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-3/4 max-w-md" />
        <Skeleton className="h-6 w-64" />
      </div>
      <Skeleton className="h-44 w-full rounded-lu-banner" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 rounded-lu-card" />
        <Skeleton className="h-28 rounded-lu-card" />
        <Skeleton className="h-28 rounded-lu-card" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
