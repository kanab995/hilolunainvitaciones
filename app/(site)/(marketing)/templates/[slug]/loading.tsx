import { Skeleton } from "@/components/ui/skeleton";

/** Carga del detalle de plantilla: título, vista previa y descripción. */
export default function TemplateDetailLoading() {
  return (
    <div role="status" aria-label="Cargando la plantilla" className="lu-container grid gap-10 pt-10 pb-20 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-64" />
      </div>
      <Skeleton className="h-[32rem] w-full max-w-sm justify-self-center rounded-lu-card" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
