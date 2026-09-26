import { UserPlus, Users } from "lucide-react";
import type { ReactNode } from "react";
import { StatusCard } from "@/components/dashboard/status-card";
import { Card } from "@/components/ui/card";
import { Numeral } from "@/components/ui/typography";
import { guestsCopy } from "@/lib/guests/copy";
import type { GuestSummary as GuestSummaryData } from "@/types/guests";

function SummaryTile({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="@container h-full">
      <Card className="flex h-full items-center gap-3 p-4 @[16rem]:gap-5 @[16rem]:px-(--lu-space-card) @[16rem]:py-3.5">
        <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-lu-surface-tint text-lu-text @[16rem]:size-16 [&_svg]:size-5 @[16rem]:[&_svg]:size-7">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <Numeral>{value}</Numeral>
          <span className="font-lu-display text-lu-title-sm text-lu-text-secondary">{label}</span>
        </div>
      </Card>
    </div>
  );
}

/**
 * Resumen del evento (derivado de los invitados reales; no se guarda): total, tres estados y los
 * acompañantes potenciales. Reutiliza `StatusCard` (dashboard) para los estados.
 */
export function GuestSummary({ summary }: { summary: GuestSummaryData }) {
  return (
    <section aria-label="Resumen de invitados" className="@container">
      <ul className="grid grid-cols-2 gap-3 @[40rem]:gap-4 @[44rem]:grid-cols-3 @[64rem]:grid-cols-5">
        <li className="col-span-2 @[44rem]:col-span-1">
          <SummaryTile icon={<Users strokeWidth={1.5} />} value={summary.total} label={guestsCopy.summary.total} />
        </li>
        <li className="h-full">
          <StatusCard tone="confirmed" value={summary.confirmed} label={guestsCopy.summary.confirmed} />
        </li>
        <li className="h-full">
          <StatusCard tone="pending" value={summary.pending} label={guestsCopy.summary.pending} />
        </li>
        <li className="h-full">
          <StatusCard tone="declined" value={summary.declined} label={guestsCopy.summary.declined} />
        </li>
        <li>
          <SummaryTile icon={<UserPlus strokeWidth={1.5} />} value={summary.potentialCompanions} label={guestsCopy.summary.companions} />
        </li>
      </ul>
    </section>
  );
}
