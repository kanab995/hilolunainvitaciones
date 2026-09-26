import Link from "next/link";
import { Button } from "@/components/ui/button";
import { adminCopy } from "@/lib/admin/copy";
import { adminHref, type PageWindow } from "@/lib/admin/query";

/**
 * PAGINACIÓN de servidor: enlaces «Anterior» / «Siguiente» que conservan los filtros (`params`) y cambian solo `page`. En los extremos el
 * botón se muestra desactivado (`aria-disabled`, sin enlace). Muestra el total de resultados y «Página X de Y».
 */
export function AdminPagination({ path, params, window }: { path: string; params: Readonly<Record<string, string | undefined>>; window: PageWindow }) {
  const { page, pageCount, total } = window;
  return (
    <nav aria-label={adminCopy.common.pagination} className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-lu-sm text-lu-text-muted">
        {adminCopy.common.results(total)}
        {pageCount > 1 ? ` · ${adminCopy.common.pageOf(page, pageCount)}` : ""}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={adminHref(path, { ...params, page: page - 1 })} rel="prev">
                {adminCopy.common.previous}
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled aria-disabled="true">
              {adminCopy.common.previous}
            </Button>
          )}
          {page < pageCount ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={adminHref(path, { ...params, page: page + 1 })} rel="next">
                {adminCopy.common.next}
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled aria-disabled="true">
              {adminCopy.common.next}
            </Button>
          )}
        </div>
      ) : null}
    </nav>
  );
}
