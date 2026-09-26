# ROUTES — Hilo Luna

> Estado: **v0.4 — scaffold + Design System** (placeholders de enrutado, redirect de `/dashboard`, 404 personalizado y ruta interna `/design-system`; sin lógica de negocio). Las rutas de esta versión son las **definidas por el propietario en la tarea de scaffold** (en inglés, bajo `/dashboard`); sustituyen a la propuesta previa en español (`/plantillas`, `/eventos`, `/entrar`). Ver `ARCHITECTURE.md` D-16.
>
> Fuente de verdad en código: [`lib/routes.ts`](../lib/routes.ts). Los enlaces internos se construyen con ese mapa, no con strings sueltos.

Convenciones: paths en **inglés**, minúsculas, con guiones. Los nombres de archivo de Next (`page.tsx`) son los de la carpeta de la ruta. En Next.js 16 `params` es una `Promise` (`await props.params`) y existen los helpers globales `PageProps<"/ruta">`.

## 1. Mapa de rutas

### 1.1 Implementadas (13 páginas + 1 redirect + 1 ruta interna)

| Ruta | Layout (grupo) | Mockup | Render actual | Contenido |
|---|---|---|---|---|
| `/` | `(site)/(marketing)` | 01 | Estático | **Homepage implementada** (cabecera y pie compartidos en el layout de marketing) |
| `/templates` | `(site)/(marketing)` | 02 | Estático | **Galería implementada** con catálogo MOCK local (`lib/content/templates.ts`); filtros en el cliente sincronizados con `?category=` y `?style=` |
| `/templates/[slug]` | `(site)/(marketing)` | 03 | Estático (SSG por plantilla; `slug` desconocido → 404) | **Detalle implementado**: recibe un `Template` del catálogo; **todas** las plantillas del catálogo tienen página (nunca 404) y el contenido depende de su `status` (§4.9 de ARCHITECTURE: `implemented` completo, `concept` vista básica, `comingSoon` "Próximamente" con CTA deshabilitado). "Ver invitación completa" → `/i/demo-[slug]` y "Usar esta plantilla" → `/dashboard/events/new?template=[slug]` son **rutas temporales** (`routes.templateDemo` / `routes.newEventFromTemplate`); ninguna tiene flujo real todavía |
| `/dashboard` | — (redirect en `next.config.ts`) | — | Redirect **307** → `/dashboard/events` | Sin página propia (Q-21, resuelto) |
| `/dashboard/events` | `(site)/dashboard/(workspace)` | — (sidebar "Mis eventos" en 05) | Estático | Placeholder |
| `/dashboard/events/[id]` | `(site)/dashboard/(workspace)` | 05 | Dinámico | **Dashboard implementado**; datos de la BD. `[id]` acepta el id, el `slug` del evento o el alias `demo` y redirige a la URL canónica con el id; evento inexistente → 404 |
| `/dashboard/events/[id]/edit` | `(site)/dashboard/(editor)` | 04 | Dinámico | **Editor implementado** (§4.10, D-29). **Guardado real** del borrador (autosave con debounce, revisión optimista), estado «Guardado · Borrador / Publicado / Cambios sin publicar», **publicar** / **publicar cambios** con diálogo de confirmación y **vista previa privada** (`/preview/[id]`, borrador actual). `[id]` acepta el id, el slug o el alias `demo` y redirige a la URL canónica |
| `/dashboard/events/[id]/guests` | `(site)/dashboard/(workspace)` | — (sidebar «Lista de invitados») | Dinámico | **Guest Manager implementado** (D-25): resumen, búsqueda, filtros, alta/edición/baja y enlace personalizado. Filtros en la URL: `?q=&status=confirmed\|pending\|declined&group=<id>\|none`. Exige sesión y propiedad; un evento ajeno → 404 |
| `/dashboard/events/[id]/rsvp` | `(site)/dashboard/(workspace)` | — (sidebar "Confirmaciones") | Dinámico | Placeholder + `id` |
| `/dashboard/events/[id]/settings` | `(site)/dashboard/(workspace)` | — (sidebar "Configuración") | Dinámico | Placeholder + `id` |
| `/dashboard/events/[id]/messages` | `(site)/dashboard/(workspace)` | — (sidebar "Mensajes") | Dinámico | Placeholder + `id` |
| `/i/[slug]` | `(invitation)` | 06 | Dinámico (siempre) | Invitación PUBLICADA con ese `slug`, **sin cuenta**: renderiza el **snapshot publicado** (D-29), nunca el borrador; un evento recién creado o sin publicar responde 404 hasta que se publica. Publicar una versión nueva revalida esta ruta; editar el borrador NO la cambia. `?guest=<token>` la personaliza (saludo + RSVP persistente, D-26): el invitado y sus respuestas se leen de la BD viva. `noindex`, `no-referrer`. `demo-<plantilla>`: datos del evento demo con otra plantilla. Otro `slug`, o no publicada → 404 |
| `/i/[slug]/calendar.ics` | `(invitation)` (route handler) | — | Dinámico (siempre) | **Calendario implementado (D-30).** `text/calendar` como adjunto `invitacion-<slug>.ics`, **público** (sin Clerk). Usa **solo el snapshot publicado**: cambiar el borrador sin republicar no lo altera; republicar lo actualiza (mismo `UID`, `SEQUENCE` mayor). `DTSTART` con la zona del evento, sin `DTEND` inventado, sin datos de invitados. Borrador, inexistente o slug inválido → `404` `text/plain`. `noindex`, sin caché compartida, fuera del sitemap |
| `/pricing` | `(site)/(marketing)` | — | Dinámico (depende de la sesión) | **Planes y precios implementados (D-32).** Pública. «Una invitación para tu gran día. Un solo pago.» Tres tarjetas (Gratis $0, Esencial $499, Premium $799 MXN, «Pago único por evento») con filas y precios derivados de `lib/billing/plans.ts`. **Nunca cobra**: toda compra pertenece a un evento. Sin sesión, los CTA llevan a `/sign-up?redirect_url=/dashboard/events/new?plan=…`; con sesión, directo a `/dashboard/events/new?plan=…`. Sin mockup (petición explícita del propietario) |
| `/dashboard/events/[id]` (facturación) | `(site)/dashboard/(workspace)` | 05 | Dinámico | Además del dashboard del evento: «Plan Gratis\|Esencial\|Premium» y «Disponible hasta …» de ESE evento y el botón **«Mejorar evento»** (panel con los planes y el precio de la mejora). `?upgrade=1\|essential\|premium` abre el panel (p. ej. tras crear el evento desde `/pricing`); `?payment=success` NO activa nada («Estamos confirmando tu pago…» hasta que el webhook verificado confirme; reconcilia una vez con el proveedor); `?payment=canceled` no cambia nada |
| `/dashboard/billing` | `(site)/dashboard/(workspace)` | — | Dinámico (siempre) | **Compras y planes implementados (D-32).** Sesión obligatoria. Un bloque por EVENTO del usuario: plan, «Disponible hasta …», uso (invitados y galería), historial de pagos y «Mejorar evento». Sin plan de cuenta ni contador de eventos. Vive en el menú de cuenta, no en la barra lateral |
| `/dashboard/events/new?plan=essential\|premium` | `(site)/dashboard/(workspace)` | — | Dinámico | Alta de evento con **intención de plan**: se crea el evento (nace Gratis) y se redirige a `/dashboard/events/[id]?upgrade=<plan>`. Nunca se cobra antes de tener evento |
| `/api/webhooks/stripe` | — (route handler, sin layout) | — | Dinámico (siempre) | **Webhook de Stripe (D-32).** `POST` sin sesión ni Clerk: se autentica con la firma `Stripe-Signature` sobre el cuerpo crudo. 200 procesado/repetido/ignorado · 400 firma inválida · 500 fallo al aplicar (Stripe reintenta) · 503 sin configurar. Fuente de verdad de las compras por evento (pago único). Idempotente. Ignora `customer.subscription.*`. Fuera del `matcher` del proxy |
| `/admin` | `(site)/admin` | — | Dinámico (siempre) | **Consola interna (D-33).** Solo ADMIN (`requireAdmin()`); un usuario normal recibe **404** (indistinguible de una ruta inexistente). `noindex`. Resumen: cifras del producto, eventos por plan efectivo, ingresos (solo `PAID`), acceso por vencer, archivos, salud del sistema y actividad reciente |
| `/admin/users` · `/admin/users/[id]` | `(site)/admin` | — | Dinámico | Lista (`?q=&sort=&page=`, 25 por página) y detalle (eventos con plan efectivo y compras; rol de solo lectura) |
| `/admin/events` · `/admin/events/[id]` | `(site)/admin` | — | Dinámico | Lista con filtros `?publication=draft\|published\|changes&type=&plan=&q=&sort=&page=` y detalle (propietario, plantilla, plan, acceso, conteos de invitados/RSVP, **historial de compras**; nunca datos personales de invitados) |
| `/admin/templates` | `(site)/admin` | — | Dinámico | Catálogo completo; **solo** visibilidad y plan mínimo del evento son editables (con confirmación) |
| `/admin/purchases` · `/admin/purchases/[id]` | `(site)/admin` | — | Dinámico | Lista con filtros `?status=&kind=&plan=&q=&sort=&page=` y detalle (ids del proveedor enmascarados). **Solo lectura** |
| `/admin/webhooks` | `(site)/admin` | — | Dinámico | Eventos del proveedor de pagos procesados (id parcial, tipo, fecha). Sin contenido ni firma |
| `/admin/audit` | `(site)/admin` | — | Dinámico | Auditoría (D-34): últimos cambios de administración (quién, qué, antes → después). Solo lectura |
| `/privacy` · `/terms` | `(site)/(marketing)` | — | Estático | **BORRADOR legal** (D-34): «DRAFT — requiere revisión legal antes de lanzamiento». Públicas, indexables |
| `/robots.txt` · `/sitemap.xml` | — (metadata de Next) | — | Estático / ISR 1 h | Solo marketing (home, plantillas, precios, privacidad, términos). Nunca `/i/**`, `/dashboard`, `/admin`, `/preview` |
| `/api/health` · `/api/health/ready` | — (route handlers) | — | Dinámico | Vida (`{status:ok}`) y preparación (configuración + base de datos; 200 `ready` / 503 `not_ready`). Sin datos internos |
| `/design-system` | `(site)` | — | Estático | **Ruta interna**: todos los componentes y estados. `noindex`; sin restricción de acceso todavía |
| `/sign-in` | `(site)/(auth)` | — | Dinámico | **Clerk** (`<SignIn/>` dentro del marco de Hilo Luna). Pública. `/login` redirige aquí (308) |
| `/sign-up` | `(site)/(auth)` | — | Dinámico | **Clerk** (`<SignUp/>`). Pública. `/register` redirige aquí (308) |
| `/dashboard/events` | `(site)/dashboard/(workspace)` | 05 | Dinámico | **Mis eventos** del usuario con sesión; sin eventos, estado vacío «Aún no tienes eventos» con CTA «Crear mi primera invitación» → `/templates`. Un evento recién creado aparece sin más pasos. `/dashboard` redirige aquí |
| `/dashboard/events/new` | `(site)/dashboard/(workspace)` | — | Dinámico | **Alta de eventos implementada (D-28).** Destino de «Usar esta plantilla» (`?template=<slug>`; sin sesión, `proxy.ts` conserva el destino en `redirect_url`). Asistente de 3 pasos; al terminar crea el evento (borrador) y redirige a `/dashboard/events/<id>/edit`. Plantilla desconocida → selector; `concept`/`comingSoon` → «Esta plantilla estará disponible próximamente» (sin crear nada) |

Cualquier otra URL → **404 personalizado** (verificado: `/no-existe`, `/i`, `/dashboard/events/42/otra`).

**Redirect de `/dashboard`.** El propietario indicó "`/dashboards` → `/dashboards/events`"; se interpretó como `/dashboard` → `/dashboard/events` (las rutas reales no llevan "s"). Se implementó en `next.config.ts` (`redirects()`, `permanent: false`) y no como página, de modo que ocurre antes de renderizar. Se cambiará por una portada propia si llega un mockup.

Nota de agrupación: `/dashboard/events/[id]/edit` vive en un grupo `(editor)` **distinto** de `(workspace)` porque el editor tiene su propia barra superior sin sidebar (mockup 04). Los grupos no afectan a la URL.

### 1.2 Previstas, **no** creadas todavía (fuera del alcance del scaffold)

| Ruta propuesta | Descripción | Mockup | Pendiente |
|---|---|---|---|
| `/how-it-works` · `/contact` · `/terms` | Marketing restante (navbar/footer de los mockups) | — | Q-13; nombres en inglés por coherencia con la decisión de rutas |
| `/dashboard/events/new` | Crear evento tras "Usar esta plantilla" | — | Q-13 |
| `/dashboard/events/[id]/template` | Cambiar de plantilla (reutiliza la galería) | — (item "Plantillas" en 05) | Q-06 |
| `/dashboard/events/[id]/messages` | Mensajes | — | Q-07 (sin definir) |
| `/preview/[id]` | Destino del iframe del editor: **preview privada del borrador** (D-29): exige sesión + propiedad, siempre dinámica (sin caché compartida), `noindex` | 04 | **Creada** (`(invitation)/preview/[id]`): renderiza el mismo `InvitationRenderer`; el borrador llega por `postMessage`. Lee la invitación persistida del evento; **privada**: exige sesión y que el evento sea del usuario (D-24). **No** puede llamarse `_preview`: las carpetas `_x` no son enrutables en Next |
| `/i/[slug]/opengraph-image` | Imagen para previsualizar en WhatsApp | — | Con la invitación real |
| `/api/rsvp` | POST de confirmación de invitado | — | Con RSVP |
| `/sitemap.xml`, `/robots.txt` | SEO | — | Con marketing |

Sidebar de **[05]**: Mis eventos · Plantillas · Lista de invitados · Confirmaciones · Mensajes · Configuración. Correspondencia: Mis eventos → `/dashboard/events`; Lista de invitados → `guests`; Confirmaciones → `rsvp`; Mensajes → `messages`; Configuración → `settings`. Hasta que haya cuentas, las secciones del evento apuntan al evento demo (`/dashboard/events/demo/...`); `lib/dashboard/navigation.ts` es la fuente única y un test comprueba que ningún enlace visible lleve a 404.

### 1.6 Pantalla 404

| Caso | Archivo | Aspecto |
|---|---|---|
| URL que no coincide con ninguna ruta | `app/global-not-found.tsx` (requiere `experimental.globalNotFound` en `next.config.ts`) | Producto: wordmark, eyebrow "Error 404", "Esta página *no existe*", botones "Volver al inicio" y "Ver plantillas" |
| `notFound()` dentro de rutas del producto | `app/(site)/not-found.tsx` | Igual (`NotFoundScreen`) |
| `notFound()` dentro de `/i/[slug]` (invitación no publicada o inexistente) | `app/(invitation)/not-found.tsx` | **Lenguaje de invitación** (`--inv-*`), sin enlaces al producto |

`globalNotFound` es una función **experimental** de Next 16.3; si se elimina o cambia, el 404 global volvería al de Next por defecto. El 404 no tiene mockup: se compone solo con piezas del Design System. El caso `notFound()` de invitaciones está compilado pero aún no se dispara desde ninguna ruta (no hay lógica de datos).

## 2. Slugs de invitación

Las invitaciones se sirven bajo el prefijo fijo `/i/`: un slug **no puede colisionar** con rutas del sistema, así que no hace falta lista de slugs reservados.

Reglas: minúsculas, `a-z0-9-`, 3–60 caracteres, sin guiones al inicio/fin ni dobles, único global (índice único en BD), sugerido a partir de los nombres ("andrea-fernando"). Se valida en el servicio y con un `CHECK` en BD (`DATABASE_SCHEMA` §3). Pendiente opcional: lista de moderación de slugs ofensivos o que suplanten marcas.

**Desviación consciente del mockup 05**, que muestra `lunaria.com/andrea-fernando` (nombre y forma anteriores): el componente de compartir muestra `<base>/i/<slug>` con `getPublicInvitationUrl(slug)` (`https://hiloluna.com/i/andrea-y-fernando` en producción).

## 3. Layouts

Dos **layouts raíz** independientes (cada uno con su `<html>`), lo que aísla los lenguajes visuales (regla 7; `ARCHITECTURE` D-01). Navegar entre ambos provoca carga completa de página (esperado).

| Layout | Archivo | CSS que carga | Tokens | Fuentes |
|---|---|---|---|---|
| **Raíz #1 — producto** | `app/(site)/layout.tsx` | `app/(site)/site.css` | `--lu-*` | Cormorant Garamond + Inter |
| Marketing | `app/(site)/(marketing)/layout.tsx` | — | — | — |
| Auth | `app/(site)/(auth)/layout.tsx` | — | — | — |
| Workspace | `app/(site)/dashboard/(workspace)/layout.tsx` | — | — | — |
| Admin (D-33) | `app/(site)/admin/layout.tsx` | — | — | — |
| Editor | `app/(site)/dashboard/(editor)/layout.tsx` | — | — | — |
| **Raíz #2 — invitación** | `app/(invitation)/layout.tsx` | `app/(invitation)/invitation.css` | `--inv-*` | Cormorant Garamond + Inter (defaults de Magnolia; luego por plantilla) |

Los layouts de grupo usan el componente compartido `components/layout/layout-frame.tsx` (contenedor + `<main>`); los slots de navbar, footer, sidebar y topbar se añaden con sus mockups. Verificado en build: el CSS del producto **no** se carga en `/i/[slug]` y viceversa.

## 4. Reglas de acceso (implementadas, D-24)

- **Públicas:** `/`, `/templates`, `/templates/[slug]`, `/i/[slug]` y `/i/[slug]/calendar.ics` (nunca requieren cuenta), `/pricing`, `/api/webhooks/stripe` (solo con firma válida del proveedor), `/sign-in`, `/sign-up` y los archivos estáticos.
- **Privadas:** `/dashboard/**`, `/preview/**` y `/admin/**` (D-33: además de sesión exige el rol `ADMIN` guardado en PostgreSQL, comprobado por `requireAdmin()` en cada página y acción; sin privilegios → 404). Primera barrera: `proxy.ts` (sin sesión → `/sign-in?redirect_url=<ruta>`). Segunda y decisiva: cada página comprueba sesión y **propiedad** en el servidor (`requireAuth`, `requireOwnedEvent`, `getOwned*`); un evento ajeno responde igual que uno inexistente (`404`, sin revelar que existe).
- Sin claves de Clerk: en `development` el panel abre con el usuario demo (modo demostración); en cualquier otro entorno las rutas privadas redirigen a `/sign-in`, que muestra un aviso. El alias `/dashboard/events/demo` solo existe fuera de producción y solo para el propietario del seed.
- Invitación no publicada o despublicada: `404` (no revelar existencia). **Evento de pago con el acceso vencido (D-34): `/i/[slug]` (y su enlace `?guest=`) muestra «Esta invitación ya no está disponible.» sin contenido del evento, el RSVP se rechaza y `/i/[slug]/calendar.ics` responde 404.** Las invitaciones son `noindex`, sin `Referer` y `private, no-store`.
- «Usar esta plantilla» → `/dashboard/events/new?template=<slug>`: sin sesión, el proxy lleva a `/sign-in` conservando el destino.

## 5. Parámetros de URL (previstos)

| Parámetro | Ruta | Valores |
|---|---|---|
| `category` | `/templates` | `wedding, quinceanera, baptism, birthday, baby-shower, kids` (alinear con `EventType`; ver Q-14) |
| `style` | `/templates` | slug de `TemplateStyle` |
| `section` | `/dashboard/events/[id]/edit` | id de sección seleccionada |
| `g` | `/i/[slug]` | `inviteCode` del invitado (enlace personalizado) |

## 6. SEO y metadatos

- Marketing: `title`/`description` por página, canonical, OG estático. Los títulos actuales de los placeholders están en inglés y son provisionales.
- `/templates/[slug]`: metadatos dinámicos desde el catálogo (futuro).
- `/i/[slug]`: `robots: noindex, nofollow` (**ya aplicado** en el layout de invitación); OG dinámico con nombres del evento y portada (futuro); `title` = "Andrea & Fernando — Nuestra boda".
- Nota: URLs de marketing en inglés para una audiencia hispanohablante es una decisión del propietario; tiene un coste SEO menor frente a slugs en español.
