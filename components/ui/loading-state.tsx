import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Carga a nivel de sección/página: spinner + mensaje breve. */
export function LoadingState({
  label = "Cargando…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-lu-brown-500", className)}
    >
      <Spinner size={28} label={label} />
      <p className="text-lu-sm text-lu-text-muted">{label}</p>
    </div>
  );
}

/** Esqueleto genérico de tarjeta (título + dos líneas), para listas de contenido. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-hidden="true" className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="h-6 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </Card>
  );
}
