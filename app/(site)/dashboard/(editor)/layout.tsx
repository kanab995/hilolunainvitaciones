import type { ReactNode } from "react";
import { LayoutFrame } from "@/components/layout/layout-frame";

export default function EditorLayout({ children }: { children: ReactNode }) {
  return <LayoutFrame name="editor">{children}</LayoutFrame>;
}
