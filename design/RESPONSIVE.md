# RESPONSIVE — Hilo Luna

> **Aviso de cobertura.** Los mockups solo muestran **un tamaño por pantalla**: marketing/editor/dashboard en escritorio (≈ 1122–1448 px) y la invitación en móvil (≈ 470 px por columna). Todo comportamiento en otros tamaños es **[INFERIDO]** y requiere validación (Q-13). Se documenta la intención para no improvisar durante la implementación, no para rediseñar.

## 1. Estrategia por superficie (reglas 8 y 9)

| Superficie | Enfoque | Tamaño de diseño (mockup) | Dispositivo objetivo |
|---|---|---|---|
| **Invitación pública** | **Mobile-first** | Móvil (~375–430 px) [06] | Teléfono (canal principal: enlace en WhatsApp) |
| Marketing | Desktop-first responsive | 935/1122 px [01][02][03] | Escritorio y móvil |
| Dashboard | Desktop-first responsive | 1448 px [05] | Escritorio; consulta en móvil |
| Editor | Desktop-first responsive | 1448 px [04] | Escritorio/tablet; **móvil por decidir** |

Nota de negocio: si el público es LatAm, una parte relevante de los anfitriones editará desde teléfono. El mockup del editor no lo contempla. **Q-13** — se necesita decisión antes de invertir en el editor móvil.

## 2. Breakpoints (Tailwind por defecto, sin personalizar)

| Nombre | Ancho mín. | Uso |
|---|---|---|
| base | 0 | Móvil vertical |
| `sm` | 640 | Móvil grande / horizontal |
| `md` | 768 | Tablet vertical |
| `lg` | 1024 | Tablet horizontal / laptop pequeña |
| `xl` | 1280 | Escritorio |
| `2xl` | 1536 | Pantalla grande (contenedor no crece más) |

- **Producto**: el *diseño de referencia* es de escritorio, pero el CSS se escribe **móvil-first** (utilidades base + `md:`/`lg:`), que es como Tailwind funciona mejor. Se implementa el layout escritorio del mockup a partir de `lg:`/`xl:` y el colapso hacia móvil se define en las tablas de abajo.
- **Invitación**: contenedor de 375–430 px como diseño base; las unidades tipográficas usan `clamp()` acotado para que 360 px y 430 px se vean proporcionados.

## 3. Marketing

Contenedor `lu-container`: máx. **1440 px** con gutters **16 (base) → 24 (`md`) → 32 (`lg`) → 64 (`xl`)**, es decir 1312 px de contenido en escritorio (medido en [01][02][03]; ver `DESIGN_SYSTEM.md` §3.6).

| Sección [01–03] | Escritorio (mockup) | Tablet (`md`) [INFERIDO] | Móvil (base) [INFERIDO] |
|---|---|---|---|
| Navbar | Wordmark · 4 enlaces · CTA | Igual, enlaces compactos | Wordmark + botón menú; enlaces en panel; CTA visible (o dentro del panel) |
| Hero home | Texto izq. / teléfono der. con chips flotantes | Texto arriba, teléfono debajo | Apilado; **chips flotantes reducidos a 2** o reubicados para no tapar el teléfono |
| Categorías (6) | 6 columnas | 3 columnas | 2 columnas (o carrusel horizontal con scroll-snap) |
| "Así de fácil" | 3 pasos en fila con separadores verticales | 3 columnas más estrechas | Pasos apilados; separadores pasan a horizontales |
| Features (7 tarjetas) | Grilla mixta 3 + 4 | 2 columnas | 1 columna |
| Plantillas destacadas (3) | 3 columnas | 3 → 2 | 1 columna (o carrusel) |
| Banner CTA | Texto izq. / foto der. | Igual | Apilado; foto reducida al fondo |
| Galería [02] | 3 columnas | 2 columnas | 1 columna; **filtros con scroll horizontal** |
| Detalle [03] | Miniaturas · teléfono · info | Teléfono + info apilado; miniaturas horizontales | Teléfono arriba, miniaturas en fila, info debajo; **CTA fijo inferior** (a validar) |
| Footer | Wordmark + enlaces + © | Igual | Apilado |

Regla: los títulos grandes son **fluidos** (`clamp()` en los tokens `text-lu-display-*`, `title-xl`, `h2`, `h3`, `numeral-lg`): p. ej. `display-md` va de 40 px en móvil a 60 px en 1440; `h2` de 28 a 40.

## 4. Dashboard (`/dashboard/events/[id]`)

| Elemento [05] | Escritorio (mockup) | Tablet [INFERIDO] | Móvil [INFERIDO] |
|---|---|---|---|
| Sidebar | Fija, 255 px | Colapsa a iconos (~72 px) o `Sheet` con botón | Menú inferior/`Sheet`; el `PromoCard` se omite |
| Topbar | Campana + usuario | Igual | Wordmark + menú |
| PageHeader | H1 grande + acciones a la derecha | Acciones debajo del título | Título más pequeño; botones a ancho completo |
| Hero banner | Texto + foto | Igual con foto menor | Apilado, foto arriba o fondo |
| StatCards (3) | 3 en fila | 3 en fila | 1 columna o scroll horizontal |
| ShortcutCards (4) | 4 en fila | 2×2 | 1 columna; pies ilustrativos simplificados |
| Actividad + `EventQuoteCard` | 2 columnas | Apilado | Apilado; quote card oculta (decorativa) |

## 5. Editor (`/dashboard/events/[id]/edit`)

Diseño de referencia: **3 paneles** (lista de secciones ≈ 350 px · panel de edición flexible · vista previa ≈ 460 px).

| Ancho | Comportamiento **[INFERIDO]** |
|---|---|
| ≥ 1280 | 3 paneles como el mockup |
| 1024–1279 | Lista de secciones colapsable a iconos; edición + preview |
| 768–1023 | Preview en `Sheet`/pestaña "Vista previa" (ya existe el botón "Vista previa" en [04]); lista y edición como pestañas o navegación en dos niveles |
| < 768 | **Sin diseño.** Propuesta mínima a validar: navegación en dos niveles (lista → sección) con botón "Vista previa" a pantalla completa. No se implementa hasta aprobarlo (Q-13) |

- La topbar del editor (atrás, migas, guardado, Vista previa, Publicar) se comprime: migas recortan con `…`; "Guardado" pasa a ícono.
- El preview en iframe usa un **viewport real** de 390 × 844 (Móvil) y ancho fluido (Escritorio); se escala con `transform: scale` para caber, sin cambiar el layout interno.
- Los toggles Móvil/Escritorio del preview [04] cambian el ancho del iframe; **el diseño de la invitación en escritorio no existe** (Q-12).

## 6. Invitación pública (`/i/[slug]`) — mobile-first

### 6.1 Móvil (referencia [06])

- Ancho de diseño ≈ 375–430; **sin scroll horizontal jamás**.
- Portada a alto completo (`100svh` con fallback), tarjeta en arco centrada, botón "Abrir invitación" accesible con el pulgar.
- Secciones a ancho completo, padding lateral 20–24 px [E], ritmo vertical alto.
- **Sedes**: en el mockup son *medio-imagen / medio-texto*, alternando lados, a ancho móvil. Se conserva ese layout en móvil (no se apila).
- **Itinerario**: 5 puntos en línea horizontal caben a 390 px. Con más de 5 → scroll horizontal con snap o 2 filas.
- **Galería**: mosaico de 2 columnas asimétricas.
- **Cuenta regresiva**: 4 columnas con separadores; a < 340 px reduce cifras.
- Zonas seguras (`env(safe-area-inset-*)`) en portada y botones fijos.
- Objetivos táctiles ≥ 44 px.

### 6.2 Tablet / escritorio **[Q-12 — sin diseño]**

Decisión provisional, **solo para no romper nada**: la invitación se renderiza en una **columna central de ancho móvil (≈ 430 px, máx.)** sobre un lienzo neutro ligado al tema (`--inv-bg`), con la portada al alto del viewport. No se añaden layouts nuevos de escritorio hasta contar con diseño. Esto también define el preview "Escritorio" del editor.

### 6.3 Imágenes

- `next/image` con `sizes="(max-width: 430px) 100vw, 430px"` en invitación.
- Decoraciones florales: versiones @1x/@2x, formato AVIF/WebP; en móviles de baja densidad no cargar la versión grande.
- Portada: `priority`, `fetchpriority="high"`; el resto `loading="lazy"`.
- Presupuesto orientativo: portada < 150 KB, cada decoración < 40 KB, total inicial < 600 KB [E].

## 7. Tipografía fluida

- Marketing: escala §3.2 de `DESIGN_SYSTEM` en breakpoints (sin `clamp` agresivo, para mantener fidelidad al mockup).
- Invitación: `clamp(min, vw, max)` para nombres, títulos y cifras (evita saltos entre 360 y 430 px).
- Nunca por debajo de 14 px en texto de lectura, 10 px en etiquetas MAYÚSCULAS con tracking.

## 8. Pruebas de responsive (cuando exista código)

| Viewport | Superficie |
|---|---|
| 360 × 740, 390 × 844, 430 × 932 | Invitación, marketing |
| 768 × 1024 | Marketing, dashboard, editor |
| 1280 × 800, 1440 × 900 | Marketing, dashboard, editor |

Criterios: sin overflow horizontal, sin texto cortado, objetivos táctiles, contraste AA, comparación visual con el mockup en el tamaño de referencia.
