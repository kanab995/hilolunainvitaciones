import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/layout/not-found-screen";
import { fontVariables } from "@/lib/fonts";
import { siteConfig } from "@/lib/site-config";
import "./(site)/site.css";

export const metadata: Metadata = {
  title: `Página no encontrada | ${siteConfig.name}`,
  robots: { index: false, follow: false },
};

/**
 * 404 para URLs que no coinciden con ninguna ruta. Con varios layouts raíz no hay un layout
 * único del que componerlo, así que Next lo renderiza aparte (experimental.globalNotFound).
 * Necesita su propio <html>, estilos y fuentes.
 */
export default function GlobalNotFound() {
  return (
    <html lang={siteConfig.locale} className={fontVariables}>
      <body>
        <NotFoundScreen />
      </body>
    </html>
  );
}
