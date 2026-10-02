# DESIGN_SYSTEM — Hilo Luna

> **Nota de marca:** `--lu-*` es el namespace técnico histórico de los tokens de diseño del producto **Hilo Luna** (el prefijo viene del nombre anterior, *Lunaria*) y no se renombra; `--inv-*` son los de las invitaciones.

> **v1.1 — valores definitivos e implementados** (ajustes de fidelidad visual del propietario: escala display conservadora, excepciones de radio en botones, tokens de error, contrato de tema ampliado). Fuente de verdad en código: [`app/(site)/site.css`](../app/(site)/site.css) (tokens `--lu-*`) y [`app/(invitation)/invitation.css`](../app/(invitation)/invitation.css) (tokens `--inv-*`). Este documento explica **de dónde sale cada valor**. Demostración viva: ruta interna `/design-system`.
>
> Regla de mantenimiento: si un valor cambia, se cambia primero el CSS y aquí después. Si un mockup contradice un valor, gana el mockup (CLAUDE.md §1).

**Cambios v1.0 → v1.1:** `display-xl` 108 → **96** máx. (fluido 64–96) y `display-lg` mín. 44 → **52** · botón `pill` como excepción intencional (CTA de navbar) · tokens `--lu-error` / `--lu-error-bg` (feedback funcional) · `InvitationTheme` ampliado con `layout` y `effects`. Principio aplicado: **la fidelidad visual en navegador prima sobre las mediciones matemáticas** cuando estas se sienten sobredimensionadas.

Mockups: `01` home · `02` galería · `03` detalle · `04` editor · `05` dashboard · `06` invitación Magnolia.

---

## 0. Cómo se obtuvieron los valores

**Método.** Medición de píxeles sobre los PNG de `design/reference/` (bounding boxes de texto y controles, esquinas, luminosidad de sombras, colores muestreados).

**Escala de referencia.** Los mockups tienen anchos distintos (935, 1122, 1448 px). Se normaliza a un **diseño de 1440 px**:

| Mockup | Ancho | Factor a 1440 | Fiabilidad |
|---|---|---|---|
| 04 editor, 05 dashboard | 1448 | ×0,994 | **Alta** (≈ 1:1). Ancla de la interfaz de trabajo |
| 02 galería, 03 detalle | 1122 | ×1,283 | Media. Ancla del marketing |
| 01 home | 935 | ×1,54 | **Baja**: el texto de navegación mide 12,5 px normalizado en 01 y 15 px en 02, lo que indica que 01 no comparte escala exacta con 02/03. Solo se usa para proporciones y ritmos |
| 06 invitación | 941 (2 col. de ≈ 470) | — | Móvil; ver §5 |

**Conversión a tamaño de fuente.** La altura de glifo medida se divide por la altura de ascendente/mayúscula de la fuente (Cormorant Garamond ≈ 0,68; cifras alineadas ≈ 0,63). Es decir, **los tamaños de la serif ya están calculados para Cormorant** (política de tipografía), no para la serif original del mockup, que tiene más altura-x.

**Limitaciones honestas.** ±8 % de error por compresión y reescalado. Los radios grandes de tarjetas casi no tienen contraste con el fondo y se estimaron por la geometría de fotos y botones. Donde el mockup no da información (foco, hover, error, vacío, carga, modal) se **derivan** de tokens existentes y se marca como tal.

---

## 1. Carácter visual (observado)

- **Editorial, cálido, romántico, ligero.** Marfil, fotografía natural, mucho espacio negativo.
- **Titulares en serif con una palabra en cursiva** ("invitación *inolvidable*", "Nuestros *momentos*"): componente `SectionHeading` / `EmphasisText` (`*palabra*`).
- **Cuerpo en sans neutra**, gris cálido.
- **Botón primario casi negro con matiz marrón**, texto crema; secundario en contorno tostado.
- **Superficies casi idénticas**: se separan con filete de 1 px y sombra muy suave, no con color.
- **Sin gradientes de UI, sin glassmorphism, sin radios excesivos.** Los desvanecidos de foto a fondo son parte del asset (o `mask-image`), no del componente.
- **Íconos de línea fina** (≈ 1,5 px) en contenedor suave.
- **Cifras grandes en serif** con figuras alineadas.

## 2. Dos lenguajes visuales (regla 7)

| | Producto (`--lu-*`) | Invitación (`--inv-*`) |
|---|---|---|
| Superficies | Marketing [01–03], Editor [04], Dashboard [05], 404 | Invitación pública [06] |
| Tokens | Globales, únicos | **Por plantilla** (defaults de Magnolia) |
| CSS | `site.css` | `invitation.css` (no importa nada del producto) |
| Compartido | **Nada.** Verificado en build: `--lu-*` solo aparece en el CSS del producto y `--inv-*` solo en el de invitación |

Otras plantillas ([02]: Noir, Safari, Riviera…) divergen radicalmente; el contrato de tema (§5) debe permitir fondos oscuros y paletas saturadas.

---

## 3. Tokens del producto (`--lu-*`)

### 3.1 Color

**Superficies**

| Token | Valor | Uso | Proc. |
|---|---|---|---|
| `--lu-canvas` | `#FDFBF8` | Fondo de página | muestreo |
| `--lu-surface` | `#FEFDFA` | Tarjetas, inputs, barra superior | muestreo |
| `--lu-surface-muted` | `#FAF9F7` | Sidebar, rail del editor | muestreo |
| `--lu-surface-tint` | `#F7F3EF` | Paneles teñidos, icon-boxes, tarjeta `tint` | muestreo |
| `--lu-selected` | `#F2EEE8` | Hover suave, fila activa, skeleton | muestreo |
| `--lu-nav-active` | `#F6EFE8` | Ítem activo del sidebar | muestreo |
| `--lu-section-band` | `#F4F0EA` | Bandas de sección | muestreo |

**Tinta y texto**

| Token | Valor | Uso |
|---|---|---|
| `--lu-ink` | `#21170D` | Botón primario, chip activo, velo del modal (al 40 %) |
| `--lu-on-ink` | `#F7F8F3` | Texto sobre tinta |
| `--lu-text` | `#1A1410` | Titulares y texto principal (casi negro cálido; el muestreo dio negro por antialiasing) |
| `--lu-text-secondary` | `#555149` | Párrafos |
| `--lu-text-muted` | `#6E6867` | Metadatos |
| `--lu-text-subtle` | `#837D7C` | Placeholders, contadores |
| `--lu-eyebrow` | `#775E53` | Etiquetas en mayúsculas |

**Marca y acentos**

| Token | Valor | Uso |
|---|---|---|
| `--lu-brown-400` | `#907058` | Acento por defecto; subrayado activo de navegación |
| `--lu-brown-500` | `#846951` | Numerales, íconos de estado vacío |
| `--lu-brown-600` | `#725641` | **Foco, switch, checkbox, selección** |
| `--lu-brown-900` | `#513624` | Borde de fila activa; **error** (sin mockup) |
| `--lu-blush` | `#DCB5AD` | Acento secundario (muestra rosa del selector [04]) |
| `--lu-blush-soft` | `#F8D9CD` | Fondo blush suave; selección de texto; "no asistirá" |
| `--lu-sage` | `#9D977D` | Muestra salvia del selector [04] |

`brown-400/500/600` son casi la misma familia en el mockup; se conservan los tres porque cada uno se observó en un uso distinto. Validar con quien produjo los mockups si se colapsan.

**Bordes:** `--lu-border-subtle #EFECE7` (tarjetas, chips) · `--lu-border #E3E0DC` (inputs) · `--lu-border-outline #CDBBAA` (botón secundario) · `--lu-border-strong #D3C9C0` (divisores, dropzone).

**Estados de RSVP**

| Estado | Fondo | Ícono/punto |
|---|---|---|
| Confirmado | `--lu-success-bg #DBE3D5` | `--lu-success #7B9F7E` |
| Pendiente (incluye "Tal vez") | `--lu-pending-bg #F7EBD8` | `--lu-pending #DEC8AD` |
| No asistirá | `--lu-declined-bg #F8D9CD` | — |

El ícono dentro del círculo de las métricas es de tinta oscura (`--lu-text`), como en [05].

**Feedback funcional (nuevo)** — exclusivamente para validación y errores; **nunca decorativo**:

| Token | Valor | Uso |
|---|---|---|
| `--lu-error` | `#A44A45` | Texto, borde e ícono de error (contraste ≈ 5:1 sobre `--lu-canvas`) |
| `--lu-error-bg` | `#FAEDEC` | Fondo de campo o mensaje con error (contraste texto/fondo ≈ 5:1) |

Distinción semántica: **"No asistirá" (`--lu-declined-bg`) es un estado de RSVP, no un error**; no debe usar los tokens de error, y un error no debe usar `declined-bg`. Utilidades: `text-lu-error`, `border-lu-error`, `bg-lu-error-bg`. Aplicado en `Input`, `Textarea`, `Select` (`invalid`), `Checkbox` (`aria-invalid`), contador de `Field` al superar el máximo y mensaje de error de `Field`. Mapeado también a `--destructive` de shadcn.

**Prohibido:** tonos nuevos, gradientes de UI, negro/blanco puros para fondos, y usar `--lu-error` con fines decorativos. Los colores de marca no incluyen rojos saturados.

### 3.2 Tipografía

**Fuentes (política del propietario):** serif **Cormorant Garamond** (`--lu-font-display`, pesos 400/500/600 + cursivas) y sans **Inter** (`--lu-font-sans`), auto-alojadas con `next/font`. Licencias en `docs/ASSET_LICENSES.md`.

**Escala definitiva** (px a 1440; los tamaños `fluido` escalan con `clamp()` y bajan en móvil):

*Serif · peso 500*

| Token (`text-lu-*`) | Tamaño | Interlineado | Tracking | Evidencia (medida @1440) | Uso |
|---|---|---|---|---|---|
| `display-xl` | `clamp(64px, 6.5vw, 96px)` → **93,6 @1440** | 0,95 | −0,01em | Medido 108 (glifo "Plantillas" [02] 74 px); **reducido por fidelidad visual** (se sentía sobredimensionado en navegador) | Título de plantilla / galería |
| `display-lg` | `clamp(52px, 5vw, 72px)` → **72 @1440** | 1,0 | −0,01em | Glifo "Andrea & Fernando" [05] 51 px; mínimo subido de 44 a 52 | Título de página del dashboard |
| `display-sm` | `clamp(26px, 2.4vw, 34px)` → **34 @1440** | 1,15 | — | Subtítulo "Encuentra un diseño que se sienta como tú." [02]: línea ≈ 609 px a 1440 (entre `h3` 28 y `h2` 40) | Subtítulo serif de héroes interiores |
| `display-md` | **60** (fluido, mín. 40) | 1,05 | −0,01em | Línea del hero [01] ≈ 42 px | Hero del home |
| `title-xl` | **48** (fluido, mín. 32) | 1,05 | — | Glifo "Portada" [04] 35 px | Título del panel del editor |
| `h2` | **40** (fluido, mín. 28) | 1,15 | — | "Elige el momento…" [01] 38,5 px (asc.+desc.) | Título de sección |
| `h3` | **28** (fluido, mín. 24) | 1,2 | — | "Actividad reciente" [05] 18 px → 26–28 | Cabecera de tarjeta grande |
| `title-lg` | **26** | 1,2 | — | "Magnolia" [02] 24 px (asc.+desc.) | Nombre de plantilla |
| `title-md` | **22** | 1,25 | — | "Editar invitación" [05] 14 px → 21 | Título de tarjeta |
| `title-sm` | **20** | 1,3 | — | Cap. "Nos casamos" [04] 13 px → 20,6 | Valores serif de inputs, filas, etiquetas |
| `numeral-lg` | `clamp(56px, 5.56vw, 80px)` → **80 @1440** | 1 | — | "01/02/03" [01]: glifo ≈ 54 px @1440 (≈ 86 px de fuente); antes 60. Se usa en peso 400 y al 75 % de opacidad | Numeración de pasos |
| `numeral` | **40** | 1 | — | "108" [05] 25 px (cifras) | Métricas |
| `wordmark` | **36** | 1 | — | "Hilo Luna" (medido sobre el nombre anterior, "Hilo Luna", en [04][05]: 106–114 px de ancho) | Logotipo |

Cifras siempre alineadas (`font-variant-numeric: lining-nums`). Tamaño mínimo práctico de Cormorant: 16 px (a menos, los trazos finos se degradan; el mínimo en uso es 18).

*Sans · Inter*

| Token | Tamaño | Interlineado | Evidencia | Uso |
|---|---|---|---|---|
| `lg` | **18** | 1,55 (28) | Lead [02] | Lead |
| `md` | **16** | 1,625 (26) | Párrafo del hero [01]: paso de línea 26 px | Párrafo de marketing |
| `base` | **15** | 1,45 (22) | Descripción [04]: paso 22 px; navegación [02] ≈ 15 | Cuerpo, navegación, inputs |
| `ui` | **14** | 1,4 (20) | Botones [04][05] | Botón md, sidebar |
| `sm` | **13** | 1,4 (18) | Etiquetas [04], sidebar [05] (ancho de "Lista de invitados" ≈ 13 px Inter); paso de línea 17,5 | UI del workspace, ayudas |
| `xs` | **12** | 1,35 (16) | Subtítulos de fila [04] miden ≈ 10 px; se sube a 12 por accesibilidad | Captions (mínimo) |
| `caps` | **12** | 1,3 · tracking **0,14em** · peso 500 · MAYÚSCULAS | Eyebrow [01][04] | Eyebrow |

**Énfasis:** una palabra en cursiva de la misma familia (`*palabra*` → `<em>`).

**Nota técnica (utilidad `cn`).** Los tokens `text-lu-*` deben registrarse en `lib/utils.ts` (`fontSizeTokens`); si no, el fusionador de clases los confunde con colores y descarta uno (bug detectado y corregido). Al añadir un tamaño nuevo: CSS + `lib/utils.ts`.

### 3.3 Radios, bordes y sombras

| Token | Valor | Evidencia | Uso |
|---|---|---|---|
| `--lu-radius-xs` | **4** | — | Checkbox, subrayados |
| `--lu-radius-input` | **8** | Esquina de inputs y opciones [04] ≈ 6–8 | Inputs, selects, ítems de menú |
| `--lu-radius-button` | **10** | Botón primario [04][05]: 5 filas de curva → r ≈ 10 | Botones por defecto (sm/md) |
| `--lu-radius-button-lg` | **12** | Botón hero [01] r ≈ 15 (a 935); "Compartir" [05] ≈ 11 | CTA grande (lg) |
| `--lu-radius-button-xl` | **16** | CTA del detalle [03] r ≈ 18 | CTA grande (xl) |
| `--lu-radius-image` | **10** | Foto de tarjeta [02] r ≈ 10; foto [05] ≈ 8 | Imágenes dentro de tarjetas |
| `--lu-radius-card` | **14** | Aproximación visual (contraste bajo) | Tarjetas, menús |
| `--lu-radius-modal` | **16** | Derivado (sin mockup) | Modal |
| `--lu-radius-banner` | **20** | Aproximación visual | Banners grandes |
| `--lu-radius-pill` | **9999** | Chips [02]: r = mitad de la altura; CTA de navbar [01] r ≈ mitad de la altura | **Excepciones intencionales:** CTA primario de la navbar, chips de filtro, controles segmentados; además badges |

**Regla de radios en botones (decisión del propietario).** No se unifica un solo radio: botones por defecto **10 px**; CTA grandes **12–16 px según tamaño** (lg 12, xl 16); **CTA primario de la navbar: píldora**; **chips de filtro y controles segmentados: píldora**. Es una excepción intencional basada en los mockups. Implementación: `Button` con `shape="pill"` solo para el CTA de la navbar; `Tabs variant="segmented"` ya es píldora; el `Chip` de filtro (pendiente) usará `--lu-radius-pill`.

**Bordes:** siempre **1 px** (`--lu-border-width`); **2 px** solo para selección (`--lu-border-width-strong`, opción "Centrada" [04]) y foco. Discontinuo (1 px) para dropzone y "Agregar sección".

**Sombras** (evidencia: bajo una tarjeta [02] la luminosidad cae ≈ 10/252 a 4–8 px y se recupera en ≈ 20 px → sombra de opacidad pico ≈ 5 %; además un filete de ≈ 1 px):

| Token | Valor | Uso |
|---|---|---|
| `--lu-shadow-card` | `0 1px 2px rgb(60 40 20 / .04), 0 6px 20px rgb(60 40 20 / .05)` | Tarjetas |
| `--lu-shadow-card-hover` | `0 1px 2px rgb(60 40 20 / .05), 0 10px 28px rgb(60 40 20 / .08)` | Tarjeta interactiva (hover) |
| `--lu-shadow-float` | `0 4px 8px rgb(60 40 20 / .05), 0 16px 40px rgb(60 40 20 / .10)` | Menús, popovers |
| `--lu-shadow-modal` | `0 24px 64px rgb(40 25 10 / .18)` | Modal |
| `--lu-shadow-device` | `0 30px 60px rgb(40 25 10 / .18)` | Marco de teléfono |

### 3.4 Espaciado

**Base 4 px** (escala por defecto de Tailwind). Pasos en uso: **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 96**.

| Token semántico | Valor | Evidencia | Uso |
|---|---|---|---|
| `--lu-gap-label` | 8 | Etiqueta → input [04] | Etiqueta ↔ control |
| `--lu-gap-field` | 24 | Separación entre campos [04] ≈ 24–28 | Entre campos de formulario |
| `--lu-gap-grid` | 16 | Hueco entre tarjetas [02]: 12 px @1122 → **15,4** @1440; [05] ≈ 16–18 | Rejillas de tarjetas |
| `--lu-gap-grid-lg` | 24 | — | Rejillas amplias |
| `--lu-space-card` | 20 | Ícono a 20 px del borde en tarjetas de [05] | Padding de tarjeta |
| `--lu-space-card-lg` | 24 | Pie de tarjeta de plantilla [02] ≈ 24 lateral | Padding grande |
| `--lu-space-modal` | 28 | Derivado | Padding de modal |
| `--lu-space-section` | **38 → 44 (md) → 50 (xl)** por lado (76 → 88 → 100 entre secciones) | [01] mide ≈ 56–70 px entre secciones (escala poco fiable, §0); la versión de 96–128 se sintió dispersa. **Decisión del propietario: aireado y editorial, sin dispersarse** (−22 % respecto a la ronda anterior) | Padding vertical de sección (`lu-section`) |
| `--lu-space-heading` | 32 | "Elige el momento" → tarjetas [01] ≈ 55 con subtítulo | Encabezado → contenido |
| `--lu-gutter` | 16 → 24 (md) → 32 (lg) → **64** (xl) | Margen lateral de [02]: 62 px @1440 | Márgenes de página |

### 3.5 Controles

| Control | Altura | Evidencia (@1440) |
|---|---|---|
| Botón `sm` | **40** | "Ver todas las plantillas" [01] ≈ 40 |
| Botón `md` / input / select | **44** | "Publicar" [04] 44; "Vista previa" [04] 43; CTA navbar [01] 43; input [04] 42 → 44 (objetivo táctil) |
| Botón `lg` | **54** | "Editar invitación" [05] 54; "Compartir" [05] 56; hero [01] 55 |
| Botón `xl` | **64** | CTA del detalle [03] 63 |
| Chip de filtro | **48** | Chip [02] 47 |
| Switch | 44 × 26 | "Overlay en imagen" [04] |
| Checkbox | 20 | Derivado |
| Botón de ícono | 32 · 36 · 44 | Flecha circular [05] ≈ 36 |
| Círculo de estado | 64 | Métricas [05] 67 |

**Botones:** rectángulo redondeado (10 / 12 / 16 según tamaño); píldora solo en el CTA de la navbar (§3.3). Texto crema sobre tinta; foco = anillo de 2 px `brown-600` con separación de 2 px.

### 3.6 Anchos y estructura

| Token | Valor | Evidencia |
|---|---|---|
| `--lu-page-max` | **1440** (contenedor `lu-container`) | Diseño normalizado |
| Contenido de página | **1312** (1440 − 2 × 64) | Ancho de contenido medido: [01] 1309, [02] 1315, [03] 1306 |
| `--lu-prose-max` | **512** | Descripción del editor [04] ≈ 496 |
| `--lu-modal-sm / md / lg` | 416 / 512 / 640 | Derivado (sin mockup); lg ≈ panel central del editor |
| `--lu-header-h` | **88** | Navbar de marketing [01]; el hero se extiende por debajo (transparente) |
| `--lu-sidebar-w` | **256** | Sidebar [05] 255 |
| `--lu-topbar-h` | **52** | Barra superior [05] 52 |
| `--lu-editor-topbar-h` | **76** | Barra del editor [04] 76 |
| `--lu-editor-rail-w` | **352** | Rail de secciones [04] 350 |
| `--lu-editor-preview-w` | **464** | Panel de vista previa [04] 463 |
| Padding del main del dashboard | 40 | [05]: 43 izq. / 34 der. |
| Columna de invitación | 430 (`--inv-column-max`) | Provisional (Q-12) |

**Breakpoints:** los de Tailwind (`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`). Ver `RESPONSIVE.md`.

### 3.7 Movimiento

Tokens en `site.css`: `--lu-ease-standard`, `--lu-ease-emphasized`, `--lu-dur-instant 90 · fast 150 · base 240 · slow 420` (ms). Solo `opacity` y `transform`. Con `prefers-reduced-motion` todo se reduce a ≈ 0 ms. Detalle en `ANIMATIONS.md`.

### 3.8 Iconografía

`lucide-react`, trazo ≈ 1,5 px en contenedores (`stroke-[1.5]`), tamaños 16 (inline), 20 (sidebar/atajos), 28 (círculos de estado). Íconos de marca de terceros (WhatsApp, Instagram, Liverpool…) **no** forman parte del sistema (Q-05).

---

## 4. Imágenes y dirección de arte

**Placeholders.** Mientras no existan assets aprobados, `MediaSlot` dibuja *escenas* (manchas de color desenfocadas con tokens: luz difusa, pétalos, telas) para que los bloques se lean como fotografía neutra fuera de foco y no como cajas vacías. Son solo CSS (`blur` sobre formas planas), sin imágenes, sin degradados de UI y sin backdrop-blur. Cada uso sin `src` es un asset pendiente marcado con `TODO(asset): replace with approved Hilo Luna asset`.


- Fotografía cálida y natural (flores blancas / rosa empolvado / verde salvia, luz suave, fondos crema), objetos por categoría, tarjetas de invitación sobre escenas, decoración floral con transparencia.
- Cada plantilla de [02] tiene una escena propia que anticipa su estética.
- **Política de assets:** originales generados para Hilo Luna, fotografía del usuario o stock licenciado; **nunca** copiados de terceros; registro obligatorio en `docs/ASSET_LICENSES.md`. Los mockups son referencia, no assets. Hoy **no hay imágenes en el repo**: `TemplateCard` sin `imageSrc` muestra un bloque tintado vacío.

---

## 5. Tema de plantilla de invitación (`--inv-*`)

Contrato que cada plantilla cumple (valores de Magnolia en `invitation.css`, muestreados de [06]).

```ts
/** Configuración de plantilla. NO son opciones libres del usuario. */
type HeroLayout = "centered" | "split" | "editorial";
type LocationsLayout = "split" | "stacked";
type GalleryLayout = "grid" | "masonry" | "carousel";
type TimelineLayout = "horizontal" | "vertical";
type PhotoMask = "none" | "fade" | "arch";

interface TemplateLayout {
  hero: HeroLayout;             // → variante del bloque COVER
  locations: LocationsLayout;   // → variante del bloque LOCATION
  gallery: GalleryLayout;       // → variante del bloque GALLERY
  timeline: TimelineLayout;     // → variante del bloque ITINERARY
}

interface TemplateEffects {
  paperTexture?: boolean;       // requiere una textura con licencia (--inv-paper-texture); default false
  vignette?: boolean;           // default false
  photoMask?: PhotoMask;        // default "none"
}

interface InvitationTheme {
  colors: { bg; bgAlt; surface; ink; inkMuted; accent; line; onAccent; button: { bg; fg } };
  fonts: { display; body; label };      // solo fuentes registradas en ASSET_LICENSES
  type: { names; title; body; eyebrow; numeral };
  radius: { card; button; image; arch };
  rhythm: { sectionY; gutter };
  ornaments: { divider; sprig };
  layout: TemplateLayout;               // NUEVO
  effects: TemplateEffects;             // NUEVO
  decor: Partial<Record<DecorSlot, DecorAsset>>;
}

/** Magnolia (mockup 06). */
const magnoliaTheme: Pick<InvitationTheme, "layout" | "effects"> = {
  layout: { hero: "centered", locations: "split", gallery: "grid", timeline: "horizontal" },
  effects: { paperTexture: true, photoMask: "fade" },
};

/** Level 12 (D-38; brief de texto del propietario, sin mockup de imagen — ver docs/ARCHITECTURE.md). Reutiliza enteramente variantes ya implementadas. */
const level12Theme: Pick<InvitationTheme, "layout" | "effects"> = {
  layout: { hero: "centered", locations: "stacked", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
};

/** Aurora XV (D-39; referencia visual + brief del propietario). Itinerario de 6 pasos: timeline "vertical" (la "horizontal" tiene grid fijo a 5 columnas). */
const auroraXvTheme: Pick<InvitationTheme, "layout" | "effects"> = {
  layout: { hero: "centered", locations: "split", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
};

/** Celeste (D-43; brief de texto del propietario, sin mockup de imagen). Itinerario de 6 pasos: timeline "vertical" (mismo motivo que Aurora XV). */
const celesteTheme: Pick<InvitationTheme, "layout" | "effects"> = {
  layout: { hero: "centered", locations: "split", gallery: "grid", timeline: "vertical" },
  effects: { photoMask: "fade" },
};
```

**Reglas del contrato `layout` / `effects`**

1. **Fuente única de variantes.** `layout` es el selector canónico de variante para `COVER`, `LOCATION`, `GALLERY` e `ITINERARY`. `TemplateDefinition.variants` queda solo como vía de escape para **otros** bloques y **no** debe repetir esas cuatro claves (evita dos mecanismos para lo mismo).
2. **Solo de plantilla.** Estos valores viven en el código de la plantilla; nunca en `InvitationSection.settings` ni en `Invitation.styleOverrides` (que solo admite acento y fuentes).
3. **Cambiar de plantilla no borra contenido** (regla 17): cada variante debe degradar con elegancia si falta un dato (p. ej. un hero `split` sin foto).
4. **Variantes reales.** Solo los valores de Magnolia (`centered`, `split`, `grid`, `horizontal`) tienen diseño; el resto (`split`/`editorial` en hero, `stacked`, `masonry`, `carousel`, `vertical`, `arch`) es **contrato sin mockup** y se implementa cuando exista la plantilla que lo use. Un valor sin variante implementada cae al de Magnolia.
5. **Definiciones para evitar ambigüedad:** `grid` = rejilla CSS con celdas fijas y *spans* (el mosaico asimétrico de [06] es un `grid`); `masonry` = columnas que fluyen según la altura del contenido; `arch` = foto recortada en forma de arco; `fade` = foto que se desvanece hacia el fondo.
6. **Efectos en CSS** (`invitation.css`, ya implementados como utilidades, sin consumidores todavía): `inv-paper` (usa `--inv-paper-texture`; **sin textura registrada en `ASSET_LICENSES` no produce ningún efecto**), `inv-vignette` (sombra interior, sin degradados), `inv-photo-fade` (máscara de la imagen), `inv-photo-arch`.
7. **Independencia del ajuste del usuario.** `settings.align` (izq./centro/der., mockup 04) y `settings.overlay` (velo en imagen) siguen siendo ajustes del usuario por sección; se aplican **encima** del layout/efectos de la plantilla y solo si la variante los soporta.

**Defaults de Magnolia implementados:** `--inv-bg #FAF6F1`, `--inv-bg-alt #F9F5F1`, `--inv-surface #F3E6DC`, `--inv-ink #492512`, `--inv-ink-muted #39342F` (provisional), `--inv-accent #907058`, `--inv-line #D3C9C0`, `--inv-button-bg #231A0F`, `--inv-button-fg #F7F8F3`; fuentes Cormorant + Inter; columna 430; gutter 20.

**Defaults de Level 12 implementados (D-38):** `--inv-bg #0A0E1F`, `--inv-bg-alt #05070F`, `--inv-surface #141B36`, `--inv-ink #F5F7FF`, `--inv-ink-muted #9AA5CC`, `--inv-accent #39E5FF`, `--inv-line #2A3568`, `--inv-button-bg #8B5CF6`, `--inv-button-fg #F8F7FF`; mismas fuentes registradas (Cormorant + Inter, sin fuente nueva); tema oscuro, sin textura de papel ni viñeta (`--inv-vignette-color`/`--inv-vignette-blur` siguen siendo una variable GLOBAL con los valores de Magnolia, sin parametrizar por plantilla — ver D-38).

**Defaults de Aurora XV implementados (D-39):** `--inv-bg #FBF5EF`, `--inv-bg-alt #F6EBE2`, `--inv-surface #F1DFD8`, `--inv-ink #5A3240`, `--inv-ink-muted #7D6056`, `--inv-accent #BD8A52`, `--inv-line #E3CDC2`, `--inv-button-bg #5A2F3F`, `--inv-button-fg #FBF0E6`; mismas fuentes registradas (Cormorant + Inter, sin fuente nueva); tema claro marfil/rosa/champagne/dorado, sin textura de papel ni viñeta (mismo motivo que Level 12: esas variables siguen sin parametrizarse por plantilla).

**Defaults de Celeste implementados (D-43):** `--inv-bg #FBF8F2`, `--inv-bg-alt #F6F1E6`, `--inv-surface #E9F1F5`, `--inv-ink #3E4A52`, `--inv-ink-muted #7D8D94`, `--inv-accent #B8975E`, `--inv-line #DBE7EC`, `--inv-button-bg #3E5A6B`, `--inv-button-fg #FBF8F2`; mismas fuentes registradas (Cormorant + Inter, sin fuente nueva); tema claro marfil/blanco perla/azul cielo/dorado, sin textura de papel ni viñeta (mismo motivo que Level 12 y Aurora XV).

**Lenguaje observado en [06]:** portada con tarjeta en arco y botón oscuro "Abrir invitación"; secciones en bandas casi iguales con textura de papel y flores en esquinas; títulos serif con palabra en cursiva; cuenta regresiva con cifras marrones separadas por filetes; sedes mitad imagen / mitad texto alternando; itinerario horizontal con íconos; galería en mosaico; cierre con fotografía suave. Escala móvil estimada (col. de 470 px → 390 px): nombres ≈ 34–38, títulos ≈ 26–28, cifras ≈ 36, cuerpo ≈ 13–14. **Sin medir a fondo hasta que se construya la invitación.**

**Otras plantillas [02]** (Ivory, Étoile, Tuscany, Noir, Blossom, Riviera, Dream, Safari): solo tarjeta; tema por diseñar. No asumir "crema + marrón" dentro de `invitation/`.

---

## 6. Reglas de uso

**Sí:** solo tokens `--lu-*` en el producto y `--inv-*` en invitaciones · `SectionHeading` para titulares con cursiva · filete + sombra suave para separar superficies · foco visible siempre · alternativas textuales en gráficos e íconos con significado.

**No:** gradientes de UI, sombras duras, bordes gruesos, glassmorphism/blur, color saturado fuera de estados, radios > 20 px en componentes de UI, tarjetas con acento como fondo, íconos o ilustraciones no presentes en mockups, mezclar tokens de producto dentro de una invitación, magic values de color/sombra/radio en componentes.

---

## 7. Inconsistencias entre mockups y decisiones

| # | Observación | Tratamiento |
|---|---|---|
| I-1 | Botones de [03]: más grandes, radio mayor y **etiqueta serif**; en [01][04][05] son sans | `size="xl" font="serif"` solo en detalle de plantilla |
| I-2 | Tres marrones casi iguales | Conservados (`400/500/600`); validar colapso |
| I-3 | Botón primario `#20160C` (marketing/editor) vs `#2D1F14` (dashboard) | Un solo `--lu-ink #21170D` |
| I-4 | La serif de los mockups tiene más altura-x que Cormorant | Tamaños calculados para Cormorant (§0); revisar visualmente al construir cada pantalla (N-06) |
| I-5 | Sin estados de foco, hover, deshabilitado, error, vacío, carga ni modal | Derivados de tokens: foco `brown-600`, hover `selected`/`brown-900`, deshabilitado 50 % de opacidad, **error con `--lu-error` / `--lu-error-bg`** (decisión del propietario; solo feedback funcional) |
| I-6 | Modo oscuro no existe | No se implementa |
| I-7 | CTA de la navbar de [01] parece píldora; los de [04][05] y el hero de [01] son rectángulos | **Se conservan ambos** (decisión del propietario): 10 / 12–16 por defecto y píldora para navbar, chips y segmented |
| I-8 | Escalas distintas entre mockups (§0) | Anclas: 04/05 para producto, 02/03 para marketing |
| I-9 | Subtítulos de fila en [04] ≈ 10 px | Mínimo `xs` = 12 px por accesibilidad |
| I-10 | `display-xl` medido 108 px se siente sobredimensionado en navegador | Máx. 96 px (`clamp(64px, 6.5vw, 96px)`); la fidelidad visual prima sobre la medición |
| I-11 | Magnolia en [06] muestra un **mosaico asimétrico**; el contrato pide `gallery: "grid"` | Se define `grid` como rejilla con *spans* (§5, regla 5) para que ambos coincidan |
| I-12 | La **tarjeta en arco** de la portada de [06] podría confundirse con `photoMask: "arch"` | La tarjeta en arco es parte de la variante de hero `centered` de Magnolia; `photoMask: "fade"` afecta a la foto |
| I-13 | `paperTexture: true` en Magnolia exige una textura, y la política de assets prohíbe incorporar imágenes sin licencia registrada | El efecto queda **declarado pero inactivo** hasta registrar una textura en `ASSET_LICENSES` |
