"use client";

import { Link2, MoreHorizontal, Pencil, QrCode, Trash2 } from "lucide-react";
import { GuestStatusBadge } from "@/components/guests/guest-status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { guestsCopy } from "@/lib/guests/copy";
import type { GuestRow } from "@/types/guests";

export interface GuestListActions {
  onEdit: (guest: GuestRow) => void;
  onDelete: (guest: GuestRow) => void;
  onCopy: (guest: GuestRow) => void;
  /** Abre el QR de la invitación personalizada de este invitado (D-30). */
  onQr: (guest: GuestRow) => void;
}

function Contact({ guest }: { guest: GuestRow }) {
  if (!guest.email && !guest.phone) return <span className="text-lu-text-subtle">—</span>;
  return (
    <span className="flex min-w-0 flex-col">
      {guest.email ? <span className="truncate">{guest.email}</span> : null}
      {guest.phone ? <span className="truncate text-lu-text-muted">{guest.phone}</span> : null}
    </span>
  );
}

/** Acciones de una fila de escritorio: botones con etiqueta accesible que nombra a la persona. */
function RowActions({ guest, onEdit, onDelete, onCopy, onQr }: { guest: GuestRow } & GuestListActions) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconButton variant="ghost" aria-label={`Copiar invitación de ${guest.name}`} title="Copiar invitación" onClick={() => onCopy(guest)}>
        <Link2 aria-hidden="true" />
      </IconButton>
      <IconButton variant="ghost" aria-label={`Ver QR de ${guest.name}`} title="Ver QR" onClick={() => onQr(guest)}>
        <QrCode aria-hidden="true" />
      </IconButton>
      <IconButton variant="ghost" aria-label={`Editar ${guest.name}`} title="Editar" onClick={() => onEdit(guest)}>
        <Pencil aria-hidden="true" />
      </IconButton>
      <IconButton variant="ghost" aria-label={`Eliminar ${guest.name}`} title="Eliminar" onClick={() => onDelete(guest)}>
        <Trash2 aria-hidden="true" />
      </IconButton>
    </div>
  );
}

/** Menú de acciones de una tarjeta móvil. */
function CardMenu({ guest, onEdit, onDelete, onCopy, onQr }: { guest: GuestRow } & GuestListActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton variant="ghost" aria-label={`Acciones de ${guest.name}`}>
          <MoreHorizontal aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onEdit(guest)} aria-label={`Editar ${guest.name}`}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCopy(guest)} aria-label={`Copiar invitación de ${guest.name}`}>
          <Link2 aria-hidden="true" />
          Copiar invitación
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onQr(guest)} aria-label={`Ver QR de ${guest.name}`}>
          <QrCode aria-hidden="true" />
          Ver QR
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDelete(guest)} aria-label={`Eliminar ${guest.name}`}>
          <Trash2 aria-hidden="true" />
          Eliminar invitado
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Lista de invitados. Con ancho suficiente (contenedor ≥ 60 rem, ≈ 1440 px de pantalla): tabla editorial con
 * encabezados reales. Por debajo, una tarjeta por invitado (una o dos columnas; nunca una tabla comprimida). Las dos vistas dibujan los mismos datos; solo cambia la
 * disposición.
 */
export function GuestList({ guests, ...actions }: { guests: readonly GuestRow[] } & GuestListActions) {
  const { columns } = guestsCopy;
  return (
    <div className="@container">
      <Card padding="none" className="hidden overflow-hidden @[60rem]:block">
        <table className="w-full table-fixed border-collapse text-left text-lu-base">
          <caption className="sr-only">Lista de invitados</caption>
          <thead>
            <tr className="border-b border-lu-border-subtle text-lu-sm text-lu-text-muted">
              <th scope="col" className="w-[28%] px-5 py-3.5 font-medium">{columns.guest}</th>
              <th scope="col" className="w-[14%] px-3 py-3.5 font-medium">{columns.group}</th>
              <th scope="col" className="w-[22%] px-3 py-3.5 font-medium">{columns.contact}</th>
              <th scope="col" className="w-[13%] px-3 py-3.5 font-medium">{columns.companions}</th>
              <th scope="col" className="w-[12%] px-3 py-3.5 font-medium">{columns.status}</th>
              <th scope="col" className="w-[11%] px-5 py-3.5 text-right font-medium">
                <span className="sr-only">{columns.actions}</span>
                <span aria-hidden="true">{columns.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => (
              <tr key={guest.id} className="border-b border-lu-border-subtle last:border-b-0 hover:bg-lu-selected/50">
                <th scope="row" className="px-5 py-3.5 font-normal">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={guest.name} size="sm" />
                    <span className="truncate font-lu-display text-lu-title-sm text-lu-text">{guest.name}</span>
                  </span>
                </th>
                <td className="truncate px-3 py-3.5 text-lu-text-secondary">{guest.groupName ?? <span className="text-lu-text-subtle">—</span>}</td>
                <td className="px-3 py-3.5 text-lu-sm text-lu-text-secondary">
                  <Contact guest={guest} />
                </td>
                <td className="px-3 py-3.5 text-lu-sm text-lu-text-secondary">{guestsCopy.companions(guest.maxCompanions)}</td>
                <td className="px-3 py-3.5">
                  <GuestStatusBadge status={guest.statusGroup} />
                  {guest.attendeeCount ? <span className="mt-1 block text-lu-xs text-lu-text-muted">{guestsCopy.attendees(guest.attendeeCount)}</span> : null}
                </td>
                <td className="px-5 py-2.5">
                  <RowActions guest={guest} {...actions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="grid gap-3 @[36rem]:grid-cols-2 @[60rem]:hidden">
        {guests.map((guest) => (
          <li key={guest.id}>
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={guest.name} size="sm" />
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate font-lu-display text-lu-title-md text-lu-text">{guest.name}</p>
                    {guest.groupName ? <p className="truncate text-lu-sm text-lu-text-muted">{guest.groupName}</p> : null}
                  </div>
                </div>
                <CardMenu guest={guest} {...actions} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <GuestStatusBadge status={guest.statusGroup} />
                {guest.attendeeCount ? <span className="text-lu-sm text-lu-text-secondary">{guestsCopy.attendees(guest.attendeeCount)}</span> : null}
                <span className="text-lu-sm text-lu-text-secondary">{guestsCopy.companions(guest.maxCompanions)}</span>
              </div>
              {guest.email || guest.phone ? (
                <div className="text-lu-sm text-lu-text-secondary">
                  <Contact guest={guest} />
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
