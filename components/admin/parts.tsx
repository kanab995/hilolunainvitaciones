import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/layout/navigation";
import { Card } from "@/components/ui/card";
import { Heading, Numeral, Text } from "@/components/ui/typography";
import { adminCopy } from "@/lib/admin/copy";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Cabecera de página de la consola: migas › título › descripción (y acciones opcionales). Más compacta que la del panel de clientes. */
export function AdminPageHeader({ title, description, crumbs, actions }: { title: string; description?: string; crumbs?: Array<{ label: string; href?: string }>; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <Breadcrumbs items={[{ label: adminCopy.consoleLabel, href: routes.admin }, ...(crumbs ?? []), { label: title }]} />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Heading as="h1" size="display-sm">
            {title}
          </Heading>
          {description ? (
            <Text size="base" className="max-w-prose">
              {description}
            </Text>
          ) : null}
        </div>
        {actions}
      </div>
    </header>
  );
}

/** Sección con título dentro de una tarjeta (`<section aria-labelledby>`). */
export function AdminPanel({ id, title, hint, children, className }: { id: string; title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <Card role="region" aria-labelledby={id} padding="md" className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <Heading as="h2" id={id} size="title-md">
          {title}
        </Heading>
        {hint ? (
          <Text size="sm" tone="muted">
            {hint}
          </Text>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** Cifra destacada (etiqueta + número). El dato va siempre en texto. */
export function AdminMetric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-1.5" data-metric={label}>
      <p className="text-lu-sm text-lu-text-muted">{label}</p>
      <Numeral className="text-lu-title-xl leading-none">{value}</Numeral>
      {hint ? <p className="text-lu-xs text-lu-text-muted">{hint}</p> : null}
    </Card>
  );
}

/** Lista de datos etiquetados en dos columnas (`<dl>`). */
export function AdminFacts({ items, className }: { items: Array<{ label: string; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-3.5 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-lu-sm text-lu-text-muted">{item.label}</dt>
          <dd className="min-w-0 text-lu-base break-words text-lu-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Filas «etiqueta … valor» de una sola columna (cifras dentro de un panel). */
export function AdminStatList({ items }: { items: Array<{ label: string; value: ReactNode; note?: string }> }) {
  return (
    <dl className="divide-y divide-lu-border-subtle">
      {items.map((item) => (
        <div key={item.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-lu-base text-lu-text-secondary">{item.label}</dt>
          <dd className="text-lu-base font-medium text-lu-text tabular-nums">
            {item.value}
            {item.note ? <span className="ml-2 text-lu-xs font-normal text-lu-text-muted">{item.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Nombre de una persona con su correo debajo (sin nombre → solo el correo). */
export function PersonCell({ name, email }: { name: string | null; email: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-lu-base text-lu-text">{name?.trim() || email}</span>
      {name?.trim() ? <span className="truncate text-lu-xs text-lu-text-muted">{email}</span> : null}
    </span>
  );
}
