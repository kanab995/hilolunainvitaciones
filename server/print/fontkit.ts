import * as fontkitModule from "@pdf-lib/fontkit";

/**
 * `@pdf-lib/fontkit` se publica como UMD/CommonJS: en Node ESM sus funciones llegan dentro de `default` y en el bundler de Next como
 * exportaciones con nombre. Este módulo da siempre el mismo objeto (`create`, y lo que `pdf-lib` necesita en `registerFontkit`).
 */
type Fontkit = typeof fontkitModule;
export const fontkit: Fontkit = (fontkitModule as unknown as { default?: Fontkit }).default ?? fontkitModule;
