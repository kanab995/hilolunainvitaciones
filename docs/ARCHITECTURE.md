# ARCHITECTURE — Hilo Luna

> Estado: **v0.3 — scaffold implementado** (la estructura de §3 y los dos layouts raíz ya existen; el resto sigue siendo propuesta). Incorpora las decisiones del propietario (URL `/i/[slug]`, tipografía open-source, política de música, política de assets). Ninguna decisión de este documento está implementada. Las decisiones importantes están numeradas (D-xx) en el [Registro de decisiones](#12-registro-de-decisiones).

## 1. Principios rectores

1. **Contenido ≠ presentación.** Lo que escribe el usuario (contenido) y cómo se ve (plantilla/tema) son datos distintos y viajan por caminos distintos. Cambiar de plantilla solo cambia la presentación.
2. **Un renderizador, muchas plantillas.** Nunca una página por plantilla. La plantilla es configuración.
3. **Bloques como unidad.** Todo lo que aparece en una invitación es un bloque con esquema, editor y render.
4. **Dos lenguajes visuales aislados.** Producto (marketing/dashboard/editor) e invitación (por plantilla) no comparten estilos ni tokens.
5. **Capas con dirección única.** UI → servicios → repositorios → Prisma. Nunca al revés.
6. **Diseñar para lo diferido, no construirlo.** Auth, storage, email, pagos y analytics entran por interfaces; hoy no se instalan.
7. **Una sola fuente de verdad por dato.** La fecha del evento vive en `Event`; los bloques la leen.

## 2. Vista general

```
                ┌───────────────────────────────────────────────┐
                │                 Next.js App Router            │
                │                                               │
  Producto  ──▶ │ (site)  marketing · dashboard · editor        │ ── tokens --lu-*
                │ (invitation)  /i/[slug] · /preview            │ ── tokens --inv-* (por plantilla)
                └───────────────┬───────────────────────────────┘
                                │ Server Components / Server Actions / Route Handlers (finos)
                                ▼
                     server/services   (reglas de negocio, autorización, validación)
                                ▼
                     server/repositories (único lugar que importa Prisma)
                                ▼
                            PostgreSQL

  invitation/  (dominio de invitaciones — puro TS + React, sin Prisma)
     blocks/ · templates/ · theme/ · renderer/ · document/
```

## 3. Estructura de carpetas propuesta

Estructura **real tras el scaffold** (sin `src/`; decisión del propietario, D-16). Lo marcado *(futuro)* aún no existe:

```
/
├─ CLAUDE.md · AGENTS.md (lo genera Next: leer sus docs locales) · components.json (shadcn)
├─ app/
│  ├─ (site)/                          layout raíz #1 (producto) · site.css → tokens --lu-*
│  │  ├─ (marketing)/                  page.tsx (/) · templates/ · templates/[slug]/
│  │  ├─ (auth)/                       login/ · register/
│  │  └─ dashboard/
│  │     ├─ (workspace)/               page.tsx · events/ · events/[id]/ {page, guests/, rsvp/, settings/}
│  │     └─ (editor)/                  events/[id]/edit/
│  └─ (invitation)/                    layout raíz #2 (independiente) · invitation.css → tokens --inv-*
│     └─ i/[slug]/
├─ components/
│  ├─ ui/            primitivas shadcn re-tematizadas con --lu-*  (vacío: sin componentes sin mockup)
│  ├─ layout/        LayoutFrame, RoutePlaceholder, RouteIndex (temporales); luego navbar, footer, sidebar, topbar
│  ├─ editor/        SectionList, SectionRow, FieldGroup, DeviceFrame…            (vacío)
│  ├─ dashboard/     StatCard, ShortcutCard, ActivityList…                          (vacío)
│  ├─ invitation/    UI de render de invitación (SectionShell, piezas de bloques)   (vacío)
│  └─ templates/     TemplateCard, TemplateGrid, filtros de galería                 (vacío)
├─ lib/              site-config.ts · fonts.ts · routes.ts · utils.ts
├─ types/            (vacío)
├─ prisma/           README (Prisma no instalado)
├─ public/           (vacío; sin assets sin licencia registrada)
├─ docs/  ·  design/ (+ reference/ solo lectura)
│
├─ invitation/       (futuro) dominio: blocks/ templates/ theme/ renderer/ document/ sample/
└─ server/           (futuro) services/ repositories/ integrations/ db.ts
```

Correspondencia con la propuesta previa: `components/workspace` → `components/dashboard`; `components/marketing` y `components/brand` → repartidos entre `components/layout` (Navbar, Footer, Wordmark) y `components/templates` (TemplateCard, filtros), con las secciones propias del home a definir; `src/invitation` y `src/server` → `invitation/` y `server/` en la raíz **(ubicación por confirmar cuando se implementen; Q-23)**.

Regla de dependencias (a verificar con lint de imports cuando se haga el scaffold):

- `components/*` y `app/*` → pueden importar `invitation/*`, `services/*`, `lib/*`.
- `invitation/*` **no** importa `server/*`, `components/*` ni Prisma.
- `services/*` → `repositories/*`, `invitation/*` (esquemas).
- `repositories/*` → Prisma. Nadie más importa `@prisma/client` (salvo tipos vía repositorios).

## 4. Motor de invitaciones

### 4.1 Piezas

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **Contenido** | Datos que introduce el usuario, por sección | BD (`InvitationSection.content`) |
| **Ajustes de sección** | Preferencias de presentación agnósticas de plantilla (alineación, overlay, visibilidad de sub-elementos) | BD (`InvitationSection.settings`) |
| **Overrides de estilo** | Acento y tipografías elegidas por el usuario, **por plantilla** | BD (`Invitation.styleOverrides`) |
| **Bloque** | Definición reutilizable: esquema + editor + variantes | Código (`invitation/blocks`) |
| **Plantilla** | Tema + variante por bloque + decoraciones | Código (`invitation/templates`) + metadatos en BD |
| **InvitationDocument** | DTO serializable que consume el renderizador | Derivado (BD o snapshot) |

### 4.2 Contrato de bloque (ilustrativo)

```ts
interface BlockDefinition<C, S> {
  type: BlockType;
  label: string;                       // "Cuenta regresiva"
  hint: string;                        // "Tiempo para el gran día"
  icon: IconKey;
  allowMultiple: boolean;              // p. ej. LOCATION sí, COVER no
  contentVersion: number;
  contentSchema: z.ZodType<C>;
  settingsSchema: z.ZodType<S>;
  migrate: (fromVersion: number, raw: unknown) => C;
  createDefaults: (ctx: { eventType: EventType }) => { content: C; settings: S };
  Editor: React.ComponentType<BlockEditorProps<C, S>>;
  variants: Record<string, React.ComponentType<BlockRenderProps<C, S>>> & { default: … };
}
```

- Cada tipo de bloque tiene **siempre** una variante `default`, de modo que **toda plantilla puede renderizar todo bloque** (una plantilla solo elige variantes distintas cuando su diseño lo exige).
- Un bloque nunca conoce el nombre de una plantilla. Se adapta a través de **tokens** y **variantes**.

### 4.3 Contrato de plantilla (ilustrativo)

```ts
interface TemplateDefinition {
  slug: string;                         // = Template.slug en BD
  theme: InvitationTheme;               // colores, tipografías, radios, ritmo (ver design/DESIGN_SYSTEM.md §Tema)
  // La variante de COVER/LOCATION/GALLERY/ITINERARY la fija theme.layout (fuente única).
  // `variants` solo cubre OTROS bloques y no repite esas cuatro claves.
  variants: Partial<Record<Exclude<BlockType, "COVER" | "LOCATION" | "GALLERY" | "ITINERARY">, string>>;
  decor: Partial<Record<DecorSlot, DecorAsset>>;  // flores, marcos, ornamentos por "slot"
  fonts: FontRef[];                     // fuentes que necesita
}
```

Las decoraciones son **de la plantilla**, no del contenido: la esquina floral de Magnolia es un `DecorSlot` (`cover.cornerTopRight`, `section.dividerOrnament`…), no un campo del usuario. La foto de portada sí es contenido.

### 4.4 Cascada de estilo

```
tema de la plantilla  →  Invitation.styleOverrides[templateSlug]  →  section.settings
     (base)                    (elección del usuario)                 (por sección)
```

Resultado: variables CSS `--inv-*` sobre el contenedor `[data-template="<slug>"]`.

### 4.5 Cambiar de plantilla (regla 17)

Operación en servicio: `invitationService.changeTemplate(invitationId, templateSlug)`.

- Cambia **solo** `Invitation.templateId`.
- **No** toca `InvitationSection.content` ni `settings`.
- `styleOverrides` está indexado por plantilla → volver a la anterior restaura sus personalizaciones; la nueva empieza con su tema por defecto.
- Nada se elimina. Ocultar una sección es `isVisible = false`, nunca `DELETE` implícito.
- Se registra una entrada en `ActivityLog` para poder auditar/revertir.
- Test de invariante obligatorio cuando exista suite: *hash(content) antes = hash(content) después*.

### 4.6 Renderizador único

```
<InvitationRenderer
   document={InvitationDocument}      // contenido + eventos + estilo resuelto
   template={TemplateDefinition}
   mode="public" | "preview" | "thumbnail"
/>
```

- Server Component por defecto; islas cliente para: cuenta regresiva, música, lightbox de galería, formulario RSVP, animaciones de entrada.
- El **mismo** componente sirve la URL pública, el preview del editor y las miniaturas → WYSIWYG real.
- Cada sección se envuelve en un `SectionBoundary` (error boundary): un bloque roto no tumba la invitación.
- Secciones con `isVisible = false` no se renderizan (ni se envían al cliente).

### 4.7 Fecha y hora

La fecha canónica es `Event.startsAt` (UTC) + `Event.timezone` (IANA). `DATE` y `COUNTDOWN` derivan de ahí; el editor de "Fecha" escribe en `Event`. Cuenta regresiva calculada en cliente con la hora del servidor como referencia inicial (evita descuadres por reloj del dispositivo). Formato con `Intl` (sin librería de fechas).

### 4.8 Implementación del motor (D-19)

```
DATA        Invitation ── types/invitation.ts ── lib/invitation/mock/*        (contenido; nada visual)
TEMPLATE    InvitationTemplate ── types/invitation-template.ts ── lib/invitation/templates/*   (solo presentación)
SECTIONS    components/invitation/sections/*  + registry.ts (tipo → componente, único por tipo)
RENDERER    components/invitation/invitation-renderer.tsx
            <InvitationRenderer invitation={data} template={template} now={serverNow} />
```

- **Única unión entre DATA y TEMPLATE:** `Invitation.templateSlug` (cadena) y el renderizador. Los tipos no se importan entre sí. `changeTemplate()` (`lib/invitation/change-template.ts`) devuelve una copia con otro `templateSlug` y nada más; `contentFingerprint()` es la huella del contenido (invariante del §4.5).
- **La plantilla controla:** colores, fuentes, `layout` (hero/locations/gallery/timeline), `effects`, `decor` (por slot), `background`, `componentStyles` y `animations`. `templateToCssVars()` la publica como `--inv-*` sobre `[data-template]`; la personalización del usuario (`styleOverrides[slug].accent`) se aplica encima, solo para esa plantilla.
- **Las secciones son genéricas:** `HeroSection`, `StorySection`, `CountdownSection`, `LocationSection`, `TimelineSection`, `GallerySection`, `DressCodeSection`, `GiftRegistrySection`, `RSVPSection`, `FooterSection`. La lógica (cuenta regresiva, RSVP, ubicación) vive en `lib/invitation/*` y en islas cliente (`CountdownDisplay`, `RsvpPanel`), nunca por plantilla. Variantes hoy implementadas: hero `centered`; locations `split` y `stacked`; gallery `grid`; timeline `horizontal` y `vertical`; el resto de valores del contrato cae a la variante base.
- **Guardas automáticas** (`tests/invitation/`): los tipos no se importan; las plantillas no contienen texto ni claves de datos; `components/invitation` no menciona ninguna plantilla, no ramifica por `slug`, no importa el registro de plantillas y no usa `--lu-*`; el texto visible es idéntico con cualquier plantilla; renderizar/cambiar de plantilla no muta la invitación.
- **Magnolia terminada (mockup 06):**
  - *Assets:* `cover-bg.png` (fondo de portada) y `decor-corners.png` (hoja de 4 esquinas) son de la **plantilla** (`decor.heroBackdrop` y `decor.section*`, con `fragment` = cuadrante recortado por CSS, sin archivos derivados). Las fotos de sedes, galería, dress code y regalos son **contenido** (`ImageRef.src` en la invitación demo). Todos registrados en `ASSET_LICENSES.md` §5.1 (test que lo comprueba).
  - *Portada:* ≈ 100 svh; el fondo de la plantilla se sustituye por `cover.photo` si el usuario aporta una. En pantallas anchas el fondo (vertical) se centra con los bordes desvanecidos. Única imagen con `priority`.
  - *Anchos:* `--inv-column-max` para texto y `--inv-wide-max` (64 rem) para composiciones fotográficas (sedes, galería, dress code, regalos).
  - *Abrir invitación:* `InvitationShell` (isla cliente) guarda `opened` y `data-opened`; `lib/invitation/open-controller.ts` avisa a los suscriptores **síncronamente** dentro del clic (enganche del futuro `MusicController`; hoy sin suscriptores: no suena nada) y la portada hace scroll suave a la siguiente sección (sin scroll hijacking; contenido siempre visible).
  - *Movimiento:* `inv-enter` (portada), `inv-reveal` y `inv-decor` (aparición de flores con opacidad + escala 0,96→1), solo con `animation-timeline`; `prefers-reduced-motion` lo anula.
  - *Textura de papel:* `paperTexture: true` sin asset registrado → visualmente inactiva (no se fabrica ninguna textura).
- **Pendiente / no implementado a propósito:** persistencia (BD), validación Zod, `SectionBoundary` (necesita un límite de error cliente), música (solo el tipo `MusicSettings`: sin reproductor ni proveedores), guardado real del RSVP, editor, imágenes reales, textura de papel (sin asset registrado no produce efecto).

### 4.9 Estado de una plantilla del catálogo (D-20)

El catálogo (`Template`, `types/templates.ts`, hoy `lib/content/templates.ts`) es distinto del tema del motor (`InvitationTemplate`, §4.8). Cada entrada del catálogo declara `status`:

| `status` | Significa | Tema en el motor | Demo `/i/demo-*` | Detalle `/templates/[slug]` | "Usar esta plantilla" |
|---|---|---|---|---|---|
| `implemented` | Diseño aprobado; invitación completa renderizable (hoy **Magnolia** y **Level 12**, D-38) | Sí (terminado) | Sí, **enlazada** desde el detalle | Teléfono con todas las pantallas y miniaturas, funciones incluidas, "Ver invitación completa" | Habilitado |
| `concept` | Hay un tema **provisional** en el motor, pero la invitación completa **no** está diseñada (**Ivory**, **Étoile**) | Sí (provisional) | Existe temporalmente para probar que el mismo contenido funciona con otro tema; **no se enlaza** desde ninguna interfaz hasta aprobar el diseño | Teléfono **solo con la portada**, sin miniaturas de secciones ni lista de funciones, aviso "Vista conceptual"; no se asume ninguna sección ni dirección visual adicional | Habilitado (decisión provisional) |
| `comingSoon` | Solo existe la tarjeta de galería (**Tuscany, Noir, Blossom, Riviera, Dream, Safari**) | **No** | **No** | Miniatura/placeholder, nombre, categoría, estilo, descripción y "Próximamente"; sin invitación ni teléfono | **Deshabilitado** |

Reglas:

1. **Toda plantilla visible en `/templates` tiene página válida** en `/templates/[slug]`, con cualquier `status`; nunca 404 (`generateStaticParams` sale del catálogo).
2. Qué se muestra y permite lo decide **un solo lugar**, `getTemplateCapabilities()` (`lib/templates/status.ts`); los componentes no comparan el estado a mano.
3. **Coherencia catálogo ↔ motor** (comprobada por tests): `comingSoon` ⇒ sin `InvitationTemplate` ni demo; `implemented` ⇒ con ambos; todo tema del motor pertenece a una plantilla que no es `comingSoon`.
4. Subir de estado es una decisión de producto: `comingSoon → concept` al crear un tema provisional; `concept → implemented` al **aprobarse el diseño** de la invitación completa (mockup) y añadir la demo a la interfaz. Solo entonces `getTemplateCapabilities` enlaza su demo.
5. El motor (§4.8) y el modelo `Invitation` **no dependen** de `status`: es metadato del catálogo, no dato de la invitación.
6. **BD futura:** `status` es *madurez del diseño*, no *publicación*. No reutilizar `TemplateStatus` (`DRAFT`/`PUBLISHED`) de `DATABASE_SCHEMA`; se propone una columna aparte (p. ej. `Template.readiness`). Sin decidir hasta que exista Prisma.

### 4.10 Editor de invitación (D-21)

`/dashboard/events/[id]/edit` (hoy solo `demo`, mock en memoria) edita **datos**, nunca la plantilla:

```
initialInvitation (props, inmutable)
   └─▶ draft  ── useInvitationDraft (reductor puro `lib/editor/draft-reducer.ts`: ÚNICA API de edición)
          ├─▶ autosave  (createAutosaver: dirty → debounce 800 ms → «Guardando…» → «Guardado» | error)  ─▶ saveDraft()  ← sustituible por Server Action
          └─▶ postMessage ─▶ <iframe /preview/[id]> ─▶ PreviewSurface ─▶ InvitationRenderer  (el MISMO de /i/[slug])
```

- **Vista previa = iframe.** Se conserva D-07: un `<iframe>` del mismo origen da un viewport real (390 × 844 «Móvil», 1280 × 800 «Escritorio») y las media queries de la invitación se comportan como en ese dispositivo; se escala con `transform` para caber. Solo `components/editor/preview-surface.tsx` usa `InvitationRenderer` (lo comprueba un test): el editor **no** contiene otra implementación. El canal (`lib/editor/preview-channel.ts`) solo acepta mensajes del mismo origen y con la forma esperada.
- **Reductor.** Acciones con nombre (`updateInvitation`, `updateSection`, `toggleSection`, `moveSection`, `reorderSection`, listas `add/remove/move/reorder/patch`, `selectTemplate`). Un cambio de contenido **no puede** tocar `templateSlug`, `id`, `slug`, `contentVersion` ni `sections` (se descartan en tiempo de ejecución aunque se eluda el tipo). Sin cambios reales devuelve la misma referencia (no ensucia el autoguardado). `selectTemplate` solo acepta plantillas `implemented` (§4.9): Ivory y Étoile (`concept`) aparecen como «Próximamente».
- **Filas del rail.** Son las secciones de `Invitation.sections` más dos grupos de datos fijos que no se dibujan como sección: **Fecha** (`event.startsAt`, única fuente de la cuenta regresiva, portada y cierre) y **Música** (`MusicSettings`; solo configuración: sin reproductor, sin SDK, el enlace externo es solo un enlace). Ocultar = `InvitationSection.isVisible` (único mecanismo; lo lee el renderizador).
- **Orden.** Reordenar con asa (HTML drag-and-drop, sin librerías) **o** botones «Mover arriba/abajo» (siempre presentes y únicos en móvil). **Decisión de UX:** la portada va siempre primera y el cierre siempre último (técnicamente el renderizador admitiría otro orden, pero una invitación que no abre con su portada rompe «Abrir invitación»); se bloquea en el reductor, no solo en la interfaz.
- **Ampliaciones mínimas del modelo** (pedidas por el mockup 04): `InvitationSection.overlay` (velo de imagen; ajuste del usuario, la portada lo aplica), `RSVPSettings.ctaLabel` (texto del botón) y `StyleOverrides.fonts` (fuente de nombres y frase, **solo Cormorant Garamond e Inter**: Playfair y Montserrat siguen `pendiente` en `ASSET_LICENSES`). `InvitationSection.align` ya existía y la portada ahora lo respeta.
- **Imágenes.** Portada, galería y sedes guardadas se **suben y persisten** (D-27; JPG/PNG/WEBP ≤ 10 MB). Los campos aún sin guardar (ilustración del dress code, sedes nuevas del borrador) conservan la vista previa local (`blob:`, revocada al sustituir, quitar y salir) con el aviso «Solo vista previa».
- **Validación** sin Zod (`lib/editor/validation.ts`): requeridos, longitudes, URL http(s) (https para música), fecha y hora reales. Mientras haya errores el autoguardado no guarda y lo indica.
- **Responsive.** ≥ 1280: rail 352 · edición · vista previa 464 (tokens `--lu-editor-*`). 768–1279: rail + edición y vista previa en panel lateral bajo demanda. < 768: una columna (lista → sección) con «Vista previa» fija a pantalla completa (propuesta de RESPONSIVE §5, ahora implementada). Un fallo de un formulario queda aislado en `EditorErrorBoundary` sin perder el borrador.
- **Fuera de alcance / deuda:** persistencia real, autenticación, `SectionBoundary`, protección `beforeunload`, «Agregar sección», color de acento, texto libre de fecha, opciones de la cuenta regresiva (el modelo no las tiene), subida real de imágenes/audio.

## 5. Layouts y aislamiento visual (D-01, D-08)

- **Dos layouts raíz** (route groups `(site)` y `(invitation)`, cada uno con su `<html>`).
- `(site)` carga `tokens.css` (`--lu-*`), fuentes del producto y shadcn/ui re-tematizado.
- `(invitation)` carga solo `invitation-base.css` y las fuentes de la plantilla en uso. **No** carga estilos del producto → la invitación pesa menos y no se contamina.
- Tailwind es común, pero con dos familias de utilidades semánticas: `bg-lu-*`/`text-lu-*` (producto) y `bg-inv-*`/`text-inv-*` (invitación). Prohibido usar `lu-*` dentro de `invitation/` y viceversa.
- El preview del editor es un **iframe** hacia `/preview/[id]` (D-07): aísla CSS, fuentes y media queries reales de móvil, y respeta la regla 7. La comunicación editor → iframe es por `postMessage` con el `InvitationDocument` de borrador.

## 6. Datos y acceso (regla 13)

| Capa | Responsabilidad | Prohibido |
|---|---|---|
| `app/*` (páginas, actions, handlers) | Orquestar, leer sesión, llamar servicios, devolver UI | Lógica de negocio, Prisma |
| `services/*` | Reglas (autorización por owner, unicidad de slug, publicar, cambiar plantilla, contar RSVP), validación Zod | UI, consultas SQL directas |
| `repositories/*` | Consultas Prisma tipadas, mapeo a tipos de dominio | Reglas de negocio |
| `invitation/*` | Esquemas de bloque, temas, render | Acceso a datos |

- Server Actions y Route Handlers son **finos**: validan con Zod, llaman a un servicio, devuelven un resultado tipado (`Result<T, DomainError>`).
- Los repositorios devuelven **tipos de dominio**, no modelos Prisma crudos.

**Implementación (D-22).** Estructura real de la capa de datos:

| Carpeta | Contenido |
|---|---|
| `server/db/client.ts` | Cliente de Prisma único (singleton seguro con el recargado en caliente) |
| `server/repositories/*` | Consultas Prisma (únicos módulos, junto al seed, que usan el cliente): `templates`, `events`, `invitations` (incluye `createEventWithInvitation`, en una transacción), `dashboard`, `users` |
| `server/mappers/*` | Fila de BD ↔ dominio, puros y probados sin BD: `invitation`, `template`, `event`, `enums` y lectores defensivos de JSON |
| `server/services/*` | Reglas: métricas y actividad del dashboard (`dashboard.ts`), agregado de un evento (`event-aggregate.ts`) |
| `server/seed/demo-data.ts` | Datos de demostración (derivados del dominio) que usan el seed y el origen en memoria |
| `server/data-source.ts` | `DATABASE_URL` definida → PostgreSQL; sin ella → datos de demostración en memoria, solo lectura |
| `server/repositories/guests.ts` · `server/services/guest-{input,service}.ts` | Guest Manager (D-25): consultas de invitados siempre filtradas por propietario; validación pura (lista blanca de campos) y casos de uso (sesión → propiedad → validación → escritura) que llaman las Server Actions |
| `server/repositories/public-invitations.ts` · `guest-response.ts` · `server/services/public-{rsvp,context,rsvp-runtime}.ts` | RSVP público (D-26): resolución slug + token + evento, guardado transaccional, validación pura y contexto público seguro |
| `server/storage/*` · `server/repositories/media.ts` · `server/services/media-service.ts` · `media-capability.ts` | Archivos gestionados (D-27): proveedor S3 compatible, claves opacas, inspección de imagen, ownership y casos de uso |
| `server/services/event-creation.ts` · `server/repositories/event-creation.ts` · `lib/events/*` | Alta de eventos (D-28): validación, resolución de plantilla, slugs únicos, fábrica de contenido inicial y escritura transaccional |
| `server/services/draft-service.ts` · `publish-service.ts` · `publish-core.ts` · `server/repositories/draft.ts` · `publishing.ts` · `lib/publishing/*` · `lib/editor/draft-payload.ts` | Guardado real del borrador y publicación (D-29): payload con lista blanca, transacción con revisión optimista, snapshot publicado y estado de publicación |
| `server/auth/*` | Autenticación (D-24): `mode` (clerk/demo/unconfigured), `access` (rutas privadas), `session` (único acceso a Clerk), `current-user` (`getOrCreateCurrentUser`, `requireAuth`), `ownership` (`requireOwnedEvent`) |

Las páginas llaman a los repositorios (Server Components); los componentes reciben tipos de dominio por props y no conocen Prisma (un test lo comprueba).

## 7. Estrategia de render y caché

| Superficie | Render | Caché |
|---|---|---|
| Marketing / galería / detalle | Estático o ISR | Revalidación por etiqueta al publicar plantilla |
| Invitación pública `/i/[slug]` | Server Component desde **snapshot publicado** | ISR + `revalidateTag('inv:<slug>')` al publicar |
| RSVP (POST) | Route Handler | Sin caché; rate limit (diferido) |
| Dashboard / editor | Dinámico, autenticado | Sin caché compartida |

Invitación pública: `noindex`, Open Graph por invitación (imagen 1200×630 generada con `opengraph-image`) porque el canal principal de difusión es WhatsApp.

## 8. Editor

- **Estado**: `useReducer` + contexto en cliente (sin librería nueva). Acciones: `updateContent`, `updateSettings`, `reorder`, `toggleVisibility`, `addSection`, `removeSection`.
- **Autoguardado**: debounce → Server Action `saveSection`. Indicador "Guardado / Guardando… / Error" (mockup 04).
- **Concurrencia**: cada sección lleva `revision`; el guardado envía la revisión esperada; conflicto → aviso, no sobreescritura silenciosa (multi-pestaña).
- **Reordenar**: lista con arrastre (`dnd-kit` propuesto, requiere aprobación) y alternativa por teclado. Reorden = una sola transacción.
- **Eliminar sección** (distinto de ocultar): confirmación explícita; soft-delete recuperable **[INFERIDO]**.
- **Formularios por bloque**: cada bloque aporta su `Editor`, construido con primitivas `components/editor` (FieldGroup, CharCounter "11 / 50", ImageDrop, AlignmentPicker, SwatchPicker, Switch…), todas ya visibles en el mockup 04.
- **Imágenes**: hoy detrás de la interfaz `MediaStorage` (sección 10); sin storage real se usa un adaptador local de desarrollo.

## 9. Publicación (D-06)

- `Invitation.publishedSnapshot` (JSON): `InvitationDocument` con imágenes ya resueltas a URL, secciones visibles, plantilla y estilo aplicados.
- `publish()` reconstruye el snapshot y revalida caché. `unpublish()` lo anula.
- Editar **no** altera lo publicado hasta volver a publicar (mockup 04: "Publicar" es acción explícita; "Vista previa" muestra el borrador).
- Beneficios: URL pública rápida y cacheable, sin joins; ediciones a medias no se filtran; plantilla y contenido quedan congelados juntos.
- Coste: 1 JSON adicional por invitación y una migración de snapshots si cambia el esquema de bloque (mitigado con `contentVersion` + `migrate`).

## 10. Puntos de extensión para integraciones diferidas

Solo **interfaces y tablas**, sin dependencias instaladas:

| Integración | Interfaz | Efecto en el modelo |
|---|---|---|
| Auth | `AuthSession { userId }` leída por servicios; `User` mínimo en BD | El proveedor elegido añadirá sus tablas |
| Storage de imágenes | `MediaStorage { createUploadTarget, getPublicUrl, delete }` | `MediaAsset` guarda `storageKey`, dimensiones, `blurDataUrl` |
| Música | `MusicSourceResolver` (ver §10.1). **Sin implementaciones** todavía | `MediaAsset` (audio + confirmación de derechos), `MusicTrack` (biblioteca licenciada) |
| Email | `Mailer { send(template, to, data) }` | `Guest.email`, `ActivityLog` |
| Pagos (Stripe / Mercado Pago) | `BillingProvider` | Futuro `Plan`/`Subscription`; compuerta en `publish()` |
| Analytics | `Analytics { track(event) }` | `ActivityLog` cubre solo eventos de producto (RSVP, primera vista de invitado) |

Los servicios dependen de estas interfaces; nunca de un proveedor concreto.

### 10.1 Arquitectura de música (política decidida; solo arquitectura)

**Reglas de la política**
- Prohibido: Spotify Web Playback SDK, streaming de Spotify dentro de Hilo Luna, reproductores ocultos de YouTube como audio de fondo.
- Reproducción de fondo **solo** con audio de la **biblioteca licenciada de Hilo Luna** o **audio subido** por el usuario con derechos confirmados.
- Los enlaces externos (Spotify, YouTube, otra URL) son **solo enlaces**.
- La reproducción **solo** empieza tras una interacción del usuario ("Abrir invitación").
- **No se implementa ningún proveedor** ahora: se define el esquema, las interfaces y las reglas.

**Configuración (contenido del bloque `MUSIC`)**

```ts
type MusicSourceType = "library" | "upload" | "external";

interface MusicSettings {
  sourceType: MusicSourceType;
  trackUrl?: string;          // RESUELTO por el servidor (library/upload); nunca lo escribe el usuario
  externalUrl?: string;       // solo sourceType = "external"; https obligatorio
  title: string;
  artist?: string;
  autoplayAfterInteraction: boolean;   // forzado a false si sourceType = "external"
  volume: number;             // 0..1
  loop: boolean;
  // Referencias internas necesarias para resolver trackUrl (añadidas a los campos de la política):
  libraryTrackId?: string;    // sourceType = "library"
  uploadAssetId?: string;     // sourceType = "upload"
}
```

Validación (Zod `refine`): `library` ⇒ `libraryTrackId` obligatorio y pista activa · `upload` ⇒ `uploadAssetId` obligatorio, `MediaAsset.kind = AUDIO` y `rightsConfirmedAt` no nulo · `external` ⇒ `externalUrl` https obligatorio, sin `trackUrl`, sin autoplay.

**Resolución (interfaz, sin implementación)**

```ts
type ResolvedMusic =
  | { kind: "audio"; url: string; title: string; artist?: string; durationSec?: number }  // library | upload
  | { kind: "link";  url: string; host: string };                                          // external

interface MusicSourceResolver {
  resolve(settings: MusicSettings): Promise<ResolvedMusic | null>;
}
// Implementaciones futuras: LibraryResolver, UploadResolver, ExternalLinkResolver. NO se crean ahora.
```

El snapshot publicado (D-06) guarda el `ResolvedMusic` ya resuelto.

**Render y reproducción (cliente)**
- Un único `MusicController` (contexto React con **un** `<audio>`) en el layout de la invitación. Sin `<iframe>`, sin SDK de terceros.
- "Abrir invitación" llama a `musicController.startFromGesture()` **de forma síncrona dentro del manejador del clic** (Safari/iOS exige que `play()` ocurra dentro del gesto). Sin gesto no hay sonido; la carga de la página nunca reproduce.
- Si `autoplayAfterInteraction` es `false`, se muestra solo el control flotante y el usuario decide.
- Control flotante play/pausa (sin mockup, Q-13); respeta `volume` y `loop`; se pausa si la pestaña queda oculta.
- `external` se muestra como **enlace** ("Escuchar en {host}", `target="_blank" rel="noopener noreferrer"`), sin incrustar nada.
- En el iframe de preview del editor el audio **no** se inicia automáticamente.

**Datos y derechos**
- `MediaAsset` (`kind = AUDIO`) guarda `rightsConfirmedAt` + versión del texto aceptado; el usuario debe marcar la confirmación de derechos **antes** de subir. Retirada por reclamación: `MediaAsset.disabledAt` (el snapshot deja de servir la pista).
- `MusicTrack` guarda la biblioteca de Hilo Luna con su licencia (proveedor, tipo, vigencia). Si una licencia vence, la pista pasa a `RETIRED` y las invitaciones publicadas deben revalidarse (riesgo R-8).
- Cada pista de biblioteca y cada archivo propio se registra en `docs/ASSET_LICENSES.md` §6.
- Límites de subida propuestos [E]: audio ≤ 10 MB y ≤ 10 min; MIME `audio/mpeg`, `audio/mp4`, `audio/ogg`. Storage y procesado dependen de la integración diferida.

**Pendiente:** N-01 (proveedor de la biblioteca), N-02 (términos legales de subida).

## 11. Calidad y tooling (propuesta)

- `tsconfig` (**aplicado**): `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `allowJs: false`, alias `@/*` → `./*`.
- ESLint (config de Next) + regla de límites de importación de §3. Prettier con plugin de Tailwind.
- Scripts: `lint` (`eslint .`), `typecheck` (`next typegen && tsc --noEmit`), `build` **(existen)**; `db:migrate`, `db:seed` (previstos).
- Testing: **Vitest instalado** (D-18) para invariantes, lógica pura y renderizado a HTML (`npm test`, carpeta `tests/`). Playwright (flujos y regresión visual contra mockups) sigue **pendiente de aprobación**.
- **Instaladas con shadcn/ui en el scaffold** (licencias verificadas en `docs/ASSET_LICENSES.md` §4): `radix-ui`, `class-variance-authority`, `cn` (paquete mantenido por shadcn que reemplaza a `clsx` + `tailwind-merge`), `lucide-react`, `tw-animate-css`, `shadcn`. **Propuestas, aún no instaladas** (se aprueban al necesitarlas): `zod`, `dnd-kit`. Librería de animación: **no** hasta ADR (ver `design/ANIMATIONS.md`).
- Versiones instaladas en el scaffold: Next.js 16.3.6 (Turbopack), React 19.2.8, Tailwind CSS 4.3.3, TypeScript 5.9.3, ESLint 9.39.5. Prisma: pendiente. Next 16 difiere de versiones previas: consultar `node_modules/next/dist/docs/` antes de usar una API.

## 12. Registro de decisiones

Formato: **ID · Estado · Contexto → Decisión → Alternativas → Consecuencias**. Toda modificación arquitectónica futura añade una entrada aquí *antes* de implementarse (regla 20).

### D-01 · Propuesta · Dos layouts raíz
Contexto: la invitación pública debe tener lenguaje visual propio (regla 7) y pesar poco. → **Route groups `(site)` y `(invitation)` con `<html>` propio.** Alternativa: un solo layout con CSS scoping. Consecuencia: navegar entre grupos es carga completa (aceptable: invitación ↔ producto casi no se cruzan).

### D-02 · Propuesta · Secciones como filas + JSON validado
→ Tabla `InvitationSection` (tipo, posición, visibilidad, `content` JSONB, `settings` JSONB, `contentVersion`, `revision`) con esquemas Zod por tipo. Alternativas: (a) un único JSON por invitación (peor para autoguardado granular y concurrencia); (b) una tabla por tipo de bloque (migración por cada bloque nuevo, tipos rígidos). Consecuencia: la integridad del JSON depende de Zod en frontera y `migrate`.

### D-03 · Propuesta · Plantilla = código + metadatos en BD
→ Tema, variantes y decoraciones en `invitation/templates/<slug>`; en BD solo catálogo (nombre, categoría, estilos, estado, imágenes de tarjeta). Alternativa: temas en BD (útil para un futuro constructor de plantillas, fuera de alcance). Consecuencia: publicar una plantilla requiere deploy; a cambio, revisión de código, tipado y sin drift.

### D-04 · Propuesta · `Event` e `Invitation` separados; fecha canónica en `Event`
→ `Invitation.eventId` único (1:1 hoy, no bloquea 1:N). Consecuencia: el editor de "Fecha" escribe en `Event`.

### D-05 · Propuesta · Estilo por capas y overrides por plantilla
→ Cascada §4.4; `styleOverrides` con clave por `templateSlug`. Consecuencia: cambiar de plantilla no pierde personalización (regla 17) y no arrastra un acento que desentona.

### D-06 · Propuesta · Snapshot publicado
→ §9. Alternativa: servir el borrador directamente (más simple; filtra ediciones a medias, sin control de versión).

### D-07 · Propuesta · Preview en iframe
→ §5. Alternativa: render inline con container queries (más simple, pero exige que **todo** el CSS de la invitación sea consciente del contenedor y no aísla estilos).

### D-08 · Propuesta · Dos familias de tokens (`--lu-*` / `--inv-*`)
→ Producto e invitación con vocabularios separados, ver `design/DESIGN_SYSTEM.md`.

### D-09 · Propuesta · Capas services/repositories
→ §6. Sin ORM fuera de `repositories`.

### D-10 · **Aprobada (propietario)** · URL pública `/i/[slug]`
→ Invitaciones bajo el prefijo `/i/`. Elimina la colisión con rutas raíz y la necesidad de `reservedSlugs`. Desviación consciente del mockup 05 (`/andrea-fernando`). El preview del editor vive en `/preview/[id]` (fuera de `/i/`; las carpetas `_x` no son enrutables en Next).

### D-11 · Propuesta · Medios por referencia
→ El contenido guarda `assetId`, no URLs; el snapshot resuelve URLs. Permite cambiar de proveedor de storage y aplicar transformaciones sin migrar contenido.

### D-12 · Propuesta · RSVP en `Guest` + `ActivityLog`
→ La respuesta vive en `Guest` (estado, nº de asistentes, mensaje); los cambios se registran en `ActivityLog`, que también alimenta "Actividad reciente". Un RSVP desde enlace genérico crea un `Guest`. Alternativa: tabla `Rsvp` separada (más historial, más joins).

### D-13 · Propuesta · Cero dependencias nuevas sin ADR
→ Incluye animación, formularios, drag & drop, testing. Lista de apoyo propuesta en §11.

### D-14 · **Aprobada (propietario) en política; arquitectura propuesta** · Música
→ §10.1. Tres fuentes (`library`, `upload`, `external`), reproducción solo por biblioteca/subida tras interacción, enlace externo solo como enlace. Sin proveedores implementados. Alternativa descartada por política: SDK de Spotify / reproductor oculto de YouTube.

### D-15 · **Aprobada (propietario)** · Tipografía y assets
→ Solo fuentes open-source con uso comercial (Cormorant Garamond + Inter), auto-alojadas con `next/font`; registro obligatorio de licencias y procedencia en `docs/ASSET_LICENSES.md` para toda fuente, imagen, audio o ícono. Consecuencia: cualquier fuente que ofrezca el editor o use una plantilla debe cumplir la política y registrarse antes.

### D-16 · **Aprobada (propietario, tarea de scaffold)** · Estructura sin `src/` y rutas en inglés
→ Directorios en la raíz (`app/`, `components/`, `lib/`, `types/`, `prisma/`), rutas públicas y de dashboard en inglés (`/templates`, `/dashboard/events/[id]/edit`…), invitaciones en `/i/[slug]`. Alternativa previa: `src/` y rutas en español. Consecuencias: alias `@/*` → `./*`; el dominio `invitation/` y `server/` se ubicarán en la raíz al implementarse (Q-23); URLs de marketing en inglés para audiencia hispanohablante (coste SEO menor, aceptado).

### D-18 · **Aprobada (propietario, tarea del motor)** · Vitest
→ Se instala `vitest` (devDependency) y `@types/node` sube de `^20` a `^24` (peer requerido por Vitest; coincide con Node 24 de desarrollo). Entorno `node`, sin jsdom: los componentes se prueban con `react-dom/server`. Scripts `test` y `test:watch`. Alternativa descartada: `node:test` (sin alias `@/*` ni JSX sin configuración extra). Sigue sin aprobarse Playwright.

### D-19 · **Aprobada (propietario, tarea del motor)** · Motor de invitaciones: DATA / TEMPLATE / SECTIONS / RENDERER
→ Implementado en `types/invitation.ts` (DATA), `types/invitation-template.ts` (TEMPLATE), `components/invitation/sections/*` (SECTIONS) y `components/invitation/invitation-renderer.tsx` (RENDERER). Detalle en §4.8. Diferencia respecto a D-02: el DTO que consume el renderizador guarda el contenido **tipado por sección en `Invitation`** (`names`, `event`, `story`, `locations`, `timeline`, `gallery`, `dressCode`, `giftRegistry`, `music`, `rsvp`…) y `Invitation.sections` solo lleva orden, visibilidad y encabezados; el mapeo a filas `InvitationSection` + JSON (D-02) sigue siendo la forma de persistirlo. Sin base de datos ni Zod todavía.

### D-20 · **Aprobada (propietario)** · Estado de plantilla (`implemented` / `concept` / `comingSoon`)
→ El catálogo declara la madurez de cada plantilla y la interfaz se adapta (detalle, CTA, demos) según §4.9. Motivo: la galería [02] muestra nueve plantillas y solo Magnolia tiene invitación diseñada; hay que ser honestos con el usuario sin dar 404 ni prometer diseño inexistente. Alternativa descartada: ocultar del catálogo las plantillas sin diseño (rompe el mockup y los enlaces de la home). Consecuencia: las demos de `concept` no se enlazan hasta aprobar su diseño.

### D-21 · **Aprobada (propietario, tarea del editor)** · Editor sobre borrador + vista previa en iframe
→ Ver §4.10. El editor modifica un `draft` (copia) con un reductor central, autoguarda (real con base de datos desde D-29; simulado sin ella) y previsualiza con el mismo `InvitationRenderer` dentro de un iframe (`/preview/[id]`) alimentado por `postMessage`. Portada y cierre quedan fijas (primera y última). Alternativa descartada: renderizar `InvitationRenderer` directamente en la página del editor (no da viewport real: las media queries verían 1440 px, y mezclaría los estilos `--lu-*` y `--inv-*`).

### D-22 · **Aprobada (propietario, tarea de persistencia)** · Prisma + PostgreSQL con contenido en tablas
→ Se instalan `prisma` y `@prisma/client` **6.x** (motor clásico: no exige adaptadores de driver ni dependencias adicionales y admite `url = env("DATABASE_URL")` como en la propuesta; Prisma 7 requeriría `@prisma/adapter-pg`). Esquema y migración inicial en `prisma/` (detalle y diferencias en `docs/DATABASE_SCHEMA.md` §3 y §10). Decisiones: (1) el contenido con identidad y orden (sedes, itinerario, galería, regalos, música) se guarda en **tablas** colgadas de `Event`, y `InvitationSection` conserva orden, visibilidad, encabezados y el contenido de los bloques de un solo elemento — desarrolla D-19 y sustituye la parte de D-02 sobre JSON por tipo de bloque para esas listas; (2) `Template.designStatus` y `Template.publicationStatus` son enums distintos (D-20); (3) los repositorios devuelven tipos de dominio mediante mappers puros (regla 13); (4) las escrituras multi-tabla usan `prisma.$transaction`; (5) sin `DATABASE_URL` los repositorios sirven los datos de demostración en memoria (solo lectura) para poder compilar y desarrollar sin base de datos — **deuda**: retirarlo cuando el entorno siempre tenga una; (6) `/dashboard/events/demo` es un alias del evento sembrado y redirige a `/dashboard/events/<id>`. **Lectura real, escritura todavía simulada**: el editor carga de la BD pero su autoguardado no persiste, y el RSVP público sigue en demo. Alternativas descartadas: JSON por sección para todo (sin integridad referencial ni orden en BD) y una tabla por tipo de bloque. Consecuencias: el dashboard del evento demo muestra métricas derivadas de sus invitados sembrados; Zod sigue pendiente (lectores defensivos).

### D-23 · **Aprobada (propietario, tarea de marca)** · Marca Hilo Luna y dominio hiloluna.com
→ El producto pasa de "Lunaria" (nombre provisional) a **Hilo Luna**, con dominio oficial **hiloluna.com** (URL canónica futura `https://hiloluna.com`). Sin cambios funcionales, visuales ni de base de datos. Decisiones: (1) la marca vive solo en `siteConfig` (`name`, `shortName`, `domain`, `url`, `supportEmail`); (2) las URLs se construyen con `getSiteUrl()` (`NEXT_PUBLIC_SITE_URL`; en producción sin variable, `siteConfig.url`; en desarrollo, `http://localhost:3000`) y `getPublicInvitationUrl(slug)` (`<base>/i/<slug>`); el modal de compartir y `metadataBase` la usan; (3) **no se renombran** `--lu-*` (namespace técnico histórico de los tokens del producto) ni `--inv-*`, ni los tipos del dominio (`Invitation`, `EventDashboardData`…), ni tablas, ids o slugs; (4) la invitación pública no muestra la marca del producto (ni en su título); (5) el usuario demo pasa a `demo@hiloluna.local`: el seed hace `upsert` por `id`, de modo que una base ya sembrada actualiza el email en su sitio y no queda un segundo usuario; (6) la migración `init_lunaria` conserva su nombre (una migración aplicada no se renombra). Alternativa descartada: renombrar los tokens `--lu-*` (cientos de cambios de CSS sin valor de producto).

### D-24 · **Aprobada (propietario, tarea de autenticación)** · Clerk (identidad) + `User` en PostgreSQL (perfil y propiedad)
→ Se instala `@clerk/nextjs` (v7, Core 3: `proxy.ts`, `<Show>`; sin `SignedIn`/`SignedOut`). **Clerk** gestiona identidad, credenciales, sesiones, recuperación y —después— proveedores sociales; **PostgreSQL/Prisma** gestiona el perfil (`User`, con `clerkUserId` único), la propiedad y los datos de negocio. No se guardan contraseñas ni tokens. Decisiones: (1) `proxy.ts` protege `/dashboard/**` y `/preview/**` (sin sesión → `/sign-in` con retorno); es solo la primera barrera: **cada página comprueba sesión y propiedad** (`requireAuth`, `requireOwnedEvent`, `getOwned*`; regla 21 de CLAUDE.md); (2) Clerk solo se toca en `server/auth/session.ts` y `proxy.ts`; el resto usa `getOrCreateCurrentUser()`; (3) `getOrCreateCurrentUser` → `syncUser` (`server/services/user-sync.ts`, pura y probada): por `clerkUserId`, vinculación por email verificado, alta nueva, y robustez ante carreras con las restricciones únicas; (4) las páginas públicas siguen **estáticas**: la navbar resuelve la sesión en el cliente (`AuthStateBoundary`, sin parpadeo «Entrar» → «Mi panel») y `ClerkProvider` solo envuelve el layout del producto (nunca `/i/[slug]`); (5) modo de autenticación decidido en servidor (`server/auth/mode.ts`): `clerk` con claves; `demo` sin claves **solo en development** (panel con el usuario demo); `unconfigured` en otro caso; el alias `demo` de las rutas no existe en producción; (6) sin claves no se invoca `clerkMiddleware` (evita el modo *keyless* de Clerk, que crearía una aplicación temporal); (7) URLs de retorno relativas y `NEXT_PUBLIC_SITE_URL`; nada de dominios fijos. Alternativas descartadas: Auth.js/NextAuth/Supabase/Firebase/Better Auth (un solo proveedor); consultar el usuario de Clerk en cada petición (solo se pide el perfil la primera vez). **Fases futuras:** webhooks `user.updated`/`user.deleted` (sincronizar email, nombre, baja), borrado de cuenta, proveedores sociales (se activan en el panel de Clerk), creación de eventos. Consecuencia: el evento demo solo lo ve su propietario (el usuario demo del seed); una persona real empieza sin eventos.

### D-25 · **Aprobada (propietario, tarea del Guest Manager)** · Invitados: Server Actions con propiedad, validación propia y `inviteToken` opaco
→ `/dashboard/events/[id]/guests` gestiona invitados reales (alta, edición, baja, búsqueda, filtros, grupos, acompañantes). Decisiones: (1) **Server Actions** (`createGuest`, `updateGuest`, `deleteGuest`) finas: leen solo una lista blanca de campos del formulario y delegan en el servicio, que ejecuta siempre *sesión → usuario → evento del usuario (`resolveOwnedEvent`, la misma estrategia de propiedad que las páginas) → validación → escritura → resultado seguro*; nunca aceptan un propietario del cliente y el `eventId` del formulario es solo una referencia que se comprueba; (2) las escrituras llevan el filtro de propiedad en la propia consulta (`updateMany`/`deleteMany` con `event.ownerId`) y los grupos deben pertenecer al mismo evento; (3) **validación propia sin Zod** (siete campos; si crece se propondrá Zod antes de instalarlo); (4) los filtros viven en la URL (`?q=&status=&group=`) y se aplican en el servidor (`filterGuests`, listo para filtrar en BD); el resumen se deriva de todos los invitados; (5) `Guest.inviteToken`, identificador público opaco (ver DATABASE_SCHEMA §12) y `getGuestInvitationUrl()` (`<base>/i/<slug>?guest=<token>`); (6) sin `DATABASE_URL` las lecturas funcionan con el origen de demostración y las escrituras se rechazan con un mensaje claro. **Fuera de alcance:** importación CSV/Excel, email/WhatsApp/SMS/QR, RSVP público persistente, acompañantes como filas, acciones en lote. Alternativas descartadas: API Routes con `fetch` (más superficie que asegurar), Zod ahora, y regenerar tokens desde la interfaz.

### D-26 · **Aprobada (propietario, tarea del RSVP público)** · Invitación personalizada y RSVP persistente sin cuenta
→ `/i/<slug>?guest=<token>` reconoce al invitado, personaliza el saludo y guarda su RSVP. Decisiones: (1) **coincidencia**: `Invitation.slug` + `Guest.inviteToken` + `Guest.eventId === Invitation.eventId`, resuelta en UNA consulta (`getPublicInvitationRecord`); un token mal formado, desconocido o de otro evento es «inválido» y **indistinguible** (nunca se revela que existe en otro evento); la invitación general se sigue viendo; (2) **contexto público** (`PublicGuestContext`): solo nombre, grupo, `maxCompanions` y respuesta vigente (+ preguntas); nunca `Guest.id`, `eventId`, `groupId`, email, teléfono ni marcas internas; el `token` viaja porque la acción debe recibirlo (es el de la propia URL); (3) **Server Action pública** `submitPublicRsvp` (mecanismo de Next, sin endpoint aparte ni Clerk): lista blanca de campos, validación y autoridad en el servidor (máximo de asistentes, plazo, preguntas del evento), transacción con `upsert` por `guestId` (restricción única: sin duplicados aunque haya envíos simultáneos) y escritor único de estado (`writeGuestResponse`); (4) **saludo** en `lib/invitation/greeting.ts` («y familia» solo si el NOMBRE del grupo contiene «familia»; no por tener acompañantes); (5) **caché**: la página es siempre dinámica (`force-dynamic` + `searchParams`): la versión personalizada nunca se cachea ni se sirve a otra persona; la general también es dinámica hoy (deuda menor); (6) **privacidad**: `noindex, nofollow`, `referrer: no-referrer` (el token va en la URL), ningún dato del invitado en título/Open Graph, sin sitemap, y sin registrar tokens, mensajes, respuestas, emails ni teléfonos; (7) **UI** con tokens `--inv-*`, formulario en línea de ancho completo, controles de 48 px, foco al mensaje de confirmación y `aria-live` en el envío. **Deuda antes de producción:** limitación de tasa (rate limiting) y anti-abuso — hoy solo hay validación estricta, límites de tamaño y lista blanca de campos; un limitador en memoria no sería una defensa real. Fuera de alcance: correo/WhatsApp/SMS/QR, RSVP masivo, lista de espera, plano de mesas. Alternativas descartadas: Route Handler propio (más superficie de CSRF), confiar en el token sin comprobar el evento, y devolver el `Guest` completo al navegador.

### D-27 · **Aprobada (propietario, tarea de imágenes persistentes)** · Almacenamiento S3 compatible + `MediaAsset`
→ Sustituye las imágenes `blob:` del editor por archivos persistentes. Decisiones: (1) **`StorageProvider`** (`server/storage/provider.ts`: `createUploadTarget`, `head`, `readStart`, `delete`) con una implementación S3 compatible (Cloudflare R2 en producción) vía el **SDK oficial de AWS** (`@aws-sdk/client-s3` + `s3-request-presigner`, únicas dependencias nuevas); sin Cloudinary, UploadThing, Firebase ni Supabase Storage. Los componentes React no conocen bucket, claves, endpoint ni SDK (el navegador solo recibe ids, URLs públicas de lectura y una URL temporal de subida); (2) **subida directa con URL firmada (PUT)**: `createImageUpload` valida tipo/tamaño declarados, crea el `MediaAsset` `PENDING` con clave opaca y emite la URL; el navegador sube con XHR (progreso real, sin porcentajes inventados); `finalizeImageUpload` **no confía en el cliente**: mide el objeto (HEAD), lee sus primeros 256 KB, detecta el tipo por firma (JPEG/PNG/WEBP; SVG y GIF bloqueados), lee dimensiones (con orientación EXIF; máx. 40 MP) y solo entonces marca `READY`; si es inválido borra el objeto y retira el registro; es idempotente (reintentar no crea otro `READY`); (3) **límite 10 MB** (cliente: respuesta rápida; servidor: autoridad, mensaje «La imagen supera el tamaño máximo permitido.»); (4) **propiedad** en cada consulta (`ownerId` + `eventId`), nunca datos del cliente; una URL externa no puede convertirse en archivo gestionado (solo se aceptan ids de `MediaAsset` propios y `READY`); (5) **casos de uso** en `server/services/media-service.ts` (`createImageUpload`, `finalizeImageUpload`, `deleteMediaAsset`, `attachCoverImage`, `attachLocationImage`, `addGalleryImage`, más quitar y ajustes), inyectables y probados con `FakeStorageProvider`/repositorio en memoria; las Server Actions (`.../edit/actions.ts`) son finas y revalidan `/i/[slug]` (no la página del editor); (6) **el editor** (`components/editor/use-media-controller.ts`) orquesta validar → permiso → PUT → verificar → asociar → actualizar el borrador, en cola y con estado por objetivo (Subiendo… / Procesando… / Guardado / error); el autoguardado persiste de verdad solo el **texto alternativo y el orden** (`lib/editor/media-details.ts`, nunca serializa `File` ni URL); (7) **borrado**: al quitar o reemplazar una imagen se retira la referencia y, solo si nada más la usa, se borra el objeto y el registro pasa a `DELETED`; si el bucket falla queda un huérfano registrado; (8) **sin almacenamiento configurado** (o sin BD) la carga se desactiva con un mensaje claro; nunca se escribe en `/public` ni se finge guardar, y la invitación de demostración (assets estáticos) funciona igual; (9) **`next.config`**: `remotePatterns` solo con el host de `S3_PUBLIC_BASE_URL` y la ruta `/users/**` (nunca `*`); `dangerouslyAllowLocalIP` solo en desarrollo con host local; (10) **invitación pública** sin Clerk: las URL se derivan de la clave y **no** lleva `mediaAssetId`, propietario ni clave; el editor del propietario sí recibe los ids. Deudas y límites: `docs/DATABASE_SCHEMA.md` §14.2 (huérfanos, borrado de objetos al borrar un evento, EXIF/GPS, cuotas y rate limiting). Fuera de alcance: audio, pagos, moderación, galerías de otras secciones, imágenes de dress code/regalos. Alternativas descartadas: subir el binario por la Server Action (límite de cuerpo y memoria), guardar URLs en la BD, escribir en `/public`, POST policy (R2 no la admite).

### D-28 · **Aprobada (propietario, tarea de creación de eventos)** · Alta transaccional de eventos con onboarding corto
→ Un usuario autenticado crea su primer evento real desde `/dashboard/events/new` (`?template=<slug>`). Decisiones: (1) **asistente de 3 pasos en el cliente** (Tipo + plantilla → Detalles → Resumen) sin escribir nada hasta el envío final: volver o cancelar no deja registros; el botón pasa a «Creando…» y se desactiva durante la petición; (2) **Server Action fina** (`createEventAction`): sesión → usuario de la BD → servicio → `redirect` al editor del evento REAL; solo lee una lista blanca de campos (`templateSlug, eventType, name1, name2, date, time, timezone`): el propietario sale SIEMPRE de la sesión; (3) **servicio** (`createEventForUser`, dependencias inyectables): valida (validadores propios, sin Zod: los del editor bastan; se reevalúa cuando se apruebe la dependencia) → resuelve la plantilla desde la BD (publicada, `implemented`, compatible con el tipo) → elige slugs únicos de evento e invitación por separado → construye el contenido con `createDefaultInvitationData` → escribe TODO en UNA transacción (`prisma.$transaction`, `writeEventAggregate`, compartida con el seed) con reintento si otra petición gana un slug; (4) **borrador**: `Event` e `Invitation` nacen en `DRAFT` y `/i/[slug]` no las sirve hasta publicar (la publicación real queda fuera de alcance); (5) **tipos de evento**: `EventType` gana `GRADUATION` y `OTHER` (migración aditiva); helper central `lib/events/event-types.ts`; (6) **compatibilidad**: una plantilla solo sirve para SU tipo (Magnolia = boda) y solo con diseño aprobado; `concept` y `comingSoon` ya no son utilizables (el CTA del detalle se desactiva; `?template=ivory` muestra «Estará disponible próximamente» sin crear nada; un slug desconocido muestra el selector, nunca un 500); (7) **renderizador**: `InvitationRenderer` gana `mode: "public" | "editor"`; en la invitación pública una sección sin contenido suficiente NO se dibuja (sin placeholders para el invitado) y en la vista previa del editor muestra un aviso discreto; (8) **panel**: sin eventos, la barra lateral solo ofrece «Mis eventos» y «Plantillas» (nunca enlaces muertos al alias `demo`) y con eventos apunta al primero del usuario. Fuera de alcance: publicación real, pagos, planes, correo/WhatsApp/QR, audio, duplicar o borrar eventos. Alternativas descartadas: crear el evento paso a paso (registros a medias), una página por tipo de evento, y confiar en el `?template=` sin validarlo en el servidor.

### D-29 · **Aprobada (propietario, tarea de persistencia del editor y publicación)** · Borrador en las tablas del evento + snapshot publicado
→ Cierra el ciclo crear → editar → guardar → previsualizar → publicar → seguir editando → republicar. Decisiones: (1) **draft ≠ published**: las tablas del evento son el borrador (lo único que escribe el editor) y `/i/[slug]` lee **solo** el snapshot vigente (`InvitationPublication`); el borrador nunca se expone; (2) **autosave real** con debounce de 800 ms (no por pulsación): el cliente arma un DTO explícito (`invitationToDraftPayload`), la Server Action `saveDraftAction` delega en `saveInvitationDraft` (sesión → evento propio → lista blanca `parseDraftPayload` → `applyDraftPayload` sobre el borrador actual → `validateInvitation`, la misma validación del editor → transacción); el payload nunca lleva propietario, ids de archivos, URL ni estado de publicación; (3) **concurrencia optimista** con `draftRevision`: compare-and-set en la transacción; un guardado desactualizado se rechaza (conflicto), nunca pisa; guardado, imágenes y publicación se serializan en una `SyncQueue` en el cliente; (4) **estados separados**: *dirty* (cambios locales sin guardar; «Guardado» significa que están a salvo en el borrador) ≠ *unpublished* («Cambios sin publicar» = `draftRevision > publishedRevision`, derivado); el indicador muestra «Guardado · Borrador / Publicado / Cambios sin publicar»; sin base de datos se mantiene el guardado simulado con «Modo demostración»; (5) **publicar** (`publishInvitationForOwner` → `publishOwnedEvent`): solo el propietario; primero guarda lo pendiente y espera la confirmación (`flush` real: espera el guardado en curso y lo que llegó después); valida el mínimo (nombre, fecha, plantilla); construye el snapshot con una función pura (`buildPublishedInvitationSnapshot`), lo escribe en una transacción con compare-and-set de la versión (doble petición = una versión) y revalida `/i/[slug]`; un fallo deja el borrador y el estado intactos; (6) **snapshot autocontenido** con la plantilla (slug + versión estable + configuración de tema completa), archivos por clave y **sin** datos privados; el **RSVP vivo** (invitados, respuestas) se lee de la BD por petición y solo la configuración publicada del RSVP sale del snapshot; (7) **retención de archivos**: un `MediaAsset` que la publicación vigente referencia no se borra físicamente; al publicar una versión que ya no lo usa se libera; (8) **sedes nuevas** existen de verdad en la BD desde el primer guardado (se guarda antes de subirles imagen); (9) **preview privada** = `/preview/[id]` (sesión + propiedad, borrador actual, dinámica y sin caché compartida); (10) **compatibilidad**: la demostración se siembra publicada con su snapshot; una invitación publicada antes de D-29 (sin snapshot) se lee del borrador hasta republicar. Fuera de alcance: rollback (UI), programar publicación, despublicar, dominios propios, pagos. Alternativas descartadas: publicar leyendo el borrador con un flag (expone ediciones a medias), un campo JSON único para todo el evento, y last-write-wins sin revisión.

### D-30 · **Aprobada (propietario, tarea de compartir avanzado, QR y calendario)** · Compartir solo lo publicado, QR local y `.ics` propio
→ Decisiones: (1) **Un solo modal** `ShareInvitationDialog` (`components/share`) para dashboard, editor y lista de eventos; el QR de un invitado usa `GuestQrDialog` con el mismo `QrCodePanel`. (2) **Regla de datos publicados**: solo se comparte lo PUBLICADO. En borrador no hay URL, QR ni calendario («Publica tu invitación para poder compartirla.»); con «Cambios sin publicar» se comparte la última versión publicada (la URL no cambia porque el slug es estable). La lógica vive en `lib/share/target.ts` (`resolveShare`, `resolveGuestShare`; puro, sin React). (3) **URLs**: siempre desde `getPublicInvitationUrl()` / `getGuestInvitationUrl()` (`NEXT_PUBLIC_SITE_URL`); ningún dominio escrito a mano (lo verifica un test). (4) **QR generado en local** con `qrcode-generator` (única dependencia nueva, autorizada por el propietario: ~20 kB, sin dependencias, MIT): la librería solo calcula la matriz; el SVG (rutas propias, tinta `#21170d` sobre blanco, zona de silencio de 4 módulos, sin degradados ni logos) y el PNG de 1024 px (canvas del navegador, sin redondeo de módulos) los dibuja el proyecto (`lib/share/qr.ts`). Ningún servicio externo, la URL nunca sale del navegador, el QR no se guarda en la base de datos. Descarga `invitacion-<slug>-qr.png` (nombre saneado con `slugify`, nunca con texto libre). (5) **QR de invitado**: codifica `…/i/<slug>?guest=<token>` (el `inviteToken` opaco ya construido en el servidor; nunca `Guest.id`), el token no se muestra como texto ni va en el nombre de archivo; individual (sin generación masiva) y sin descarga automática. El QR no es una capa de seguridad: la credencial sigue siendo el token. (6) **Calendario**: generador `.ics` propio (`lib/calendar/ics.ts`, RFC 5545: escapado, plegado a 75 octetos, CRLF), sin Google Calendar API ni OAuth. `DTSTART;TZID=<Event.timezone>` con la hora local de esa zona y un `VTIMEZONE` cuyo desfase se calcula con `Intl` en el instante del evento (correcto con horario de verano, nada de desfases fijos); **no se inventa `DTEND`** (`Event.endsAt` no existe ni está en el snapshot). `UID` = `<slug>@<host>` (estable) y `SEQUENCE` = versión publicada − 1, de modo que reimportar tras republicar actualiza el evento. (7) **Ruta pública** `/i/[slug]/calendar.ics` (route handler, sin Clerk, `force-dynamic`, `Cache-Control: no-cache`, `X-Robots-Tag: noindex`): lee **solo** `loadPublishedInvitation` (snapshot vigente), por lo que cambiar la fecha en el editor sin republicar NO cambia el archivo y republicar sí. No incluye ningún dato de invitados (la URL es siempre la general, sin `?guest=`). Slug inválido, borrador o inexistente → 404 de texto plano. (8) **CTA pública** «Agregar al calendario» en la sección de cuenta regresiva de la invitación: enlace de descarga (`download`), sin dependencia de Clerk ni de la personalización; oculto en las demos `demo-*` y deshabilitado en la vista previa del editor (el `.ics` publicado aún no refleja el borrador). (9) **Web Share API** (`navigator.share` con título, texto «Nos encantará compartir este día contigo.» y URL): el botón solo aparece si el navegador lo soporta; cancelar la hoja no es un error. Sin dependencia; el portapapeles rechazado deja el enlace seleccionado como alternativa. Alternativas descartadas: QR por servicio externo (envía URLs a terceros), Google/Outlook por enlace (fuera de alcance, sin API), guardar el QR en almacenamiento (se regenera al instante). Consecuencias: sin migración ni cambio de esquema; deuda registrada en el informe de la tarea (sin `DTEND`, sin QR masivo, `VTIMEZONE` de un solo desfase por evento, QR PNG depende de `<canvas>`).

### D-31 · **SUPERSEDED por D-32** (modelo de suscripción mensual por usuario; se conserva como historial) · Planes en código, suscripción por usuario, derechos en el servidor y Stripe detrás de un adaptador
→ Decisiones: (1) **Cinco conceptos separados**: *Plan* (producto: configuración versionada en código, `lib/billing/plans.ts`), *Subscription* (qué plan tiene contratada una cuenta: BD), *Entitlement* (qué puede hacer: `lib/billing/entitlements.ts` + `server/services/entitlement-service.ts`), *Usage* (cuánto usa: `server/repositories/usage.ts`) y *Billing Provider* (quién cobra: `server/billing/`). El dominio pregunta `canUseFeature(userId, "customMedia")` o `getLimit(userId, "maxGuestsPerEvent")`, jamás «¿tiene Stripe?». (2) **Plan en código, Subscription en BD** (opción B del encargo): los planes son producto, no contenido de usuario; cambiar una cuota es editar un número, sin migración. Los números iniciales (FREE 1/30/5, ESSENTIAL 3/150/20, PREMIUM sin tope/500/50) son configuración inicial, no contrato. **Feature** (booleana: `publish`, `personalizedGuestLinks`, `qr`, `calendar`, `customMedia`) y **cuota** (numérica o `null` = sin límite: `maxEvents`, `maxGuestsPerEvent`, `maxGalleryImages`) no se mezclan. (3) **Plan efectivo** (`resolveEffectivePlan`, única política): sin suscripción de pago → FREE (no existe fila FREE); ACTIVE/TRIALING → el plan; PAST_DUE → se conservan los derechos de pago durante 14 días desde el inicio del periodo impago y después FREE; CANCELED/INCOMPLETE/estado desconocido → FREE. Nunca se concede un plan de pago por defecto ni por un error de red: la fuente es la BD sincronizada por webhook y no se llama al proveedor en cada petición (una lectura indexada por petición; sin caché, así que un webhook se refleja de inmediato). (4) **Modelo de datos** (migración aditiva `add_billing`): `BillingCustomer` (única tabla con la referencia al cliente del proveedor; unique por usuario+proveedor), `Subscription` (una fila por usuario; pertenece al `User`, nunca a un evento; guarda `providerEventAt` para ignorar eventos desordenados), `WebhookEvent` (idempotencia: unique proveedor+id de evento; solo id y tipo, nunca el cuerpo) y `Template.minimumPlan`. Enums `BillingProvider` (STRIPE, MERCADO_PAGO reservado), `Plan`, `SubscriptionStatus` (ACTIVE, TRIALING, PAST_DUE, CANCELED, INCOMPLETE) y `BillingInterval`. No se añade `stripeCustomerId` a `User` (evita duplicar la referencia). (5) **Adaptador de proveedor** (`server/billing/provider.ts`): `BillingProvider` (precios plan→proveedor, cliente, sesión de pago, portal, cancelar, consultar, listar y verificar webhooks) con una única implementación, `StripeBillingProvider`. Solo `server/billing/` importa el SDK de Stripe (lo comprueba un test); añadir Mercado Pago es escribir otro adaptador. Estados de Stripe → estados de dominio en `status.ts` (los desconocidos → INCOMPLETE, sin derechos). (6) **Checkout**: el cliente envía SOLO el enum del plan (ESSENTIAL | PREMIUM); el servidor exige sesión, resuelve el precio desde variables de entorno (`STRIPE_PRICE_*`, nunca desde el cliente), rechaza si ya hay una suscripción vigente (los cambios de plan y cancelaciones se hacen en el portal, para no cobrar dos veces), crea o reutiliza el cliente (creación perezosa, con clave de idempotencia) y crea una sesión en modo `subscription`. Las URL de regreso salen de `getSiteUrl()`. El regreso (`?checkout=success`) NO activa nada. (7) **Webhook** (`POST /api/webhooks/stripe`, sin Clerk, firma sobre el cuerpo crudo): fuente de verdad. Verifica firma → normaliza → registra el evento y aplica la suscripción en UNA transacción (un evento repetido no se aplica; si aplicar falla se revierte y Stripe reintenta). Maneja `customer.subscription.created/updated/deleted/paused/resumed` y, consultando la suscripción actual, `checkout.session.completed` e `invoice.paid/payment_succeeded/payment_failed`. El usuario sale del cliente guardado; el plan, de un mapa servidor precio→plan: un precio o cliente desconocido no concede nada. Un evento más antiguo no pisa a uno más nuevo y la suscripción anterior cancelada no derriba a la vigente. (8) **Portal del cliente**: solo con el cliente guardado para el usuario de la sesión; Hilo Luna no construye UI de tarjeta, facturas ni método de pago y nunca recibe datos de tarjeta. (9) **Aplicación en el servidor** (la interfaz solo refleja): crear evento (`maxEvents` + plan mínimo de la plantilla) en `createEventForUser`; alta de invitado (`maxGuestsPerEvent`) en `createGuestFor`; añadir imagen a la galería (`maxGalleryImages`; la portada y las sedes no cuentan) en `addGalleryImage`; publicar (feature `publish`) en `publishInvitationForOwner`; cambiar de plantilla (plan mínimo, solo al cambiar) en el guardado del borrador. QR, calendario, enlaces personalizados y `customMedia` existen como features configurables (hoy activas en todos los planes) sin candado artificial. (10) **Política de bajada de plan**: bajar de plan NUNCA borra contenido. Lo existente se ve, se edita, se elimina y sigue recibiendo RSVP; solo se bloquea AÑADIR por encima del límite. Ningún módulo de facturación ni de límites contiene operaciones de borrado (lo verifica un test). (11) **Configuración**: sin `STRIPE_SECRET_KEY` la aplicación funciona como FREE, `/pricing` se muestra y el pago responde «Los pagos todavía no están configurados en este entorno.»; para cobrar se exigen clave secreta, secreto de webhook (sin él se cobraría sin poder activar el plan) y al menos un precio; claves de modos distintos (`sk_test` con `pk_live`) se reportan como inconsistencia, nombrando variables y nunca valores. Solo intervalo mensual (los anuales son opcionales por variable; sin interruptor anual falso). (12) **Páginas sin mockup** (pedidas explícitamente por el propietario): `/pricing` y `/dashboard/billing` se componen con los tokens y componentes existentes (sin gradientes, sin estética SaaS genérica, sin prueba social ni precios inventados). «Plan y facturación» vive en el menú de cuenta, no en la barra lateral. (13) **Dependencia**: `stripe` (SDK oficial), única nueva. Sin Mercado Pago, PayPal, cupones, prueba gratuita, facturas propias, motor de impuestos, referidos ni consola de administración. Consecuencias y deudas: la comprobación de límites es «contar y luego escribir» (dos altas simultáneas pueden pasar el límite por una unidad); no hay límite por GB de almacenamiento (solo número de imágenes de galería); la galería en el editor muestra el mensaje del límite, sin `UpgradePrompt` ni deshabilitado previo; el `.ics` público no consulta features; sin cron de reconciliación (solo `syncSubscriptionFromProvider` a demanda); una fila de suscripción por usuario (sin historial); guía de configuración y pruebas en `docs/BILLING.md`.

### D-32 · **Aprobada (propietario, refactor comercial)** · Billing por evento: un pago único, sin suscripción — **sustituye a D-31**
→ **Billing is event-scoped, not user-subscription-scoped.** Decisión: el modelo comercial pasa de «suscripción mensual por usuario» (D-31) a **un pago único por evento** (sin renovación). Motivo: una invitación es de un momento (una boda, un cumpleaños); un cobro recurrente por cuenta no refleja el valor ni la intención de compra. Decisiones: (1) **El entitlement pertenece al EVENTO.** Una misma cuenta puede tener un evento Gratis, otro Esencial y otro Premium; el plan de la cuenta deja de existir (no hay `getUserPlan`/`getUserEntitlements`/`canUseFeature(userId…)`; un test lo impide). La fuente de verdad es `Event` + `EventPurchase`. (2) **Modelo de datos** (migración aditiva `event_purchases`): `EventPurchase` (una fila por sesión de cobro; `eventId`, `userId`, `provider`, `providerCheckoutSessionId` único, `providerPaymentIntentId`, `plan`, `kind` INITIAL|UPGRADE, `status` PENDING|PAID|FAILED|REFUNDED|CANCELED, `amount` en centavos, `currency`, `paidAt`, `accessStartsAt/EndsAt`; relaciones `Restrict`: el historial financiero no se borra en cascada) y `Event.paidAccessEndsAt`. `BillingCustomer` sigue ligado al `User` (un cliente de Stripe reutilizado en todas las compras) y `WebhookEvent` se mantiene para la idempotencia. **`Subscription` queda como LEGACY sin uso** (se conserva la tabla, no se lee ni se escribe, no se convierte en compras porque no sabemos a qué evento correspondería; se elimina con una migración explícita cuando se confirme que está vacía): no se destruyen datos en silencio ni se hace `migrate reset`. (3) **Plan efectivo de un evento** (`getEffectiveEventPlan`, pura): el mayor plan de sus compras `PAID`; sin ninguna → FREE. `PENDING`, `FAILED`, `CANCELED` y `REFUNDED` no conceden nada (un pago fallido conserva el plan; un reembolso total lo retira; nada se borra). Sin caché ni llamadas a Stripe por petición. (4) **Planes y precios centralizados** en `lib/billing/plans.ts`: `displayPrice` (Gratis 0 · Esencial 499 · Premium 799), `currency` (MXN), `stripePriceEnvKey`, `upgradeFrom`, `features` y `limits` **por evento** (30/5, 100/15, 300/40). Se elimina `maxEvents`: crear un evento ya no consulta ningún cupo y el evento nace Gratis (los límites anti-abuso futuros quedan documentados, no implementados). (5) **Mejoras**: Gratis → Esencial, Gratis → Premium y Esencial → Premium; sin bajadas ni recompras. Esencial → Premium cobra **solo la diferencia** (`799 − 499`, calculada de la configuración, nunca escrita a mano) con un **precio de Stripe específico de la mejora** (`STRIPE_PRICE_ESSENTIAL_TO_PREMIUM`; un importe dinámico obligaría a crear precios al vuelo). La mejora es una **segunda compra** (`UPGRADE`): el historial no se sobrescribe. (6) **Checkout** (`startEventCheckout`): el cliente envía `eventId` y `plan`; el servidor exige sesión, resuelve el evento **propio** (ajeno = no encontrado), valida la mejora, resuelve el precio, reutiliza o crea el cliente, crea una sesión `mode: "payment"`, anota la compra `PENDING` y redirige. Metadata mínima (`hiloLunaUserId`, `eventId`, `targetPlan`). Regreso a `/dashboard/events/[id]?payment=success|canceled`: NO activa nada («Estamos confirmando tu pago…»). (7) **Webhook** (`/api/webhooks/stripe`): fuente de verdad, firma obligatoria, idempotente. El evento solo avisa: el servicio relee la sesión de cobro y **no confía en la metadata**; concede solo si el pago está cobrado, el precio es conocido y coincide con el plan, la moneda es MXN, el importe es exacto, el evento existe y su propietario coincide, y (en una mejora) el evento ya tiene Esencial pagada. `customer.subscription.*` y demás eventos del modelo anterior se **ignoran**. Procesa `checkout.session.completed/async_payment_*/expired`, `payment_intent.succeeded/payment_failed` y `charge.refunded` (total). (8) **Ventana de acceso**: `paidAccessEndsAt = max(compra + 30 días, evento + 30 días, fin actual)`; al cambiar la fecha de un evento de pago solo crece (`max(actual, nueva + 30 días)`), nunca se acorta; implementado centralizado en `lib/billing/purchase.ts` y aplicado en la misma transacción del guardado del borrador. **Expiración preparada, no aplicada**: `getEventAccessState`/`isEventAccessActive` existen, pero la invitación pública aún no cierra ni se borra nada (siguiente paso: `/i/[slug]` con «Esta invitación ya no está disponible.»). Un evento Gratis no expira. (9) **Aplicación en el servidor, por evento**: alta de invitado, imagen de galería, publicar y cambio de plantilla resuelven el plan DEL EVENTO (`Template.minimumPlan` es un plan mínimo de evento; un evento nuevo, Gratis, solo admite plantillas Gratis). (10) **Interfaz** (sin rediseño; composición con los tokens existentes): `/pricing` (un pago único por evento, sin cobrar: los CTA llevan a crear el evento con `?plan=`), panel «Mejorar evento» en el dashboard de cada evento (con el plan del evento y «Disponible hasta…»), «Compras y planes» (`/dashboard/billing`: un bloque por evento con plan, acceso, uso e historial de pagos) y avisos «Mejorar evento». Toda compra pertenece a un evento; no se puede pagar sin evento. Customer Portal y recibos: la integración se conserva pero ninguna pantalla lo presenta como gestión del plan. (11) **Configuración**: `STRIPE_PRICE_ESSENTIAL_ONE_TIME`, `STRIPE_PRICE_PREMIUM_ONE_TIME`, `STRIPE_PRICE_ESSENTIAL_TO_PREMIUM` (las mensuales quedan obsoletas); precios de Stripe en MXN y de pago único; guía en `docs/BILLING.md`. Sin Stripe Tax: los impuestos y datos fiscales son una decisión comercial pendiente antes de operar. Consecuencias y deudas: comprobación de límites «contar y luego escribir» (excede por una unidad bajo concurrencia); dos pagos abiertos a la vez pueden cobrar dos veces (se resuelve con un reembolso manual); sin UI de reembolsos; sin cuota de almacenamiento; sin cron de reconciliación; sin enforcement de expiración; sin Admin.

### D-33 · **Aprobada (propietario, consola interna)** · Admin Console: rol en PostgreSQL, `requireAdmin()` y frontera de datos mínima
→ **La consola es una herramienta interna, de solo lectura salvo dos campos de las plantillas, y nunca ve datos personales de invitados.** Decisiones: (1) **Rol interno en PostgreSQL**: `enum UserRole { USER ADMIN }` y `User.role` (por defecto `USER`), migración aditiva `20260926150000_user_role` (nadie se asciende: todos quedan `USER`). El privilegio NO se deduce del correo, del dominio, de un parámetro ni de metadatos de Clerk; no hay endpoint, pantalla ni acción para ascender: el bootstrap es manual (Prisma Studio o SQL, `docs/ADMIN.md`). (2) **`requireAdmin()`** (`server/auth/admin.ts`) es el único punto de decisión: sesión de Clerk → `User` → `role` leído de la base de datos (`findUserRole`) → `=== "ADMIN"`. Falla cerrado (rol ausente/desconocido, error al leerlo o sin base de datos = sin privilegios); sin sesión → `/sign-in`, sin privilegios → `notFound()`. Cada página y cada Server Action de `/admin/**` lo llama (los layouts no se re-ejecutan al navegar); `proxy.ts` solo exige sesión (primera barrera). Los servicios de la consola reciben un `AdminUser` (prueba de haberlo llamado). (3) **Frontera**: `server/repositories/admin.ts` es el único módulo con Prisma para la consola (regla 13); `server/admin/*` son los servicios y los **DTO mínimos** (`dto.ts`); las páginas y los componentes no conocen Prisma. Cada consulta usa `select` explícito, `count`/`aggregate`/`groupBy` (nada se cuenta en JavaScript) y paginación de servidor (25); la búsqueda usa filtros de Prisma (sin SQL con texto del usuario; la única consulta cruda —archivos huérfanos— es de texto fijo con un parámetro de fecha y su fallo no tumba el resumen). (4) **Privacidad (mínimo necesario)**: de los invitados solo conteos y resumen de confirmaciones (nunca correo, teléfono, mensajes, respuestas ni `inviteToken`); ni contraseñas, ni ids de Clerk (solo «vinculada»), ni datos de tarjeta, ni el `snapshot` de las publicaciones, ni cuerpos/firmas de webhooks; los ids del proveedor de pagos salen **enmascarados** (`cs_test_••••••wxyz`); la salud del sistema devuelve solo booleanos y nombres de variables, nunca valores. (5) **Plan efectivo sin lógica duplicada**: la consola usa `getEffectiveEventPlan`, `getEventAccessState` e `isEventAccessActive`; los filtros por plan y publicación (`eventPlanWhere`, `eventPublicationWhere`) son las mismas reglas como condición SQL y una prueba las contrasta exhaustivamente con el dominio (además de contrastarse con PostgreSQL real). (6) **Ingresos**: solo compras `PAID` (los reembolsos, cancelaciones, fallidas y pendientes no cuentan), en MXN; otras monedas se muestran aparte (sin sumar ni convertir). Sin contabilidad avanzada ni impuestos. (7) **Compras de solo lectura**: la consola no marca pagos, no crea planes, no reembolsa ni edita importes; Stripe y el webhook verificado siguen siendo la autoridad (D-32). `Subscription` (legacy) no se lee. (8) **Plantillas: solo `publicationStatus` y `minimumPlan`** (no `name`, `slug` ni `designStatus`). Ocultar una plantilla la retira de las NUEVAS selecciones; las invitaciones publicadas siguen funcionando (leen su snapshot) y **republicar una invitación existente ya no exige que su plantilla siga visible** (cambio en `publishOwnedInvitation`: la comprobación de plantilla conserva diseño terminado y tipo de evento, pero no `publicationStatus`); cambiar `minimumPlan` no toca eventos existentes. La acción revalida `/templates` y `/pricing` (se generan estáticas) y el seed (`upsertTemplates`) fija esos dos campos solo al CREAR, para no deshacer lo que decidió el administrador. (9) **Interfaz**: marco propio (marca «Hilo Luna» + ADMIN, seis secciones, «Volver al panel»), mismo sistema de diseño (`--lu-*`, nunca `--inv-*`), algo más denso que el panel de clientes; tablas semánticas (`<caption>`, `scope="col"`) que pasan a tarjetas por debajo de un punto de corte (una sola visible), filtros como formularios GET con etiquetas, estado siempre con texto y confirmaciones en diálogos (sin `window.confirm`). Enlace «Administración» en el menú de cuenta solo para administradores. Consecuencias y deudas: sin registro de auditoría de acciones; el rol no se gestiona desde la interfaz; los webhooks ignorados o con error no se registran (el modelo solo guarda los procesados); sin impersonación, borrados, reembolsos, CSV, acciones masivas ni analítica.

### D-34 · **Aprobada (propietario, preproducción / hardening)** · Configuración validada, CSP, límite de tasa, expiración, privacidad de imágenes, registro con redacción y auditoría
→ **Objetivo: dejar el proyecto listo para staging/producción sin nuevas features de producto ni cambios comerciales.** Decisiones: (1) **Entorno validado** (`server/config/env.ts`, `startup.ts`, `instrumentation.ts`): en producción faltar o ser incoherente algo crítico (base de datos, Clerk, Stripe, secreto de webhook, tres precios de pago único, S3/R2, URL https del sitio) hace FALLAR el arranque con un error que nombra variables (nunca valores); en desarrollo solo avisos (modo demostración legítimo). No corre durante `next build`. (2) **Cabeceras y CSP** (`server/security/csp.ts`, aplicadas en `next.config.ts`): nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options SAMEORIGIN (el editor incrusta su propia vista previa), HSTS solo en producción, y una CSP SIN nonce: `script-src 'self' 'unsafe-inline'` + host exacto de Clerk (derivado de la clave pública) + Turnstile, `connect-src` con Clerk y el endpoint de S3, `img-src` con el dominio de medios, `frame-ancestors 'self'`, `object-src 'none'`, sin comodines. **Excepción documentada:** `unsafe-inline` porque Next emite scripts en línea y un nonce obligaría a renderizar todo de forma dinámica; Stripe es una redirección (sin Stripe.js en el navegador); `CSP_REPORT_ONLY=true` es el interruptor operativo. Riesgo: no se probó contra Clerk real (verificar en staging). `/i/**`, panel, consola, vista previa, acceso y API llevan `X-Robots-Tag: noindex`; las invitaciones, además, `Referrer-Policy: no-referrer` y `private, no-store`. (3) **Límite de tasa** (`server/security/rate-limit.ts`): abstracción `RateLimiter` con `RestRateLimiter` (Redis con API REST compatible con Upstash: INCR + EXPIRE NX en un pipeline) y `NoopRateLimiter` (desarrollo); NO existe limitador en memoria a propósito. Protege RSVP (por cliente y por invitado), consulta `?guest=` (por cliente) y emisión de URLs de subida (por usuario); NUNCA el webhook de Stripe. Claves con hash (jamás IP/token/usuario en claro), fail-open ante fallos del proveedor, producción sin proveedor = aviso claro, `RATE_LIMIT_REQUIRED=true` = error de arranque. (4) **Expiración de eventos de pago** (`loadPublishedInvitation` → `ExpiredRecord`): al vencer `paidAccessEndsAt` (mismas reglas de `isEventAccessActive`; un evento Gratis nunca expira) `/i/[slug]` muestra «Esta invitación ya no está disponible.» SIN contenido del evento, los enlaces personalizados caen en la misma página sin consultar al invitado, el RSVP responde `expired` y `calendar.ics` da 404. El tipo de retorno obliga a comprobarlo antes de leer la invitación. NADA se borra: mover la fecha hacia adelante o mejorar el evento la reactiva. (5) **Privacidad de imágenes** (`server/media/normalize.ts`): al verificar una subida se eliminan EXIF/GPS, IPTC y comentarios sin recodificar (JPEG/PNG/WEBP) y solo una foto con orientación EXIF ≠ 1 se gira con `sharp` (el de Next, carga bajo demanda, calidad 95); sin `sharp` esa foto se rechaza. (6) **Huérfanos** (`media-orphans.ts`, `media-cleanup.ts`): una sola definición SQL (PENDING > 24 h; READY sin referencias en borrador ni publicación vigente > 24 h; nunca un archivo publicado); análisis solo lectura, limpieza `dryRun` por defecto, `countReferences` de nuevo antes de borrar y `npm run media:orphans` (manual, `--apply --confirm=DELETE`); la consola solo ANALIZA. Sin tarea programada. (7) **Registro** (`server/observability/logger.ts`): único punto que escribe en consola, JSON por línea, redacción por nombre de campo y por forma del valor (claves de Stripe/Clerk, whsec, URLs con credenciales, correos, tokens), errores reducidos a nombre/código/tipo. (8) **Webhook**: el evento solo queda registrado en la MISMA transacción que aplica su efecto; fallos temporales de la base de datos → 503 con `Retry-After` (Stripe reintenta), otros → 500; pruebas de reintento. (9) **Doble cobro** (`startEventCheckout`): antes de abrir una sesión se revisan las compras pendientes/fallidas del evento — misma compra con sesión abierta → se REUTILIZA; sesión completada → «ya hay un pago en proceso»; sesión abierta de OTRO plan → se caduca; caducada → se cierra (`CANCELED`) y se puede reintentar; y la sesión se crea con una clave de idempotencia estable (usuario+evento+plan+tipo+ventana de 30 min+nº de compras) y `expires_at` de 31 min, de modo que dos peticiones simultáneas obtienen la MISMA sesión. (10) **Auditoría** (`AdminAuditLog`): cada cambio real de visibilidad o plan mínimo de una plantilla deja UNA entrada (quién, qué, antes/después de los campos cambiados) en la misma transacción; solo inserción; página `/admin/audit`. (11) **Base de datos**: índices con consulta real que los justifica (`WebhookEvent.processedAt`, `EventPurchase.createdAt`, `User.createdAt`, `Event.paidAccessEndsAt`, `MediaAsset(status, createdAt)`), unicidad de `(provider, providerPaymentIntentId)` y restricciones CHECK `NOT VALID` (importes ≥ 0, moneda ISO, PAID exige `paidAt`, revisiones/versiones válidas, `endsAt ≥ startsAt`) más un índice único parcial «una publicación vigente por invitación». (12) **Superficie pública**: `robots.txt` y `sitemap.xml` solo de marketing (nunca `/i/**`), `/privacy` y `/terms` como BORRADOR claramente marcado («DRAFT — requiere revisión legal antes de lanzamiento»), `/api/health` (vida) y `/api/health/ready` (configuración + base de datos, solo booleanos). Sin banner de cookies (no hay analítica externa; reevaluar al añadir trackers). Consecuencias y deudas: la CSP conserva `unsafe-inline`; sin proveedor de límite de tasa definido; sin borrado de cuenta (procedimiento manual en `docs/OPERATIONS.md`); sin tarea programada de huérfanos; sin migración retroactiva de EXIF en fotos antiguas; la tabla `Subscription` sigue sin eliminarse; sin observabilidad externa.

### D-35 · **Aprobada (propietario, preparación de staging real)** · `APP_ENV`, staging noindex, seed de staging y verificación del Price antes de cobrar
→ **Objetivo: poder desplegar un staging real, separado de desarrollo y producción, sin cambiar el modelo comercial ni añadir features.** Decisiones: (1) **`APP_ENV`** (`development | staging | production`, `server/config/app-env.ts`): staging y producción son ambos `NODE_ENV=production`, así que solo `APP_ENV` los distingue; es **obligatorio en cualquier despliegue** (el arranque falla si falta o es `development`). Con `APP_ENV=staging` el arranque **rechaza claves `live`** de Clerk/Stripe y el dominio de producción como `NEXT_PUBLIC_SITE_URL`, y avisa si el bucket no contiene «staging»; con `production` y claves de prueba avisa. (2) **Staging es TODO noindex**: `X-Robots-Tag: noindex, nofollow` en todas las respuestas, `robots.txt` con `Disallow: /` sin sitemap y `sitemap.xml` vacío. Se fija al BUILD, por lo que `APP_ENV` y `NEXT_PUBLIC_SITE_URL` entran en la **huella de build** (`HILOLUNA_CSP_FINGERPRINT`) y el arranque avisa si difieren de las del servidor (protección existente, ampliada, no relajada). (3) **Seed**: `npm run db:seed:staging` (solo plantillas, manual, idempotente); el seed completo (`db:seed`, evento demo y usuario demo) **se niega** con `APP_ENV=staging|production`. (4) **Precio verificado antes de cobrar**: `BillingProvider.verifyPrice` consulta el `price_…` en Stripe (activo, pago único, importe y moneda de `lib/billing/plans.ts`) antes de abrir la sesión; un Price mal configurado ya no cobra al cliente para luego ser rechazado por el webhook. (5) Un bucket de R2 **por entorno** (sin prefijos) y CORS por bucket; `SMOKE_BASE_URL` obligatorio (sin valor por defecto) y auditoría de HTML público en `npm run smoke`. (6) **Corrección hallada al preparar staging con Clerk activo:** `/pricing` (pública, pero con CTA según la sesión) llamaba a `auth()` sin que `clerkMiddleware` corriera en la ruta (el `matcher` de `proxy.ts` solo cubría las rutas privadas) y respondía 500; ahora el `matcher` incluye `/pricing` y un test exige que toda página que lea la sesión esté cubierta. (7) `docs/STAGING.md` es la checklist reproducible y contiene la clasificación de bloqueadores para producción. **Consecuencias:** los servicios reales (Clerk, R2, Stripe, Upstash) se validan en el staging del propietario; ninguna prueba con claves reales se ejecuta desde el repositorio.

### D-36 · **Aprobada (propietario, correo transaccional)** · `EmailProvider` (Resend), `EmailDelivery` idempotente y tres notificaciones al anfitrión
→ **Objetivo: avisar al anfitrión (nunca todavía a los invitados) de un RSVP nuevo y de una compra confirmada, sin acoplar el dominio a Resend ni tocar billing/auth.** Decisiones: (1) **Abstracción `EmailProvider`** (`server/email/provider.ts`, mismo patrón que `BillingProvider` D-32): solo `server/email/resend-provider.ts` importa el SDK; `server/email/dev-provider.ts` sustituye a Resend en desarrollo sin clave (no manda nada, pero ejercita servicio y plantilla). (2) **`EmailDelivery`** (`docs/DATABASE_SCHEMA.md` §20): metadatos mínimos (nunca asunto ni cuerpo), `@@unique([kind, purchaseId])` — con `purchaseId` NULL en `RSVP_NOTIFICATION` la restricción de Postgres no colisiona, así que solo protege `PURCHASE_CONFIRMATION`/`UPGRADE_CONFIRMATION`: como máximo un correo por compra confirmada aunque el webhook se repita (verificado contra PostgreSQL real). El RSVP se controla aparte: `savePublicRsvp` compara con la respuesta ANTERIOR (misma transacción) y solo dispara si el estado o el número de asistentes CAMBIARON. (3) **Disparo sin bloquear la respuesta**: `after()` de Next 16 (estable; soportado en Server Actions y Route Handlers, exactamente donde se disparan estos correos) — el RSVP público y el webhook de Stripe responden sin esperar a Resend; con `EMAIL_SEND_TIMEOUT_MS = 8000` como cota. Fuera de una petición (pruebas) cae a un envío directo sin bloquear al llamador (`server/email/run-after.ts`). (4) **Nunca falla la acción principal**: un RSVP se guarda aunque el correo falle; el webhook ya confirmó el pago en su transacción antes de intentar el correo. (5) **Seguridad de staging**: `APP_ENV=staging` exige `EMAIL_STAGING_ALLOWLIST` (fail-closed: sin lista, no se manda nada) y añade `[STAGING]` al asunto. (6) **Consola** (`/admin/emails`): SOLO LECTURA, como `/admin/webhooks` — no se añadió un botón de reenvío para no contradecir CLAUDE.md (la consola es de solo lectura salvo los dos campos de plantilla); `retryFailedEmailDelivery()` queda preparado en `server/email/service.ts` sin interfaz. (7) Saneamiento contra inyección de cabeceras (`sanitizeHeaderValue`) y HTML escapado (`escapeHtml`) en toda variable de la base de datos. **No implementado a propósito** (fuera de esta fase): correo a invitados, recordatorios, campañas, seguimiento de apertura/clic, webhook de Resend, reembolsos.

### D-37 · **Aprobada (propietario, fase final de preproducción)** · CSP estricta validada, monitoreo opcional con Sentry, simulacro real de respaldo/restauración y checklist GO/NO-GO
→ **Objetivo: cerrar los últimos bloqueadores técnicos antes de producción, sin features nuevas ni cambios de modelo comercial, auth o diseño.** Decisiones: (1) **CSP estricta es el comportamiento por defecto**: sin `CSP_REPORT_ONLY` la política se APLICA (nunca Report-Only); verificado con un build de producción real (`APP_ENV=production`) contra una base de datos temporal — cabeceras, robots/sitemap de producción (marketing indexable, resto `noindex`), hidratación y 200 peticiones públicas (100 secuenciales + 100 concurrentes) sin error ni señal de fuga de memoria. (2) **`'unsafe-inline'` en `script-src`: revisado de nuevo y mantenido, riesgo aceptado para el MVP** — las dos alternativas (CSP con nonce vía `proxy.ts`, que exigiría renderizado dinámico en TODO el sitio y perdería la generación estática del marketing; SRI sin nonce, que sigue siendo una función experimental de Next 16) se descartaron por ahora; documentado en `docs/DEPLOYMENT.md` §7. (3) **Monitoreo de errores opcional con Sentry** (`@sentry/node`, abstracción mínima en `server/observability/monitoring.ts`): un único punto de entrada (`captureException`), llamado SOLO por `logger.error` — capturar «excepciones del servidor, fallos de ruta, del webhook y de subida» es automático en cualquier sitio que ya llamaba a `logger.error(...)`, sin tocar esos archivos. Sin `SENTRY_DSN` no hace nada (ni carga el SDK). Nunca envía `request` ni `user`; el mensaje de la excepción y las migas de pan se sanean con las MISMAS reglas que el registro (extraídas a `server/observability/redact.ts`, compartido por ambos sin import circular). Sin tracing de rendimiento (`tracesSampleRate: 0`). (4) **Corrección de un error real de redacción**: el patrón genérico de «token de 32+ caracteres» enmascaraba también los NOMBRES de variables de entorno largos (p. ej. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` aparecía como `[token]` en los avisos de arranque, ocultando precisamente el dato que hacía falta para corregir la configuración); ahora se distingue un nombre `MAYUSCULAS_CON_GUION_BAJO` de un secreto real (que mezcla mayúsculas/minúsculas o es aleatorio) y solo el segundo se enmascara. (5) **Simulacro REAL de copia de seguridad y restauración**: `pg_dump --format=custom` → `pg_restore` en una base nueva → `prisma migrate status` (**«up to date»**) → conteos idénticos entre origen y restaurada, contra PostgreSQL real (nunca la base del propietario); procedimiento documentado en `docs/OPERATIONS.md` §2. (6) **Retención de R2 sin backups complejos**: versionado de objetos como única medida activa recomendada; qué ocurre al borrar un objeto y cómo recuperarlo documentado (`docs/OPERATIONS.md` §3); procedimiento (sin reprocesar en masa) para identificar imágenes anteriores a D-34 que puedan conservar EXIF. (7) **`SMOKE_EXPECT_PRODUCTION=1`** en `scripts/smoke.mjs`: exige https, CSP aplicándose, HSTS, indexación correcta del marketing y ausencia de secretos — sin automatizar ningún inicio de sesión. (8) **`docs/PRODUCTION_CHECKLIST.md`**: BLOCKER/REQUIRED/OPTIONAL por área y tabla GO/NO-GO; hoy hay BLOCKERS reales (textos legales, impuestos, y todo lo que exige cuentas de producción reales) — no se declara producción lista. **No implementado a propósito** (fuera de esta fase): CSP con nonce/SRI, alertas con guardias (paging), réplica automática de R2, reprocesado masivo de EXIF, borrado de la tabla `Subscription` (0 filas verificadas en la base de prueba; falta confirmarlo en la real), cualquier feature de producto nueva.

### D-38 · **Aprobada (propietario, nueva plantilla)** · "Level 12": segunda plantilla `implemented`, gamer/neón para cumpleaños

→ **Objetivo: entregar una plantilla nueva completamente terminada (catálogo, motor, demo pública y assets) sin tocar auth, billing, publicación ni las demás plantillas**, demostrando que D-19 (DATA/TEMPLATE/SECTIONS/RENDERER) permite añadir una plantilla como pura configuración + assets. Decisiones: (1) **`eventType`**: no existe un tipo exacto "cumpleaños infantil/preadolescente" en `EventCategoryId`/`OnboardingEventType` (`KIDS` es una categoría de ESTILO del catálogo, no un tipo de alta, según su propio comentario en `lib/events/event-types.ts`); se usó `birthday`, el más cercano, ya existente de punta a punta (onboarding, `createDefaultInvitationData`, `eventTypeToDb → BIRTHDAY`). (2) **`TemplateStyleId`**: no existe un estilo "gamer/arcade"; se usó `themed` (ya usado por Dream), el más cercano semánticamente; `kids` se descartó por ser tonalmente infantil/bebé (Safari), no preadolescente. Ninguna decisión añadió un valor nuevo a `TemplateStyleId` ni a `EventType` de Prisma (ambos ya cubrían lo necesario). (3) **Tema del motor** (`lib/invitation/templates/level-12.ts`): paleta oscura (azul marino `#0a0e1f`, acento azul eléctrico `#39e5ff`, botón morado neón `#8b5cf6`), `layout` reutiliza enteramente variantes YA implementadas (`hero: centered`, `locations: stacked`, `gallery: grid`, `timeline: vertical`) — no se diseñó ninguna variante nueva de bloque (eso sería una ampliación del contrato de §4.9/D-17, fuera de alcance de "añadir una plantilla"); el efecto "neón" se logra con los únicos canales que el contrato de plantilla expone hoy (`colors.accent`, `componentStyles.card.shadow/border`, `effects.photoMask`), no con una propiedad CSS nueva (`--inv-vignette-color`/`--inv-vignette-blur` son hoy una sola variable GLOBAL con los valores de Magnolia, sin parametrizar por plantilla: se evitó a propósito activar `effects.vignette` para no heredar un resplandor color "ladrillo" de Magnolia bajo un tema azul; ver TODO más abajo). (4) **Sin mockup de imagen**: a diferencia de toda plantilla anterior (traducidas de `design/reference/`), Level 12 se diseñó a partir de un BRIEF DE TEXTO del propietario (paleta, elementos, tono, prohibiciones explícitas de marcas de videojuegos reales) — una desviación consciente de la regla 1 de CLAUDE.md ("se traduce el mockup a código"), asumida porque el propietario, como autoridad de diseño, proporcionó el equivalente textual de un mockup directamente en la tarea. (5) **Assets originales SIN modelo de generación de imágenes** (`public/templates/level-12/*.png`, 10 archivos, misma cuenta que Magnolia): composición vectorial (SVG) escrita a mano por el asistente — destellos, rayos, rejilla en perspectiva, trofeo, medalla y silueta sin rasgos — rasterizada una sola vez a PNG con `sharp` (dependencia ya presente en el proyecto para `server/media/normalize.ts`, usada aquí solo en tiempo de generación); se evitó así tanto un servicio de pago de generación de imágenes (no autorizado sin preguntar) como cualquier parecido accidental con personajes/consolas/logos reales de videojuegos (prohibición explícita de la tarea); documentado en `docs/ASSET_LICENSES.md` §5.2. (6) **Demo pública con contenido PROPIO, no reskin de Andrea & Fernando** (`lib/invitation/mock/santiago-level-12.ts`, `STANDALONE_DEMO_BASES` en `lib/invitation/mock/index.ts` y `lib/invitation/demo.ts`): el patrón existente de `demo-<plantilla>` reutiliza SIEMPRE el contenido de boda de Andrea & Fernando reskinado (el propio código lo documentaba como invariante: "así se ve que los datos no dependen de la plantilla"), correcto para Ivory/Étoile porque también son `eventType: wedding`; para Level 12 (`birthday`) reskinar una boda bajo un tema de cumpleaños gamer no tendría sentido para quien visita `/i/demo-level-12`. Se añadió un mapa `STANDALONE_DEMO_BASES: Record<string, Invitation>` que, para una plantilla no listada ahí, preserva EXACTAMENTE el comportamiento anterior (cero cambio para Magnolia/Ivory/Étoile, verificado por test); para `level-12` sirve el contenido de Santiago sin tocar la base de datos ni el seed/evento demo compartido (`buildDemoAggregate`, usado también por el panel de demostración, queda intacto). (7) **Catálogo, selector y demos públicas sin código nuevo**: añadir la entrada a `lib/content/templates.ts` (`status: "implemented"`) y registrar el tema en `lib/invitation/templates/index.ts` bastó para que `/templates`, `/templates/level-12`, el selector de `/dashboard/events/new` (vía `template-compat.ts`, ya filtra por `eventType` sin cambios) y `/i/demo-level-12` funcionaran, confirmando la promesa de D-19. **Deuda/TODO explícito**: `--inv-vignette-color`/`--inv-vignette-blur` (`app/(invitation)/invitation.css`) siguen sin parametrizarse por plantilla (son del tema de Magnolia); activar `effects.vignette` en cualquier plantilla no-Magnolia requeriría primero mover esos dos valores a `TemplateEffects`/`templateToCssVars()`, un cambio de contrato que no se hizo aquí por no ser necesario para Level 12. No implementado a propósito (fuera de alcance de esta tarea): chip de filtro "Cumpleaños" en la galería de `/templates` (no existe para ningún `eventType=birthday` hoy; gap preexistente, no introducido por Level 12), nuevo valor de `TemplateStyleId`/`HeroLayout`/etc., reproductor de música para la demo.

### D-17 · **Aprobada (propietario)** · `InvitationTheme` con `layout` y `effects`
→ El tema declara la variante de cada bloque estructural (`hero`, `locations`, `gallery`, `timeline`) y efectos visuales (`paperTexture`, `vignette`, `photoMask`) como **configuración de plantilla**, no opciones del usuario. Permite plantillas realmente distintas sin duplicar lógica (un bloque, varias variantes). Alternativa descartada: elegir variantes solo con `TemplateDefinition.variants` (dos mecanismos para lo mismo). Ver `design/DESIGN_SYSTEM.md` §5.

## 13. Riesgos técnicos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-1 | **Assets**: el aspecto premium depende de fotografía/decoración por plantilla; el código no las produce | Bloqueante para fidelidad | Política de assets (`ASSET_LICENSES`); pipeline de producción definido antes de cada plantilla |
| R-2 | **Peso de imágenes** (flores PNG grandes, hero) en móviles | LCP, datos móviles | AVIF/WebP, `sizes`, decoraciones vectoriales o sprites cuando sea posible, presupuesto por plantilla |
| R-3 | **`next/font` por plantilla**: importar todas las fuentes en el registro las precargaría todas. Además, cada fuente extra del selector del editor añade peso y una fila en `ASSET_LICENSES` | Peso / cumplimiento | Import dinámico del módulo de plantilla por slug; selector con lista corta y curada; verificar en build |
| R-4 | **Deriva contenido/plantilla**: alguien mete `if (template==="magnolia")` en un bloque | Rompe regla 15/17 | Lint + revisión; variantes solo vía `theme.layout` / `TemplateDefinition.variants` |
| R-5 | **JSON sin migración** al evolucionar bloques | Datos huérfanos | `contentVersion` + `migrate` + tests de esquema |
| R-6 | **Concurrencia de autoguardado** (dos pestañas) | Pérdida silenciosa | `revision` por sección |
| R-7 | ~~Colisión de slugs en raíz~~ | **Eliminado** por D-10 (`/i/[slug]`) | — |
| R-8 | **Música: derechos y caducidad de licencias**; subidas con posible infracción; `play()` exige gesto síncrono en iOS | Legal + UX | Política D-14; confirmación de derechos registrada; `RETIRED`/`disabledAt` + revalidación de snapshots; N-01/N-02 |
| R-9 | **Spam en RSVP público** | Datos basura, coste | Rate limit + honeypot (diferido, previsto) |
| R-10 | **Preview en iframe**: latencia/sincronía | Sensación "en tiempo real" | postMessage con documento completo diferido por frame; pruebas |
| R-11 | **Proyecto dentro de OneDrive** (`Escritorio\…`): `node_modules`, `.next` y `.git` sincronizándose, rutas largas, bloqueos de archivos | Instalaciones lentas/corruptas | Mover el proyecto fuera de OneDrive o excluir esas carpetas de la sincronización |
| R-12 | **Sin repositorio git** todavía | Sin historial ni revisión | `git init` al empezar el scaffold |
| R-13 | **Mockups sin cobertura** de móvil/estados/pantallas (Q-13) | Improvisación visual | Pedir mockups o aprobar composición mínima |
| R-14 | **Datos demo como reales** (prueba social omitida por decisión) | Confianza/legal | No hardcodear métricas; mostrar solo datos reales |
| R-15 | **Cormorant Garamond** tiene trazos finos y menor altura-x que la serif de los mockups | Legibilidad / fidelidad | Peso 500–600 en titulares pequeños, tamaño mínimo 16 px, calibrar contra el mockup (N-06); verificar tipo de cifras (alineadas vs. antiguas) |
