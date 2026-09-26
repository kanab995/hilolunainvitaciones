/**
 * Assets APROBADOS de Magnolia que reutiliza el panel para sus vistas previas (docs/ASSET_LICENSES.md
 * §5.1). El panel no incluye imágenes propias ni usa el mockup como asset: solo estas rutas, servidas
 * con `next/image` (lazy, con `sizes`). Nunca se renderiza una invitación completa dentro de una tarjeta.
 */
export const dashboardAssets = {
  /** Fondo cálido con magnolias (banner y tarjeta "Editar invitación"). */
  coverBackdrop: { src: "/templates/magnolia/cover-bg.png", width: 941, height: 1672 },
  /** Hoja de cuatro esquinas florales; se recorta un cuadrante por CSS. */
  cornerSheet: { src: "/templates/magnolia/decor-corners.png", width: 1254, height: 1254 },
  /** Mesa con velas y flores (tarjeta del evento). */
  eventTable: { src: "/templates/magnolia/gallery-table.png", width: 1122, height: 1402 },
  /** Ramo de magnolias (promoción del sidebar). */
  bouquet: { src: "/templates/magnolia/gallery-bouquet.png", width: 1122, height: 1402 },
} as const;
