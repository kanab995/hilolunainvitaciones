import type { LayoutName } from "./layout-frame";

type RoutePlaceholderProps = {
  /** Patrón de la ruta tal como se define en docs/ROUTES.md, p. ej. "/templates/[slug]". */
  route: string;
  layout: LayoutName;
  params?: Record<string, string>;
};

/**
 * Placeholder de verificación de enrutado. Intencionalmente SIN diseño:
 * texto plano que hereda estilos base y no usa tokens de producto ni de invitación,
 * de modo que sirve igual en ambos lenguajes visuales.
 */
export function RoutePlaceholder({ route, layout, params }: RoutePlaceholderProps) {
  const entries = Object.entries(params ?? {});

  return (
    <section data-placeholder="route" data-route={route} className="p-6">
      <p>Placeholder de ruta</p>
      <h1>{route}</h1>
      <p>Layout: {layout}</p>
      {entries.length > 0 ? (
        <p>Params: {entries.map(([key, value]) => `${key}=${value}`).join(", ")}</p>
      ) : null}
    </section>
  );
}
