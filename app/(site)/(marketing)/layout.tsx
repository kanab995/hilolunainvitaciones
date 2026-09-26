import type { ReactNode } from "react";
import { LayoutFrame } from "@/components/layout/layout-frame";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/** Layout de las páginas públicas de marketing: cabecera y pie compartidos (mockups 01–03). */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <LayoutFrame name="marketing" header={<SiteHeader />} footer={<SiteFooter />}>
      {children}
    </LayoutFrame>
  );
}
