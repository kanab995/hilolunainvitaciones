"use client";

import { Plus, Search, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { DeleteGuestDialog } from "@/components/guests/delete-guest-dialog";
import { GuestFormDialog } from "@/components/guests/guest-form-dialog";
import { GuestList } from "@/components/guests/guest-list";
import { ManualCopyDialog } from "@/components/guests/manual-copy-dialog";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { GuestQrDialog } from "@/components/share/guest-qr-dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { controlStyles, Input } from "@/components/ui/input";
import { billingCopy } from "@/lib/billing/copy";
import { copyToClipboard } from "@/lib/dashboard/share";
import { guestsCopy, statusFilterLabels } from "@/lib/guests/copy";
import { guestFiltersToSearch, hasActiveFilters } from "@/lib/guests/filter";
import { cn } from "@/lib/utils";
import type { GuestFilters, GuestGroupOption, GuestRow, GuestStatusFilter } from "@/types/guests";
import type { PublicationState } from "@/types/published";

const STATUS_ORDER: readonly GuestStatusFilter[] = ["all", "confirmed", "pending", "declined"];

/**
 * Lista interactiva de invitados. El servidor entrega los invitados YA filtrados por la URL
 * (`?q=&status=&group=`, única fuente de los filtros: aquí no hay estado duplicado, solo el texto que se
 * está escribiendo) y aquí se navega al cambiarlos. Alta, edición y baja abren diálogos y llaman a las
 * Server Actions, que revalidan la página al terminar.
 */
export function GuestManager({
  eventId,
  guests,
  totalCount,
  groups,
  filters,
  publication,
  guestLimit,
}: {
  eventId: string;
  guests: readonly GuestRow[];
  totalCount: number;
  groups: readonly GuestGroupOption[];
  filters: GuestFilters;
  /** Slug público y estado de publicación: el QR de un invitado solo existe con la invitación publicada (D-30). */
  publication: { slug: string; state: PublicationState };
  /** Cupo de invitados del plan de ESTE evento (D-32). La interfaz solo lo refleja (deshabilita «Agregar»); el bloqueo real lo aplica el servidor. `max: null` = sin límite. */
  guestLimit?: { count: number; max: number | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const [formTarget, setFormTarget] = useState<{ guest?: GuestRow } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuestRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<GuestRow | null>(null);
  const [qrTarget, setQrTarget] = useState<GuestRow | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const navigate = useCallback(
    (next: GuestFilters) => startTransition(() => router.replace(`${pathname}${guestFiltersToSearch(next)}`, { scroll: false })),
    [pathname, router],
  );

  // Búsqueda: espera a que la persona deje de escribir antes de pedir la lista al servidor.
  useEffect(() => {
    if (query.trim() === filters.q.trim()) return;
    const timer = setTimeout(() => navigate({ ...filters, q: query }), 300);
    return () => clearTimeout(timer);
  }, [query, filters, navigate]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const showNotice = (text: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const copyInvitation = async (guest: GuestRow) => {
    if (await copyToClipboard(guest.inviteUrl)) showNotice(guestsCopy.copied(guest.name));
    else setManualCopy(guest);
  };

  const closeForm = useCallback(() => setFormTarget(null), []);
  const closeDelete = useCallback(() => setDeleteTarget(null), []);

  const filtering = hasActiveFilters(filters);
  const atGuestLimit = guestLimit !== undefined && guestLimit.max !== null && guestLimit.count >= guestLimit.max;
  const limitNotice = atGuestLimit ? <UpgradePrompt message={billingCopy.limitReached.maxGuestsPerEvent} eventId={eventId} /> : null;

  if (totalCount === 0) {
    return (
      <>
        {limitNotice}
        <EmptyState
          variant="dashed"
          title={guestsCopy.empty.title}
          description={guestsCopy.empty.description}
          action={
            <Button size="lg" disabled={atGuestLimit} onClick={() => setFormTarget({})}>
              <Plus aria-hidden="true" />
              {guestsCopy.empty.cta}
            </Button>
          }
        />
        {formTarget ? <GuestFormDialog eventId={eventId} groups={groups} onClose={closeForm} /> : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {limitNotice}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <Button size="lg" disabled={atGuestLimit} onClick={() => setFormTarget({})}>
            <Plus aria-hidden="true" />
            {guestsCopy.add}
          </Button>
          <Button size="lg" variant="secondary" disabled aria-label={`${guestsCopy.import} (${guestsCopy.importSoon.toLowerCase()})`}>
            <Upload aria-hidden="true" />
            {guestsCopy.import}
            <span className="text-lu-sm text-lu-text-muted">· {guestsCopy.importSoon}</span>
          </Button>
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-lu-text-muted" />
          <Input
            type="search"
            name="q"
            aria-label={guestsCopy.search.label}
            placeholder={guestsCopy.search.placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label={guestsCopy.filters.statusLabel} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {STATUS_ORDER.map((status) => (
            <Chip key={status} active={filters.status === status} onClick={() => navigate({ ...filters, status })} className="px-4">
              {statusFilterLabels[status]}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="guest-group-filter" className="sr-only">
            {guestsCopy.filters.groupLabel}
          </label>
          <select
            id="guest-group-filter"
            value={filters.group}
            onChange={(event) => navigate({ ...filters, group: event.target.value })}
            className={cn(controlStyles, "h-(--lu-h-md) w-full font-lu-sans text-lu-base lg:w-56")}
          >
            <option value="">{guestsCopy.filters.allGroups}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
            <option value="none">{guestsCopy.filters.noGroup}</option>
          </select>
        </div>
      </div>

      <div className="flex min-h-6 items-center justify-between gap-3 text-lu-sm text-lu-text-muted">
        <p aria-live="polite">{guestsCopy.shown(guests.length, totalCount)}</p>
        <p role="status" className="text-right text-lu-text">
          {notice}
        </p>
      </div>

      {guests.length === 0 ? (
        <EmptyState
          title={guestsCopy.noResults.title}
          description={guestsCopy.noResults.description}
          action={
            filtering ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  navigate({ q: "", status: "all", group: "" });
                }}
              >
                {guestsCopy.filters.clear}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <GuestList guests={guests} onEdit={(guest) => setFormTarget({ guest })} onDelete={setDeleteTarget} onCopy={copyInvitation} onQr={setQrTarget} />
      )}

      {formTarget ? <GuestFormDialog key={formTarget.guest?.id ?? "new"} eventId={eventId} groups={groups} guest={formTarget.guest} onClose={closeForm} /> : null}
      {deleteTarget ? <DeleteGuestDialog eventId={eventId} guest={deleteTarget} onClose={closeDelete} /> : null}
      {qrTarget ? <GuestQrDialog guest={qrTarget} slug={publication.slug} state={publication.state} eventId={eventId} onClose={() => setQrTarget(null)} /> : null}
      {manualCopy ? <ManualCopyDialog name={manualCopy.name} url={manualCopy.inviteUrl} onClose={() => setManualCopy(null)} /> : null}
    </div>
  );
}
