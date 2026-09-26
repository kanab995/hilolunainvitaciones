import Link from "next/link";
import { Button } from "@/components/ui/button";
import { controlStyles, Input } from "@/components/ui/input";
import { adminCopy } from "@/lib/admin/copy";
import { cn } from "@/lib/utils";

/**
 * FILTROS de una lista: un `<form method="get">` (funciona sin JavaScript y deja los filtros en la URL, que es donde el servidor los lee).
 * Cada control tiene su `<label>` visible. Al filtrar se vuelve a la página 1 (no se envía `page`).
 */
export type FilterField =
  | { kind: "search"; name: string; label: string; value: string; placeholder?: string }
  | { kind: "select"; name: string; label: string; value: string; options: ReadonlyArray<{ value: string; label: string }>; allLabel?: string | undefined };

export function AdminFilters({ path, fields, label }: { path: string; fields: readonly FilterField[]; label: string }) {
  const active = fields.some((field) => field.value !== "");
  return (
    <form method="get" action={path} role="search" aria-label={label} className="flex flex-wrap items-end gap-x-3 gap-y-3 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-4">
      {fields.map((field) => {
        const id = `filter-${field.name}`;
        return (
          <div key={field.name} className={cn("flex min-w-0 flex-col gap-1.5", field.kind === "search" ? "w-full sm:min-w-64 sm:flex-1" : "w-full sm:w-auto sm:min-w-44")}>
            <label htmlFor={id} className="text-lu-sm font-medium text-lu-text">
              {field.label}
            </label>
            {field.kind === "search" ? (
              <Input id={id} type="search" name={field.name} defaultValue={field.value} placeholder={field.placeholder} maxLength={80} autoComplete="off" />
            ) : (
              <select id={id} name={field.name} defaultValue={field.value} className={cn(controlStyles, "h-(--lu-h-md) font-lu-sans text-lu-base")}>
                <option value="">{field.allLabel ?? adminCopy.common.all}</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Button type="submit" size="md" className="max-sm:flex-1">
          {adminCopy.common.filter}
        </Button>
        {active ? (
          <Button asChild variant="ghost" size="md" className="max-sm:flex-1">
            <Link href={path}>{adminCopy.common.clear}</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
