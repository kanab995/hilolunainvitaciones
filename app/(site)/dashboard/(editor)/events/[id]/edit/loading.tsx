import { Skeleton } from "@/components/ui/skeleton";

/** Carga del editor: barra superior, lista de secciones y área de edición. */
export default function EditorLoading() {
  return (
    <div role="status" aria-label="Cargando el editor" className="flex min-h-svh flex-col">
      <div className="flex h-16 items-center gap-4 border-b border-lu-border-subtle px-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="ml-auto h-9 w-28" />
      </div>
      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <Skeleton className="hidden h-96 lg:block" />
        <Skeleton className="h-96" />
        <Skeleton className="hidden h-96 lg:block" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
