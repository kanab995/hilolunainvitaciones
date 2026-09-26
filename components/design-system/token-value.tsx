"use client";

import { useEffect, useState } from "react";

/**
 * Lee el valor computado de una variable CSS, de modo que la página muestre SIEMPRE el valor
 * real del token y no una copia que pueda desincronizarse.
 */
export function TokenValue({ name }: { name: string }) {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    // Leer un estilo computado solo es posible en el navegador; el estado inicial vacío evita
    // discrepancias de hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name]);

  return <span className="font-mono text-lu-xs text-lu-text-muted">{value || " "}</span>;
}
