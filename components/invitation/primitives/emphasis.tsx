import type { ReactNode } from "react";

/**
 * Titular con una palabra en cursiva marcada con asteriscos ("Nuestra *historia*"). Si la plantilla
 * no usa cursiva (`heading.emphasis = "none"`) los asteriscos se quitan y el texto queda igual.
 */
export function Emphasis({ text, emphasis }: { text: string; emphasis: "italic" | "none" }): ReactNode {
  return text.split("*").map((part, index) =>
    index % 2 === 1 && emphasis === "italic" ? (
      <em key={index} className="italic">
        {part}
      </em>
    ) : (
      part
    ),
  );
}
