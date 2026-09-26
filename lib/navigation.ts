/**
 * ¿El enlace de la navegación corresponde a la ruta actual? Coincide con la ruta exacta y con sus
 * hijas (`/templates` también está activo en `/templates/magnolia`). Los enlaces con ancla (`/#…`)
 * nunca se marcan: apuntan a una sección, no a una página.
 */
export function isNavItemActive(href: string, pathname: string | null): boolean {
  if (!pathname || href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
