# COMPONENTS — Hilo Luna

> Inventario de componentes **derivado de los mockups**. Objetivo: construir cada pieza **una vez** y reutilizarla (reglas 10, 12, 14). Nada de este documento autoriza inventar componentes que no aparezcan en un mockup (regla 5).
>
> Antes de crear cualquier componente: buscar aquí y en `components`, `invitation`. Si existe uno equivalente, **extenderlo con una variante**.
>
> Procedencia: `[01]…[06]` = mockup donde aparece. **Sin mockup** = existe la necesidad pero no el diseño (Q-13); no se implementa sin aprobación.

## 0. Estado de implementación (Design System v1)

Implementado y demostrado en la ruta interna **`/design-system`** (todos los estados: normal, hover/foco por interacción, deshabilitado, cargando, error, vacío).

| Grupo | Componente | Archivo | Notas |
|---|---|---|---|
| Tipografía | `Heading`, `Text`, `Eyebrow`, `Numeral`, `EmphasisText` | `components/ui/typography.tsx` | Tamaños por token (`text-lu-*`); `*palabra*` = cursiva |
| Acciones | `Button` (primary · secondary · ghost; sm 40 · md 44 · lg 54 · xl 64; `shape="pill"`, `font="serif"`, `arrow`, `loading`, `asChild`, `fullWidth`) | `components/ui/button.tsx` | Rectángulo r 10/12/16; **`shape="pill"` solo para el CTA de la navbar**. `loading` = `disabled` real sin atenuar |
| Acciones | `IconButton` (outline · solid · ghost; circle · square), `ArrowBadge` (versión decorativa dentro de tarjetas-enlace) | `components/ui/icon-button.tsx` | `aria-label` obligatorio |
| Formularios | `Input`, `Textarea` (`tone="serif"`, `invalid`), `Field` (etiqueta + contador + ayuda + error) | `input.tsx`, `textarea.tsx`, `field.tsx` | Alto 44, r 8. `controlStyles` compartido |
| Formularios | `Select` (Radix) | `select.tsx` | |
| Formularios | `Checkbox` (Radix, incl. indeterminado), `Switch` (Radix, 44 × 26) | `checkbox.tsx`, `switch.tsx` | Activo `brown-600` |
| Navegación | `Tabs` (`underline` · `segmented`) | `tabs.tsx` | |
| Navegación | `NavBar`, `NavLink`, `SidebarNav`, `SidebarItem`, `Breadcrumbs` (chevron · barra) | `components/layout/navigation.tsx` | El estado activo llega por props |
| Marca | `Wordmark` | `components/layout/wordmark.tsx` | |
| Datos | `Badge` (neutral · outline · accent · ink · success · pending · declined; `dot`) | `badge.tsx` | |
| Superficies | `Card` (default · flat · tint; `interactive`), `CardHeader/Title/Description/Content/Footer` | `card.tsx` | Filete 1 px + sombra suave |
| Superposiciones | `Dialog` (modal sm/md/lg) | `dialog.tsx` | Velo de tinta 40 %, sin blur |
| Superposiciones | `DropdownMenu` | `dropdown-menu.tsx` | |
| Editorial | `SectionHeading` (eyebrow + titular con cursiva + subtítulo) | `section-heading.tsx` | |
| Plantillas | `TemplateCard`, `TemplateCardSkeleton` | `components/templates/template-card.tsx` | Sin imagen: bloque tintado |
| Dashboard | `StatusCard` (confirmed · pending · declined), `StatusCardSkeleton` | `components/dashboard/status-card.tsx` | |
| Dashboard | `ShortcutCard`, `ActivityCard`, `ActivityItem` | `components/dashboard/` | |
| Otros | `Avatar` (inicial) | `avatar.tsx` | Sin fotos (demo en mockups) |
| Estados | `EmptyState` (plain · dashed), `LoadingState`, `Spinner`, `Skeleton`, `CardSkeleton` | `empty-state.tsx`, `loading-state.tsx`, `spinner.tsx`, `skeleton.tsx` | Sin mockup: derivados de tokens |
| Pantallas | `NotFoundScreen` (404 del producto) | `components/layout/not-found-screen.tsx` | La invitación tiene su propio 404 |

**Homepage (mockup 01) — `components/marketing/`:**

| Componente | Archivo | Notas |
|---|---|---|
| `SiteHeader`, `MobileMenu` | `site-header.tsx`, `mobile-menu.tsx` | Navbar transparente sobre el hero; CTA `shape="pill"`; menú móvil accesible (`aria-expanded`, Escape, 48 px) |
| `SiteFooter` | `site-footer.tsx` | Año actual con `new Date().getFullYear()` |
| `Hero`, `HeroVisual`, `PhoneFrame`, `FloatingBadge` | `hero*.tsx`, `phone-frame.tsx`, `floating-badge.tsx` | Composición del hero con placeholders; `PhoneFrame` (`sm`/`md`/`lg`) reutilizable (03, 04). La pantalla del hero es `CoverScreen` (`components/templates/preview-screens.tsx`) |
| `EventCategories`, `EventCategoryCard` | `event-categories.tsx`, `event-category-card.tsx` | 6 col. (`xl`) · 3 (`md`) · 2 (móvil) |
| `HowItWorks`, `HowItWorksStep`, `HowItWorksVisual` | `how-it-works*.tsx` | 3 columnas desde `lg`; apilado debajo |
| `FeatureShowcase`, `FeatureShowcaseCard`, demos | `feature-showcase*.tsx`, `feature-demos.tsx` | Bento 4/4/4 + 3/3/3/3; demos decorativas (`aria-hidden` + `inert`) |
| `FeaturedTemplates` | `featured-templates.tsx` | Reutiliza `TemplateCard` |
| `FinalCta` | `final-cta.tsx` | Banner r 20 con filete, sombra y escena visual a la derecha |
| `MarketingSection` | `marketing-section.tsx` | `<section aria-labelledby>` + ritmo vertical + revelado |
| `MediaSlot`, `SceneBlobs` | `components/ui/media-slot.tsx` | Placeholder de imagen reemplazable por asset (`src`). Sin `src`, `scene` (`petals` · `fabric` · `roses`) dibuja manchas difusas con tokens que se leen como foto neutra fuera de foco. Solo CSS, sin imágenes ni degradados de UI |

Contenido tipado en `lib/content/home.ts` y `lib/content/navigation.ts` (tipos en `types/marketing.ts`).

**Galería `/templates` [02] (implementada):** `Chip` (`components/ui/chip.tsx`, botón de alternancia con `aria-pressed`), `PageHero` (`components/marketing/page-hero.tsx`), `TemplateFilters` (cliente, controlado), `TemplateGrid`, `TemplateGallery` (cliente: filtros ↔ URL) y `CatalogTemplateCard` (`Template` → `TemplateCard`, compartido con la home). Datos MOCK tipados en `lib/content/templates.ts` (`types/templates.ts`); lógica pura en `lib/templates/filter.ts`. El estado activo de la navbar lo calcula `SiteNavLinks` (isla cliente) con `lib/navigation.ts`. `premium` es un dato: [02] no muestra distintivo.

**Detalle `/templates/[slug]` [03] (implementado):** `TemplateDetail` (recibe un `Template` y opcionalmente las relacionadas; no conoce ninguna plantilla concreta), `TemplatePreview` (cliente: teléfono `PhoneFrame lg` + rail de miniaturas; elegir una miniatura cambia la pantalla), `PreviewScreen`/`CoverScreen` (`preview-screens.tsx`: pantallas de muestra medidas en `cqw`, sirven para teléfono, miniaturas y hero), `TemplateFeatureList` ("INCLUYE EN TU INVITACIÓN") y `RelatedTemplates` (reutiliza `TemplateGrid` → `TemplateCard`, con `allStyles`). Relacionadas por `lib/templates/related.ts` (mismo tipo de evento, luego estilo). `Button` gana `external` (↗) y ahora pinta `arrow`/`external` también con `asChild` (antes se ignoraban). `SocialProof` sigue omitido. **Pendiente de [03]:** CTA fijo inferior en móvil ("a validar", RESPONSIVE) y plantillas Peonía/Eucalipto (solo aparecen en [03]; no están en el catálogo de [02]).

**Pendiente (no pedido en esta entrega):** `PageHeader`, `WorkspaceSidebar`/`Topbar` (composición), `EventHeroBanner`, `DonutChart`, `SharePanel`, y todo lo del editor (`SectionList`, `ImageField`, `OptionCardGroup`, `SwatchPicker`, `PreviewPane`…). `SocialProof` sigue omitido por decisión.

**Regla de mantenimiento:** los tokens propios nuevos (`text-lu-*`, `rounded-lu-*`, `shadow-lu-*`, `font-lu-*`) se registran también en `lib/utils.ts`; si no, `cn` no los fusiona bien (p. ej. `rounded-lu-button` + `rounded-lu-pill` quedarían ambos).

## 1. Capas

| Capa | Ubicación | Descripción | Tokens |
|---|---|---|---|
| **Primitivas** | `components/ui` | Base shadcn/ui re-tematizada (Button, Input, Select, Switch, Dialog…) | `--lu-*` |
| **Compuestos de producto** | `components/brand · marketing · workspace · editor` | Piezas de las pantallas del producto | `--lu-*` |
| **Bloques de invitación** | `invitation/blocks/*` | Render + editor de cada `BlockType` | `--inv-*` |
| **Marco de invitación** | `invitation/renderer` | `InvitationRenderer`, `SectionBoundary` | `--inv-*` |

Ninguna capa de producto importa de `invitation/blocks`, salvo el **editor** (que monta el renderizador en el iframe de preview y usa los `Editor` de cada bloque).

---

## 2. Primitivas (`components/ui`)

| Componente | Variantes / props | Aparece en | Notas |
|---|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost` · `size: md \| lg \| xl` · `font: sans \| serif` · `icon: arrow \| external \| pencil \| eye \| share \| none` · `iconPosition` | [01][02][03][04][05][06] | Primario = tinta `--lu-ink`, texto crema. Secundario = contorno `--lu-border-outline` sobre `--lu-surface`. `xl + serif` solo en [03] (I-1). Radio `--lu-radius-button`. |
| `IconButton` | `shape: circle \| square` · `size` | Flecha circular en tarjetas [01][02][03][05]; flechas del paginador [04]; campana [05] | Círculo con borde `--lu-border-subtle`, fondo `--lu-surface`. |
| `Chip` | `active`, `as: button \| link` | Filtros [02] ("Todas", "Bodas"…) | Píldora; activo = tinta, inactivo = contorno sutil. |
| `Select` | `size` | "Todos los estilos" [02]; fuentes [04]; "Agregar al calendario" [01] | Chevron `ChevronDown`. |
| `Input` / `Textarea` | `counter`, `serif` | Campos [04] | Texto de valor en serif; contador "11 / 50" a la derecha (`--lu-text-subtle`). |
| `Switch` | — | "Overlay en imagen" [04] | Activo `--lu-brown-600`. |
| `Segmented` | 2 opciones | "Móvil / Escritorio" [04] | Contenedor píldora claro, opción activa elevada. |
| `Breadcrumb` | — | [03] (Plantillas › Magnolia), [04] (Mis eventos / Boda de…), [05] | Separadores `›` o `/` según pantalla (ver Q-15 si hay que unificar). |
| `Avatar` | `src` o inicial | Menú de usuario "A Andrea" [05] | Inicial en círculo si no hay foto. |
| `Card` | `padding`, `interactive` | Base de TemplateCard, StatCard, ShortcutCard… | Sombra `--lu-shadow-card`, radio `--lu-radius-card`. |
| `Dialog` / `Popover` / `Toast` / `Tooltip` | — | **Sin mockup** | Aprobar antes de usar (Q-13). |

---

## 3. Marca y layout global

| Componente | Descripción | Aparece en |
|---|---|---|
| `Wordmark` | "Hilo Luna" en serif (tamaño `md/lg`). Nombre desde `siteConfig` | [01]–[06] |
| `SiteNavbar` | Wordmark · Plantillas · Cómo funciona · Precios · Entrar · botón "Crear invitación →". Transparente sobre héroes; enlace activo con subrayado tostado | [01][02][03] |
| `SiteFooter` | Filete superior · Wordmark · Plantillas/Precios/Cómo funciona/Contacto/Términos · © | [01][02][03] |
| `PageHero` | Eyebrow + título + lead + texto sobre imagen de fondo con desvanecimiento en el asset | [01][02] |
| `SectionHeading` | Título con palabra en cursiva + subtítulo opcional (`EmphasisHeading`) | [01][03][05] |
| `Eyebrow` | Texto MAYÚSCULAS tracking amplio | [01][03][04][06] |
| `EmphasisHeading` | Recibe texto con marcador de énfasis (p. ej. `Todo lo que necesitas en una *sola invitación*`); renderiza `<em>` | Titulares |

---

## 4. Marketing (`components/marketing`)

| Componente | Descripción | Mockup |
|---|---|---|
| `HeroHome` | Eyebrow, H1 con énfasis, párrafo, 2 CTAs, línea de puntos (`Sin conocimientos de diseño · RSVP · Música · Galería · Cuenta regresiva`), teléfono a la derecha | [01] |
| `PhoneMockup` | Marco de teléfono con imagen/iframe dentro. Reutilizado en [01][03][04]. Variante `notch`, tamaño y sombra `--lu-shadow-device` | [01][03][04] |
| `FloatingBadge` | Chip flotante (ícono + título + subtítulo) sobre el teléfono: "Cuenta regresiva 142 días", "RSVP", "Música", "Ubicación" | [01] |
| `CategoryCard` / `CategoryGrid` | Foto + nombre + flecha circular. 6 categorías | [01] |
| `StepList` / `StepItem` | Numeral serif taupe `01/02/03` + ilustración + título + texto; separadores verticales | [01] |
| `FeatureShowcaseCard` | Tarjeta con mini-UI ilustrativa (cuenta regresiva, RSVP, mapa, regalos, galería, música, calendario). **Composición estática**; usa los mismos átomos visuales. **No** reproducir canciones, carátulas ni logos de terceros del mockup (Liverpool/Amazon/Sears, "Perfect · Ed Sheeran"): usar contenido propio/neutro (N-05, Q-05) | [01] |
| `TemplateCard` | Imagen de escena (aspect ≈ 4:3.3), nombre serif, `TemplateMeta` (categoría · estilo), flecha circular. Único componente para home, galería, detalle («otros diseños») | [01][02][03] |
| `TemplateGrid` | Grid 3 columnas (escritorio) | [02][03] |
| `TemplateFilters` | Fila de `Chip` (Todas, Bodas, XV años, Infantil, Bautizo, Baby Shower) + `Select` de estilos | [02] |
| `TemplateHeaderInfo` | Breadcrumb · H1 · meta con puntos · descripción con palabra en negrita | [03] |
| `TemplateFeatureGrid` | Rejilla 2×3 de `FeatureItem` (icono en cuadrado suave, título, subtítulo) bajo "INCLUYE EN TU INVITACIÓN" | [03] |
| `ScreenThumbRail` | Columna vertical de miniaturas + chevron para más | [03] |
| ~~`SocialProof`~~ | Corazón, texto, pila de avatares, estrellas, "4.9 de 5" | [03] — **OMITIDO por decisión**: no se construye ni se muestra hasta que existan datos reales (conteo real de invitaciones por plantilla; las valoraciones requieren un sistema de reseñas que no existe). El detalle [03] se maqueta sin este bloque |
| `CtaBanner` | Banda con título ("Tu historia comienza con una *invitación*"), texto, 2 CTAs e imagen | [01] |

### Estados no diseñados (Q-13)
Galería vacía / sin resultados, carga de imágenes, error. Se proponen solo con tokens existentes cuando se aprueben.

---

## 5. Espacio de trabajo / Dashboard (`components/workspace`)

| Componente | Descripción | Mockup |
|---|---|---|
| `WorkspaceSidebar` | Wordmark · nav (Mis eventos, Plantillas, Lista de invitados, Confirmaciones, Mensajes, Configuración) con ícono, fila activa `--lu-nav-active` · `PromoCard` inferior | [05] |
| `WorkspaceTopbar` | Campana + `UserMenu` (avatar inicial, nombre, chevron) | [05] |
| `PageHeader` | Breadcrumb · H1 gigante · meta (`Calendar` fecha, `Clock` "Faltan 235 días") · acciones | [05] |
| `PromoCard` | Tarjeta con foto de fondo, texto con énfasis y flecha | [05] |
| `EventHeroBanner` | Texto con énfasis + foto de invitación a la derecha | [05] |
| `StatCard` | Icono circular semántico + numeral serif + etiqueta + flecha + flores a la derecha. Variantes `confirmed \| pending \| declined` | [05] |
| `ShortcutCard` | Icono cuadrado + título serif + flecha + descripción + **pie ilustrativo** (imagen / mini lista / dona / compartir) | [05] |
| `GuestPreviewList` | 3 filas avatar + nombre + estado (✓ / reloj / +) — pie del shortcut "Invitados" | [05] |
| `DonutChart` | Dona salvia/arena/rosa con total al centro ("108 Confirmados") | [05] — debe llevar alternativa textual (los totales por estado) para accesibilidad |
| `SharePanel` | Íconos de compartir + URL + copiar. **URL mostrada: `<base>/i/<slug>`** (`getPublicInvitationUrl`; p. ej. `hiloluna.com/i/andrea-y-fernando`; el mockup muestra `lunaria.com/andrea-fernando`, sin `/i/`). Íconos de WhatsApp/Instagram: genéricos hasta resolver Q-05 | [05] |
| `ActivityList` / `ActivityItem` | Avatar + texto con nombre en serif + tiempo relativo a la derecha; encabezado con "Ver toda la actividad →" | [05] |
| `EventQuoteCard` | Foto de fondo + tarjeta con "NUESTRO EVENTO" y cita | [05] |
| `EventListItem` (Mis eventos) | **Sin mockup** | — |

Estados por diseñar: vacío (sin invitados / sin actividad), carga (skeletons), error.

---

## 6. Editor (`components/editor`)

| Componente | Descripción | Mockup |
|---|---|---|
| `EditorTopbar` | Wordmark · atrás `‹` · migas "Mis eventos / Boda de Andrea & Fernando" · `SaveStatus` · botón "Vista previa" · botón "Publicar →" | [04] |
| `SaveStatus` | Check + "Guardado" + "hace unos segundos" (estados: guardando, error — **sin mockup**) | [04] |
| `EventSummaryCard` | Miniatura + título + "Guardado" + chevron | [04] |
| `SectionList` | Lista ordenable | [04] |
| `SectionRow` | Asa de arrastre · icono en cuadrado · título + subtítulo · ojo (visibilidad). Estado activo: fondo `--lu-selected` + borde izquierdo `--lu-brown-900` | [04] |
| `AddSectionButton` | Botón de borde discontinuo "＋ Agregar sección" | [04] |
| `AddSectionPicker` | Selector de bloques | **Sin mockup** |
| `EditorPanel` | Encabezado (Eyebrow "EDITANDO SECCIÓN" + H serif + descripción) y cuerpo de formulario | [04] |
| `FieldGroup` | Etiqueta + control + contador | [04] |
| `ImageField` | Vista previa con botón ✕ + `Dropzone` discontinua ("Cambiar imagen", "Arrastra una imagen aquí o haz clic…", "JPG, PNG o WEBP · Recomendado 1080 × 1920") | [04] |
| `OptionCardGroup` | 3 tarjetas con mini-ilustración (Izquierda / Centrada / Derecha); seleccionada con borde `--lu-brown-600` | [04] |
| `FontPairField` | Panel teñido con 2 selects. Opciones = lista curada open-source registrada en `ASSET_LICENSES` (el mockup muestra "Playfair Display" y "Montserrat"; el valor por defecto de Magnolia será Cormorant Garamond) | [04] |
| `SwatchPicker` | 5 círculos, seleccionado con anillo | [04] |
| `ToggleRow` | Switch + descripción | [04] |
| `PreviewPane` | `Segmented` Móvil/Escritorio · `DeviceFrame` con **iframe** · paginador `‹ 1 / 10 ›` · `InfoNote` | [04] |
| `InfoNote` | Icono bombilla + título + texto en panel teñido | [04] |
| Formularios de **las otras 11 secciones** (incluye las añadidas `DRESS_CODE` y `CLOSING`) | Cada bloque aporta su `Editor` reutilizando `FieldGroup`, `ImageField`, listas repetibles | **Sin mockup** (solo Portada está diseñada) |
| Íconos de `SectionRow` para **Dress code** y **Cierre** | Los mockups no los definen. Propuesta a aprobar, en el estilo de línea fina: `Shirt` y `Sparkles` | **Sin mockup** |
| `MusicSourcePicker` | Selector de origen (`library` / `upload` / `external`), subida de audio con **casilla obligatoria de confirmación de derechos**, campos título/artista, volumen, loop, "reproducir tras abrir la invitación". `external` explica que es solo un enlace. `library` oculta hasta resolver N-01 | **Sin mockup** (Q-13, N-01, N-02) |

Listas repetibles (sedes, itinerario, galería, regalos) requieren un patrón de "ítem de lista" (añadir/quitar/reordenar) **sin mockup**: se propondrá reutilizando `SectionRow` + `AddSectionButton` y se aprobará antes de implementar.

---

## 7. Bloques de invitación (`invitation/blocks`)

Cada bloque expone: `definition.ts` (tipo, metadatos), `schema.ts` (Zod), `defaults.ts`, `Editor.tsx`, `variants/default.tsx` (+ variantes por plantilla).

| Bloque | Componentes internos | Mockup |
|---|---|---|
| `cover` | `CoverHero`, `ArchCard`, `NameStack` (nombres + `&`), `Ornament`, `OpenButton` | [06] |
| `date` | `DateLine`, `AddToCalendarButton` | [06] (implícito), [01] |
| `countdown` | `CountdownDisplay` (isla cliente) — 4 `CountdownUnit` con separadores | [06], [01] |
| `location` | `VenueCard` (imagen + texto, `align: left \| right`), `MapLink` | [06] |
| `story` | `StoryText` | [06] |
| `gallery` | `MasonryGallery`, `Lightbox` (isla cliente, **sin mockup del lightbox**) | [06] |
| `itinerary` | `TimelineHorizontal`, `TimelineItem` | [06] |
| `gifts` | `GiftLinkButton`, `GiftIllustration` | [06] |
| `rsvp` | `RsvpCallout`, `RsvpForm` (**sin mockup**) | [06] |
| `music` | `MusicController` (contexto + un `<audio>`) y `MusicToggle` flotante para `library`/`upload`; `MusicExternalLink` (enlace simple) para `external`. **Sin iframes ni SDK de terceros.** Reproducción solo tras "Abrir invitación" (ver `ARCHITECTURE` §10.1) | Sin mockup en invitación; maqueta ilustrativa en [01] |
| `dress_code` | `DressCodeBlock`, `SwatchRow` | [06] |
| `closing` | `ClosingHero` | [06] |

**Piezas compartidas entre bloques de invitación** (`invitation/renderer/parts`): `SectionShell` (fondo, textura, decoración por slot, padding), `SectionTitle` (con énfasis cursivo), `EyebrowLabel`, `InvPrimaryButton`, `InvOutlineButton`, `DecorLayer` (posiciona `DecorAsset` por slot), `Divider`. Todas leen `--inv-*`.

`InvPrimaryButton` **no es** `components/ui/Button`: pertenece al lenguaje de la invitación (regla 7) aunque visualmente se parezcan hoy.

---

## 8. Reglas de composición

1. **Una pieza, un lugar.** `TemplateCard`, `PhoneMockup`, `Wordmark`, `EmphasisHeading`, `IconButton` no se duplican por pantalla.
2. **Variantes antes que forks.** Diferencias entre pantallas (p. ej. botón `xl` serif de [03]) se expresan como variantes tipadas.
3. **Texto por props/copy central**, no incrustado en el componente.
4. **Accesibilidad de serie**: foco visible con `--lu-brown-600`, roles ARIA en `SectionList` (lista reordenable), `aria-pressed` en chips/toggles, `alt` obligatorio en imágenes de contenido.
5. **Server por defecto**, `"use client"` solo en: `SectionList` (drag), `Switch`, `Select`, filtros, `CountdownDisplay`, `MusicPlayer`, `Lightbox`, `RsvpForm`, `PreviewPane`.
6. **Imágenes** siempre con `next/image`, `sizes` correctos y `priority` solo en LCP.
7. **Datos demo** (p. ej. "Mariana López", "108 Confirmados") jamás incrustados en componentes; viven en `invitation/sample` o fixtures de desarrollo.

## 9. Verificación previa a crear un componente (checklist)

- [ ] ¿Aparece en un mockup? (si no → preguntar)
- [ ] ¿Existe ya uno equivalente (buscado con Grep/Glob)?
- [ ] ¿Es de producto (`--lu-*`) o de invitación (`--inv-*`)?
- [ ] ¿Se puede lograr con una variante del existente?
- [ ] ¿Sus textos están en el módulo de copy?
- [ ] ¿Es Server o necesita `"use client"`?
