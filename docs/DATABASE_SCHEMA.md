# DATABASE_SCHEMA — Hilo Luna

> Estado: **implementado (v1, D-22)** — `prisma/schema.prisma` es la fuente de verdad del esquema y `prisma/migrations/*_init_lunaria` la migración inicial. Motor: PostgreSQL. ORM: Prisma 6. Este documento conserva los principios, las decisiones de modelado y las formas de los JSON; **§3 resume lo implementado y §10 registra las diferencias con la propuesta original**. Relacionado con `docs/ARCHITECTURE.md` D-02, D-03, D-04, D-05, D-06, D-11, D-12, D-14, D-22.

## 1. Principios del modelo

1. **Contenido y plantilla son independientes.** `InvitationSection.content` no contiene nada visual; `Template` no contiene nada del usuario. Cambiar `Invitation.templateId` no modifica secciones (regla 16/17).
2. **Una fuente de verdad por dato.** Fecha y zona horaria → `Event`. Nombres para mostrar → contenido de la sección `COVER`.
3. **Nada se pierde en silencio.** Ocultar = `isVisible=false`. Eliminar sección/evento = *soft delete* (`deletedAt`).
4. **JSON validado y versionado.** `content`/`settings` son JSONB con esquema Zod por `BlockType` y `contentVersion` para migrar.
5. **Lo publicado es una copia.** `Invitation.publishedSnapshot` congela el documento que sirve la URL pública.
6. **Preparado para lo diferido.** `User` mínimo (el proveedor de auth añadirá sus tablas), `MediaAsset` con `storageKey`, sin tablas de pagos/analytics todavía.
7. Fechas en `timestamptz` (UTC). IDs `cuid()`.

## 2. Diagrama de relaciones

```
User 1───* Event 1───1 Invitation *───1 Template *───* TemplateStyle
             │              │                │
             │              └──* InvitationSection      Template 1──* TemplatePreviewImage
             ├──* Guest
             └──* ActivityLog *──0..1 Guest

User 1───* MediaAsset      (las secciones referencian assets por id dentro de su JSON)
```

## 3. Esquema implementado (`prisma/schema.prisma`)

No se copia aquí el esquema (evita duplicarlo): léase `prisma/schema.prisma`. Resumen:

| Modelo | Propósito | Relaciones / borrado |
|---|---|---|
| `User` | Perfil interno y propietario. `clerkUserId` (único, anulable) es la identidad externa; nunca contraseñas ni tokens | 1—* `Event`. Borrar usuario → sus eventos (cascada) |
| `Event` | Título, `slug` único, `type`, `status`, **`startsAt`** (fuente de la fecha), `endsAt?`, `timezone` | Cascada hacia todo lo que cuelga de él |
| `Template` | Metadatos del catálogo: `designStatus` (madurez) y `publicationStatus` (visibilidad), estilos, funciones, miniatura, muestra de vista previa | `Invitation.templateId` con `Restrict`: no se borra una plantilla en uso |
| `Invitation` | 1:1 con `Event` (`eventId` único), `templateId`, `slug` público único, `status`, `names`, `styleOverrides` | Cascada desde `Event` |
| `InvitationSection` | `type` (`BlockType`), `position`, `isVisible`, `settings` (encabezados/ajustes), `content` (contenido de un solo elemento) | Cascada desde `Invitation` |
| `Location`, `TimelineItem`, `GalleryImage`, `GiftRegistry` | Contenido con identidad y orden (`position`), colgado de `Event` | Cascada desde `Event` |
| `MusicSettings` | Configuración de música (1:1 con `Event`); sin reproducción real | Cascada desde `Event` |
| `GuestGroup`, `Guest` | Invitados; `Guest.status` (`RsvpStatus`) es la respuesta vigente y base de las métricas; `Guest.inviteToken` (único, no nulo) es el identificador público opaco de su enlace personalizado | `Guest.groupId` → `SetNull`; cascada desde `Event` |
| `Rsvp`, `RsvpQuestion`, `RsvpAnswer` | Respuesta de un invitado (una vigente por `guestId`), preguntas del evento y respuestas | Cascada. Las escribe el RSVP público (§13) |

Enums: `EventType`, `EventStatus`, `InvitationStatus`, `TemplateDesignStatus`, `TemplatePublicationStatus`, `TemplateStyle`, `TemplateFeature`, `BlockType`, `LocationKind`, `TimelineIcon`, `MusicSourceType`, `RsvpStatus`, `RsvpQuestionType`. **`designStatus` y `publicationStatus` son enums distintos** (madurez del diseño ≠ visibilidad comercial).

Fechas en `timestamptz`; ids `cuid()` por defecto (el seed usa ids fijos y legibles). Índices: `User.email`, `Event.slug`, `Template.slug`, `Invitation.slug` e `Invitation.eventId` únicos; `Event.ownerId`, `Guest(eventId,status)`, `Rsvp(eventId,status)`, `InvitationSection(invitationId,position)` y `(eventId,position)` en las tablas de contenido.

Qué guarda cada JSON (validado al leer, `server/mappers/json.ts`):

| Columna | Contenido |
|---|---|
| `InvitationSection.settings` | `{ eyebrow?, title?, subtitle?, align?, overlay? }` |
| `InvitationSection.content` | `COVER`→ portada; `STORY`→ historia; `DRESS_CODE`→ código de vestimenta; `RSVP`→ ajustes de RSVP; `CLOSING`→ mensaje; `GIFTS`→ `{ message, moreUrl?, photo? }` (las tiendas son filas de `GiftRegistry`); el resto `{}` |
| `Invitation.styleOverrides` | `{ [templateSlug]: { accent?, fonts? } }` |
| `Template.previewSample` / `previewScreens` | Invitación de muestra y pantallas de las miniaturas del detalle |

### Restricciones que Prisma no expresa (migración SQL manual)

- `Invitation.slug`: `CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 60)`.
- Al servirse bajo `/i/[slug]`, el slug no colisiona con rutas del sistema; no hace falta lista de slugs reservados.
- `InvitationSection.position`: sin índice único (el reordenamiento en dos fases lo complicaría); el servicio reescribe posiciones 0..n-1 en una transacción.
- Índice parcial: `CREATE INDEX ... ON "InvitationSection"(invitationId, position) WHERE "deletedAt" IS NULL`.

## 4. Decisiones de modelado que conviene tener presentes

| Tema | Decisión | Por qué |
|---|---|---|
| Fecha del evento | En `Event`, no en bloques | `DATE`, `COUNTDOWN`, dashboard ("Faltan 235 días") y `CLOSING` leen lo mismo |
| Sedes | Un bloque `LOCATION` con lista de sedes | Q-09: editor tiene una sección; la invitación muestra Ceremonia y Recepción |
| RSVP | `Guest.status` (respuesta vigente) + tabla `Rsvp` (detalle) | Métricas del dashboard = `GROUP BY status`; el detalle (acompañantes, mensaje, respuestas a preguntas) vive en `Rsvp`. Ver D-22 |
| "Mensajes" | **No modelado** | Q-07 sin definir; no se adelanta (regla 19) |
| Pagos/planes | **No modelado** | Diferido |
| Vistas/analytics | Solo primera vista por invitado (`firstViewedAt` + `ActivityLog`) | Analítica detallada llegará con la integración |
| `Template.highlightedBlocks` | Solo marketing | Todas las plantillas renderizan todos los bloques (variante `default`) |
| Música | `MUSIC` con `sourceType`; `MediaAsset` AUDIO con confirmación de derechos; `MusicTrack` para la biblioteca | Política de música: solo biblioteca/subida se reproducen; `external` = enlace |
| Prueba social | **Sin columnas** de "parejas"/"estrellas" | Q-04: el conteo real es `COUNT(Invitation WHERE templateId)`; la valoración no existe |
| Avatares de invitados | Sin foto; iniciales | Los avatares de [05] son demo |

## 5. Formas de los JSON

> **Nota (D-22):** esta sección es la propuesta original. En la implementación solo `COVER`, `STORY`, `DRESS_CODE`, `RSVP`, `CLOSING` y el encabezado de `GIFTS` viven como JSON en `InvitationSection.content`; `LOCATION`, `ITINERARY`, `GALLERY`, `GIFTS` (tiendas) y `MUSIC` son tablas. Las formas vigentes son los tipos de `types/invitation.ts` y los lectores de `server/mappers/json.ts`.

### 5.1 `InvitationSection.content` por tipo (contrato Zod, ilustrativo)

Todos incluyen `contentVersion` en columna, no dentro del JSON. Los textos opcionales tienen valor por defecto derivado de `EventType` (`invitation/sample`).

```ts
COVER      { eyebrow: string            // "Nos casamos"      máx 50  (contador 11/50, mockup 04)
             name1: string              // "Andrea"           máx 30
             name2?: string             // "Fernando"         máx 30
             tagline?: string           // "Nos encantaría celebrar contigo"
             coverImage?: AssetRef      // { assetId, focalPoint? }
             openButtonLabel: string }  // "Abrir invitación"

DATE       { headline?: string; note?: string; showTime: boolean; showAddToCalendar: boolean }
           // la fecha/hora NO están aquí: vienen de Event.startsAt

COUNTDOWN  { title?: string; labels?: { days, hours, minutes, seconds } }

LOCATION   { venues: Array<{ id, label: string /* "Ceremonia" */, name, address,
                             time?: string, mapUrl?: string, lat?: number, lng?: number,
                             image?: AssetRef }> }

STORY      { title: string; paragraphs: string[]   /* 1–3 */ }

GALLERY    { title?: string; subtitle?: string;
             images: Array<{ id, asset: AssetRef, alt: string, caption?: string }> }

ITINERARY  { title?: string; subtitle?: string;
             items: Array<{ id, time: string, title: string, icon: ItineraryIcon }> }

GIFTS      { title: string; message?: string;
             links: Array<{ id, label: string, url: string, provider?: "liverpool"|"amazon"|"sears"|"other" }> }
           // provider solo elige ícono; los logos reales dependen de Q-05

RSVP       { title: string; message?: string; buttonLabel: string;
             deadline?: string /* ISO */; allowMaybe: boolean; askDietary: boolean; askMessage: boolean }

MUSIC      { sourceType: "library" | "upload" | "external"
             trackUrl?: string          // resuelto por el servidor; nunca lo escribe el usuario
             externalUrl?: string       // solo "external", https; se muestra como enlace
             title: string; artist?: string
             autoplayAfterInteraction: boolean   // false forzado si "external"
             volume: number             // 0..1
             loop: boolean
             libraryTrackId?: string    // "library"  → MusicTrack.id
             uploadAssetId?: string }   // "upload"   → MediaAsset.id (AUDIO, rightsConfirmedAt no nulo)
           // Política y validación: ARCHITECTURE §10.1. Sin proveedores implementados.

DRESS_CODE { title: string; description?: string; palette: string[] /* hex */ }

CLOSING    { message?: string; signature?: string }
```

`AssetRef = { assetId: string }`. El snapshot publicado sustituye `AssetRef` por `{ url, width, height, alt, blurDataUrl }`.

### 5.2 `Invitation.styleOverrides`

```json
{
  "magnolia": { "accentColor": "#907058", "fonts": { "display": "Cormorant Garamond", "body": "Inter" } },
  "ivory":    { "accentColor": "#9D977D" }
}
```

Las claves de color/fuente deben pertenecer a **listas permitidas** (paleta de acentos y fuentes del selector de [04]), no a valores libres. Toda fuente de la lista debe ser open-source con uso comercial y estar registrada en `docs/ASSET_LICENSES.md` §3.

### 5.3 `InvitationSection.settings` (agnóstico de plantilla)

```json
{ "align": "center", "overlay": true }
```

Claves conocidas por bloque (esquema `settingsSchema`). Alineación: `left | center | right`. Overlay: `boolean` (mockup 04).

### 5.4 `Invitation.publishedSnapshot` (`InvitationDocument`)

```json
{
  "v": 1,
  "template": { "slug": "magnolia", "themeVersion": 1 },
  "style": { "accentColor": "#907058", "fonts": { "display": "Cormorant Garamond" } },
  "event": { "type": "WEDDING", "startsAt": "2027-05-17T18:00:00Z", "timezone": "America/Mexico_City" },
  "sections": [
    { "id": "sec_…", "type": "COVER", "settings": { "align": "center", "overlay": true }, "content": { … } }
  ]
}
```

Solo secciones visibles y no eliminadas, en orden.

## 6. Consultas clave (para dimensionar índices)

| Consulta | Uso | Índice |
|---|---|---|
| Invitación pública por `slug` | Cada visita (cacheada por ISR) | `Invitation.slug` único |
| Secciones de una invitación ordenadas | Editor / republicar | `(invitationId, position)` |
| Plantillas publicadas por categoría | Galería | `(category, status)` |
| Métricas RSVP por evento | Dashboard | `(eventId, rsvpStatus)` |
| Actividad reciente de un evento | Dashboard | `(eventId, createdAt DESC)` |
| Invitado por código | Enlace personalizado / RSVP | `Guest.inviteCode` único |
| Eventos del usuario | "Mis eventos" | `(ownerId, deletedAt)` |

Métricas del dashboard **[05]**: `Confirmados = COUNT(ATTENDING)` (y `SUM(attendeeCount)`), `Pendientes = COUNT(PENDING) + COUNT(MAYBE)`, `No asistirán = COUNT(DECLINED)`. "Faltan N días" se calcula con `Event.startsAt` y su zona horaria.

## 7. Invariantes que deben probarse

1. `changeTemplate` no altera ninguna fila de `InvitationSection` (hash de `content` y `settings` idéntico antes/después).
2. Ocultar una sección conserva su `content`.
3. Todo `content` guardado valida contra el esquema vigente de su `BlockType` (tras `migrate`).
4. Toda sección publicada en el snapshot existía visible y no eliminada al publicar.
5. `slug` cumple formato y no es reservado.
6. Un invitado solo ve/modifica su propia respuesta (por `inviteCode`).
7. `startsAt` nulo no rompe dashboard ni render (se ocultan cuenta regresiva y días restantes).
8. `MUSIC` con `sourceType = "external"` jamás produce `trackUrl` ni reproducción embebida.
9. `MUSIC` con `sourceType = "upload"` exige `MediaAsset.rightsConfirmedAt` no nulo y `disabledAt` nulo.
10. `MUSIC` con `sourceType = "library"` exige una `MusicTrack` `ACTIVE` con licencia vigente.
11. El snapshot nunca contiene pistas retiradas o deshabilitadas.

## 8. Seeds (cuando se implemente)

- `TemplateStyle`: Floral, Minimal, Elegante, Rústico, Moderno, Destination, Temático, Romántico, Natural, Infantil-*(ver Q-14)*.
- `Template`: catálogo de PROJECT_SPEC §5 (metadatos e imágenes de tarjeta; el tema vive en código).
- Datos de demo (`invitation/sample`) en código, **no** en BD, compartidos por tipo de evento.

## 9. Privacidad y retención

- Datos de invitados = datos personales: eliminación en cascada al borrar definitivamente el evento; borrado lógico primero (`Event.deletedAt`), purga programada **[PENDIENTE]**.
- `inviteCode` con ≥ 128 bits de entropía; nunca secuencial.
- No guardar IPs ni identificadores de dispositivo hasta la integración de analytics y su política de privacidad.
- Audio subido por usuarios: se conserva la constancia de aceptación de derechos (`rightsConfirmedAt`, versión del texto). Requiere términos de servicio y procedimiento de retirada (N-02, revisión legal).

## 10. Implementación real: diferencias con la propuesta original (D-22)

| Tema | Propuesta original | Implementación | Motivo |
|---|---|---|---|
| Contenido de sedes, itinerario, galería, regalos y música | JSON dentro de `InvitationSection.content` | **Tablas** `Location`, `TimelineItem`, `GalleryImage`, `GiftRegistry`, `MusicSettings` colgadas de `Event` | El dominio (`types/invitation.ts`, D-19) ya modela esas listas con identidad y orden; las tablas dan integridad, orden y borrado en cascada sin JSON |
| Propietario | `Event.ownerId` | Igual (`ownerId`) | Nombre documentado |
| Estado del evento | `deletedAt` (soft delete) | `Event.status` (`DRAFT/ACTIVE/ARCHIVED`); sin `deletedAt` | Pedido por el propietario; el soft delete queda pendiente |
| Estado de plantilla | `TemplateStatus` (`DRAFT/PUBLISHED/ARCHIVED`) | `TemplateDesignStatus` (madurez) **y** `TemplatePublicationStatus` (visibilidad) | D-20: madurez y visibilidad no se mezclan |
| Estilos de plantilla | Tabla `TemplateStyle` (N—N) | Enum `TemplateStyle` + `style` y `secondaryStyles` | Vocabulario cerrado del catálogo; sin tabla extra |
| Tipo de plantilla | `category` | `eventType` | Mismo vocabulario que `Event.type` y el parámetro `category` |
| Bloques | `BlockType` con `DATE` y `MUSIC` | `BlockType` sin `DATE` ni `MUSIC` | La fecha es de `Event` y la música es `MusicSettings`; no son secciones del producto |
| RSVP | Dentro de `Guest` | `Guest.status` + `Rsvp`, `RsvpQuestion`, `RsvpAnswer` | Pedido por el propietario; el detalle no engorda `Guest` |
| Invitados | `maxAttendees`, `inviteCode`, `groupLabel`, `dietaryNotes` | `maxCompanions`, `GuestGroup`, **`inviteToken`** (nombre final del `inviteCode` propuesto); sin `dietaryNotes` ni notas | Alinea con `RSVPSettings.maxCompanions`; el token llegó con el Guest Manager (§12) |
| Actividad | Tabla `ActivityLog` | **Derivada** de `Rsvp.submittedAt` y `Guest.firstViewedAt` | Sin analítica todavía; menos tablas |
| Slug | Solo `Invitation.slug` | `Event.slug` (referencia del panel) **y** `Invitation.slug` (URL pública) | `Event.slug` pedido por el propietario; son datos distintos |
| Publicación | `publishedSnapshot`, `snapshotVersion`, `publishedAt`, `revision`, `deletedAt` en secciones | No implementados | Fuera del alcance (aún no se publica); se añadirán con una migración |
| Medios y música | `MediaAsset`, `MusicTrack`, `TemplatePreviewImage` | No implementados | Sin storage ni proveedores; `libraryTrackId` y `uploadAssetId` son texto sin FK |
| Validación de JSON | Zod por bloque | Lectores defensivos propios (`server/mappers/json.ts`) | Zod aún no está aprobado |

Datos de demostración: el seed (`prisma/seed.ts`) los deriva de `andreaFernandoInvitation` y del catálogo de `lib/content/templates.ts` (`server/seed/demo-data.ts`). El dashboard del evento demo muestra métricas **reales** de sus 4 invitados (2 confirmados · 1 pendiente · 1 no asistirá), no las cifras del mockup (108 / 31 / 17).

## 11. Identidad y propiedad (D-24)

- **Clerk** es la identidad (credenciales, sesiones, recuperación de acceso); **`User`** es el perfil de aplicación y el propietario de los datos. `User.clerkUserId` (`String? @unique`) enlaza ambos; el email es único pero **no** es la identidad y no sirve como propiedad permanente. Es anulable solo para el usuario demo del seed (que nunca se vincula a una persona real). Migración: `add_clerk_user_identity` (aditiva).
- Se crea/vincula al primer acceso (`getOrCreateCurrentUser` → `syncUser`): por `clerkUserId`; si no existe, vinculación por email **solo** con email verificado, usuario sin `clerkUserId` y fuera del dominio reservado `@hiloluna.local`; si no, alta nueva. Ante peticiones simultáneas decide la restricción única (quien pierde relee al ganador).
- **Propiedad:** todo evento tiene `ownerId`. Cada lectura privada filtra por él en la propia consulta (`getOwned*`); no hay lecturas privadas por id sin propietario.
- **Deuda:** el email y el nombre no se resincronizan si cambian en Clerk (webhooks `user.updated`/`user.deleted` en una fase futura); tampoco hay borrado de cuenta (cuando llegue, decidir la retención de eventos e invitados).

## 12. Enlace personalizado del invitado: `Guest.inviteToken` (D-25)

- **Identificador público opaco.** Cada invitado tiene un `inviteToken` (texto, **único, no nulo**) que se usará en su enlace `/i/<slug>?guest=<token>`. **Nunca se usa `Guest.id` en una URL pública**, y el token no guarda relación con el id ni con los datos de la persona.
- **Generación:** en el servidor, con `crypto.randomBytes(24)` en base64url (192 bits, 32 caracteres); nunca `Math.random()` ni un valor del cliente. Es **estable**: no se regenera al editar ni desde la interfaz (regenerarlo rompería los enlaces ya enviados; si algún día hace falta, será una acción explícita y consciente).
- **Migración `add_guest_invite_token` (aditiva y segura):** la columna nace anulable, se rellena en las filas existentes con dos UUID v4 sin guiones (`gen_random_uuid()`, nativo desde PostgreSQL 13; 244 bits) y solo entonces pasa a `NOT NULL` con índice único. Sin borrados. El seed conserva los tokens que ya existen (no los regenera en cada ejecución); el demo usa un token determinista derivado por hash (solo datos de demostración).
- **Alcance actual:** solo se genera, se guarda y se muestra/copia en el Guest Manager; la invitación pública **todavía no lee** `?guest=` (llegará con el RSVP público). Un token válido no da acceso a nada más que a esa invitación.
- **Propiedad:** toda operación de invitados filtra por `event.ownerId` en la propia consulta (también `updateMany`/`deleteMany`) y comprueba que el grupo pertenezca al mismo evento. Borrar un invitado elimina en cascada su `Rsvp` y respuestas.

## 13. RSVP público persistente (D-26)

- **Sin migración:** el RSVP usa las restricciones que ya existían: `Rsvp.guestId` **único** (un invitado = una respuesta, se actualiza), `RsvpAnswer(rsvpId, questionId)` **único** y `RsvpQuestion.eventId`.
- **Fuente de verdad del estado:** `Rsvp.status` es la respuesta persistente y `Guest.status` es el estado **vigente** del invitado (lo que cuentan el dashboard y el Guest Manager). Se escriben **juntos, en la misma transacción, y solo por `writeGuestResponse`** (`server/repositories/guest-response.ts`), que usan el RSVP público y la edición manual del Guest Manager: no puede haber divergencias silenciosas. El anfitrión puede fijar el estado a mano sin que exista `Rsvp` (`Guest.status` solo); en ese caso la persona ve su estado sin cifra de asistentes.
- **Semántica de `attendeeCount`: incluye al invitado principal.** `maxCompanions = 2` ⇒ máximo **3** asistentes. `ATTENDING` → entero de 1 a `1 + maxCompanions` (con `maxCompanions = 0`, siempre 1); `DECLINED` → **0** (se descarta cualquier valor anterior); `MAYBE`/`PENDING` → `null` (no cuenta como confirmado). El servidor no confía en ningún límite enviado por el cliente.
- **Métricas:** `ATTENDING` → confirmado · `DECLINED` → no asistirá · `PENDING`, `MAYBE` o sin respuesta → pendiente (`summarizeRsvp`, una sola lógica). El Guest Manager muestra «N asistentes» junto a un invitado confirmado.
- **Mensaje:** texto plano, máximo 500 caracteres; se eliminan etiquetas HTML y caracteres de control antes de guardar.
- **Preguntas:** `RsvpQuestion` (`TEXT`, `CHOICE`, `BOOLEAN`) del evento; una respuesta solo vale si la pregunta pertenece al mismo evento del invitado; las obligatorias se exigen al confirmar asistencia. El seed no incluye preguntas (el sistema funciona sin ellas). No hay columna de restricciones alimentarias: será una `RsvpQuestion` configurable.
- **Codificación:** la base de datos debe ser **UTF8** (emojis en los mensajes). En Windows, PostgreSQL puede crearse en `WIN1252` con la configuración regional por defecto: créala con `ENCODING 'UTF8'`.

## 14. Archivos gestionados: `MediaAsset` (D-27)

- **Tres capas separadas:** el **binario** vive en el almacenamiento de objetos (S3 compatible; `server/storage`), los **metadatos** en `MediaAsset` y la **referencia** dentro de la invitación es una FK (`Invitation.coverMediaId`, `GalleryImage.mediaAssetId`, `Location.mediaAssetId`, todas `ON DELETE SET NULL`). Ningún binario entra en PostgreSQL.
- **`MediaAsset`:** `id`, `ownerId` (User, cascada), `eventId?` (Event, cascada), `type` (`IMAGE`), `storageKey` (**único**), `mimeType`, `originalFilename` (solo informativo, sanitizado), `sizeBytes`, `width?`, `height?`, `status` (`PENDING` → `READY` → `DELETED`), marcas de tiempo. Índices `(ownerId)` y `(eventId, status)`.
- **No se guarda ninguna URL** (ni firmada ni pública): se deriva de `storageKey` + `S3_PUBLIC_BASE_URL` (`server/storage/public-url.ts`). Pasar a `media.hiloluna.com` (o de `r2.dev` a un dominio propio) no requiere migrar datos.
- **Clave opaca:** `users/<userId>/events/<eventId>/<32 hex aleatorios>.<jpg|png|webp>`. `userId`/`eventId` son ids internos (cuid), nunca correo ni nombre; la extensión sale del tipo REAL verificado, no del nombre subido. **Reemplazar una imagen crea una clave nueva** (las claves son inmutables ⇒ caché `public, max-age=31536000, immutable` sin invalidaciones).
- **Estático vs propio:** `GalleryImage.src` es ahora **nullable**. Una fila tiene `src` (asset estático de la plantilla en `/public`, p. ej. Magnolia) **o** `mediaAssetId` (imagen del usuario); no se crean `MediaAsset` falsos para los PNG del repositorio. La exclusividad se garantiza en código (mapper y servicio), no con un `CHECK`. En `Location`, la imagen propia manda sobre `imagePath`; en `Invitation`, sin portada propia se usa `heroBackdrop` de la plantilla (`/templates/magnolia/cover-bg.png` en Magnolia).
- **Propiedad:** cada consulta lleva `ownerId` y `eventId` (y `event.ownerId`) en el `where`; el cliente nunca envía `ownerId`, `storageKey`, tipo ni tamaño verificados. Un archivo ajeno es indistinguible de uno inexistente.
- **Migración:** `20260925191254_add_media_assets` (aditiva; solo relaja `GalleryImage.src`).

### 14.1 Política de imágenes públicas y privacidad

- Las imágenes de una invitación son **públicas por diseño** (las ve cualquier invitado con el enlace). Política: el bucket **no** permite listado (solo lectura de objeto por clave), las claves son **imposibles de adivinar** (128 bits aleatorios) y nunca aparecen en índices públicos; la invitación `/i/[slug]` es `noindex`. Quien conozca la URL exacta puede verla; no se publica ninguna URL fuera de la invitación.
- **EXIF/GPS:** el original se conserva **sin reprocesar**, de modo que una foto con ubicación GPS la conserva en el archivo público. Se respeta la orientación EXIF para las dimensiones, pero **no se eliminan metadatos** (no hay procesado de imagen en esta fase). **Deuda técnica** (antes de producción abierta): reprocesar en el servidor (p. ej. re-codificar a WebP y quitar EXIF) o avisar en la interfaz.
- **Derechos:** las imágenes subidas por el usuario son suyas y no se registran en `docs/ASSET_LICENSES.md` (ese registro es de activos de terceros del producto). Los términos de servicio futuros deberán recoger que el usuario declara tener derecho sobre lo que sube y concede a Hilo Luna licencia para alojarlo y mostrarlo. Sin moderación en esta fase.

### 14.2 Deudas y límites conocidos (D-27)

1. **Huérfanos:** un archivo `PENDING` (subida iniciada y abandonada) o `READY` sin referencias (fallo al borrar en el bucket) permanece hasta que exista un **trabajo de limpieza** (p. ej. borrar `PENDING` de más de 24 h y `READY` sin referencias). Ambos se pueden identificar con `status` + ausencia de referencias.
2. **Borrar un evento no borra sus objetos:** la cascada de Prisma elimina las filas `MediaAsset`, **pero no puede borrar los objetos en S3**. Un futuro `deleteEvent`/borrado de cuenta debe listar las claves del evento (`users/<userId>/events/<eventId>/`) y borrarlas del almacenamiento **antes** de borrar las filas.
3. **Sin deduplicación** ni cuotas por usuario/evento ni limitación de tasa de subidas (`createImageUpload`): pendiente antes de producción.
4. **Tamaño real:** la URL firmada no fija `Content-Length` (R2 no admite políticas POST con rango). El tamaño se verifica al finalizar (HEAD) y un objeto excesivo se borra; hasta entonces un cliente malicioso puede subirlo al bucket durante minutos.
5. **Persistencia del editor:** son reales la portada, la galería (alta, baja, orden, texto alternativo) y la imagen de las sedes **ya guardadas**; el resto del contenido del editor sigue simulado (`Modo demostración`). Las sedes nuevas creadas en el editor aún no existen en la BD, por eso su imagen sigue siendo vista previa local.

### 14.3 Configuración del bucket (Cloudflare R2)

- **Variables** (`.env.example`): `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (solo servidor) y `S3_PUBLIC_BASE_URL` (dominio público de lectura, p. ej. `https://media.hiloluna.com`; sin barra final).
- **Permisos mínimos del token de API:** *Object Read & Write* limitado **a ese bucket** (sin permisos de administración ni de otros buckets). La aplicación usa Put, Head, Get (rango) y Delete de objetos.
- **Lectura pública:** dominio personalizado del bucket (recomendado) o `r2.dev`; **sin listado** de objetos.
- **CORS del bucket** (necesario para el PUT directo del navegador): orígenes `https://hiloluna.com`, `https://www.hiloluna.com` y `http://localhost:3000` (y el de previsualización que se use); métodos `PUT`, `GET`, `HEAD`; cabeceras permitidas `Content-Type`, `Cache-Control` (o `*`); `MaxAgeSeconds` 3600.

## 15. Alta de eventos y contenido inicial (D-28)

- **Migración aditiva** (`20260926090000_event_type_graduation`, `20260926090100_event_type_other`): el enum `EventType` gana `GRADUATION` y `OTHER` (una migración por valor: `ALTER TYPE … ADD VALUE` no admite varios en una transacción en versiones antiguas de PostgreSQL). `KIDS` se conserva: es la categoría de las plantillas infantiles del catálogo, no un tipo del onboarding. Sin más cambios de esquema.
- **Tipos de evento del onboarding:** `WEDDING`, `QUINCEANERA`, `BAPTISM`, `BIRTHDAY`, `BABY_SHOWER`, `GRADUATION`, `OTHER`. El dominio usa su vocabulario en minúsculas (`wedding`, `baby-shower`…; `eventTypeToDb`) y las etiquetas salen de `lib/events/event-types.ts` (única fuente).
- **Transacción de creación** (`server/repositories/event-creation.ts` → `writeEventAggregate`): `Template` (comprobada DENTRO de la transacción) → `User` propietario → `Event` → `Invitation` → `InvitationSection` (10) → `Location` → (`TimelineItem`, `GalleryImage`, `GiftRegistry`, `MusicSettings`, `Guest`, `Rsvp` vacíos). Todo o nada: si una escritura falla, Prisma revierte la transacción; un `P2002` sobre `slug` se traduce a `SlugTakenError` y el servicio reintenta con otro sufijo.
- **Estado inicial: borrador.** `Event.status = DRAFT` e `Invitation.status = DRAFT`. `/i/[slug]` solo sirve invitaciones `PUBLISHED`, así que un evento recién creado NO es público (responde 404) hasta que exista la publicación real (fuera de alcance de D-28). El botón «Publicar» del editor sigue siendo demostrativo.
- **Slugs:** `Event.slug` (referencia del panel, p. ej. `andrea-fernando`) e `Invitation.slug` (URL pública, p. ej. `andrea-y-fernando`) se generan por separado en el servidor (`lib/events/slug.ts`): normalizados (minúsculas, sin acentos, `a-z0-9-`, 3–60), sin el prefijo reservado `demo-` (`/i/demo-<plantilla>`), y únicos con sufijo `-2`, `-3`… (la unicidad definitiva la impone el índice único). El slug público NO es un secreto: la protección de cada invitado sigue siendo su `inviteToken`.
- **Compatibilidad plantilla ↔ tipo:** `Template.eventType` es el tipo que soporta (Magnolia = `WEDDING`); una plantilla solo se puede usar si `publicationStatus = PUBLISHED`, `designStatus = IMPLEMENTED` y el tipo coincide (`lib/events/template-compat.ts`; la consulta de la transacción lo repite). No hay campo `supportedEventTypes`: se añadirá cuando una plantilla soporte varios tipos (basta ampliar `supports`).
- **Contenido inicial** (`lib/events/default-invitation.ts`, `createDefaultInvitationData`): copy neutro y corto por tipo; secciones en el orden aprobado (`COVER, STORY, COUNTDOWN, LOCATION, ITINERARY, GALLERY, DRESS_CODE, GIFTS, RSVP, CLOSING`), todas visibles; sedes vacías (`name = ""`), itinerario, galería y mesa de regalos vacíos; `DRESS_CODE.content` con estilo/descripción vacíos; RSVP habilitado (2 acompañantes, «Tal vez» permitido, sin preguntas); **sin `MusicSettings`** (equivale a «Sin música»; no hay columna `enabled`); sin `MediaAsset` (la portada usa el `heroBackdrop` de la plantilla). La invitación pública **no dibuja** las secciones sin contenido suficiente (sede sin nombre, itinerario/galería vacíos, dress code y regalos vacíos); el editor las muestra con un aviso discreto.
- **Snapshot de plantilla:** sigue siendo deuda. `Invitation` referencia la plantilla ACTUAL por `templateId` (sin snapshot ni versionado); si una plantilla cambia, sus invitaciones cambian con ella.
- **Deudas de D-28:** idempotencia con clave (hoy solo se evita el doble envío en la interfaz y el reintento por slug); (resuelto en D-29: el editor ya guarda todo de verdad) el editor guardaba de forma simulada todo salvo las imágenes (D-27): los cambios de texto de un evento nuevo aún no se persisten; el enlace de «Compartir» de un borrador lleva a un 404 hasta que exista la publicación; límite de eventos por usuario.

## 16. Borrador vs. publicado y guardado real del editor (D-29)

- **Migración aditiva** `20260926120000_add_publication_snapshots`: columnas nuevas en `Invitation` (`draftRevision` 1, `publishedRevision` 0, `publishedVersion` 0, `publishedAt?`, `lastPublishedAt?`) y la tabla `InvitationPublication`. Sin `migrate reset`; las filas existentes quedan con los valores por defecto.
- **Modelo de estado:** las tablas del evento (`Event`, `Invitation`, `InvitationSection`, `Location`, `TimelineItem`, `GalleryImage`, `GiftRegistry`, `MusicSettings`) SON el **borrador**; el editor solo escribe ahí. Lo **público** es un snapshot en `InvitationPublication` (`snapshot` JSON, `version`, `isCurrent`, `templateSlug`, `mediaAssetIds[]`); `/i/[slug]` lee únicamente el snapshot vigente (`isCurrent`). `Invitation.status` (`DRAFT`/`PUBLISHED`/`UNPUBLISHED`) sigue siendo el interruptor de visibilidad. No se mezcla con `Template.publicationStatus` (visibilidad del catálogo) ni con el estado de guardado del editor.
- **Revisiones:** `draftRevision` sube con cada cambio del borrador (guardado del editor y operaciones de imágenes). `publishedRevision` guarda la revisión que se publicó; **«Cambios sin publicar» = `draftRevision > publishedRevision`** (estado derivado en `lib/publishing/state.ts`: `draft` · `published` · `changes`). Una invitación `PUBLISHED` sin publicaciones (`publishedVersion = 0`, datos anteriores a D-29) se considera publicada sin cambios pendientes y se lee del borrador hasta que se republique o se repita el seed.
- **Concurrencia (guardado):** control optimista por `draftRevision`. El cliente envía `baseRevision`; el servidor hace compare-and-set (`updateMany where draftRevision = base`) en la misma transacción: si el borrador avanzó (otra ventana) responde `conflict` y **no** escribe. Guardado, operaciones de imágenes y publicación comparten una cola en el cliente (`SyncQueue`), así que ninguna sale con una revisión vieja. Límite conocido: dos ventanas del mismo evento no se fusionan; la segunda debe recargar.
- **Guardado real:** `saveOwnedDraft` actualiza en UNA transacción evento (título derivado de los nombres, fecha, zona), invitación (nombres, estilos, plantilla si es elegible), secciones (orden como posiciones 0..n-1, visibilidad, encabezados, contenido), sedes (crear, editar, eliminar, reordenar), itinerario y mesa de regalos (por id, no por índice), música (solo configuración) y, de la galería, solo texto alternativo/pie/orden. Las imágenes (portada, sedes, galería) NO viajan por aquí: siguen siendo operaciones propias (D-27) que ahora devuelven la nueva revisión. Una sede eliminada suelta su imagen (se libera solo si nada más la usa).
- **Snapshot** (`types/published.ts`, `lib/publishing/snapshot.ts`): contenido, secciones, sedes, itinerario, galería, regalos, música y **configuración del RSVP**; plantilla con `slug`, un identificador estable de versión (`templateVersionId`, hash del tema) y la **configuración de tema completa** (si Magnolia cambia mañana, lo ya publicado se dibuja como se publicó); archivos por `storageKey` + `mediaAssetId` (nunca una URL: se deriva al leer; los `blob:` y las URL externas no se publican). **No incluye** propietario, correo, ids de Clerk ni datos de invitados. El RSVP **vivo** (invitados, respuestas, preguntas) no es parte del snapshot: el contexto del invitado y las respuestas se leen de la BD en cada petición; la configuración publicada (plazo, máximo de acompañantes, mensaje) sale del snapshot.
- **Publicar** (`publishOwnedInvitation`, una transacción): comprueba propiedad y la revisión esperada → compare-and-set de `publishedVersion` (doble petición = una sola versión) → construye el snapshot → marca la versión vigente anterior `isCurrent = false`, crea la nueva → `Invitation.status = PUBLISHED`, `publishedRevision`, `lastPublishedAt` (`publishedAt` solo la primera vez) → `Event.status = ACTIVE`. Un error de validación aborta y revierte todo. El slug no cambia. Mínimo publicable: nombre(s), fecha/zona válidas y plantilla válida; **no** se exige contenido opcional.
- **Versiones:** se conservan todas las publicaciones (`version` 1, 2, 3…, base de un rollback futuro sin UI). Solo la vigente protege sus archivos.
- **Retención de archivos:** `MediaAsset.countReferences` cuenta borrador + publicación vigente (`mediaAssetIds`). Un archivo publicado no se borra físicamente aunque el borrador ya no lo use; tras publicar una versión que ya no lo referencia (y sin referencias en el borrador) se libera. Rollback a una versión anterior podría encontrar archivos ya eliminados: conocido y documentado.
- **Deudas de D-29:** sin fusión de ediciones concurrentes; sin rollback ni despublicar (fuera de alcance); las versiones antiguas no se purgan; la página pública es dinámica (`force-dynamic`) y el snapshot se lee en cada petición: una caché por `slug + versión` para peticiones sin invitado queda pendiente; el aviso de salida usa `beforeunload` (no cubre la navegación interna del router).

## 17. Facturación: compras por evento (D-32, sustituye a D-31)

Migraciones aditivas `20260926130000_add_billing` (D-31: `BillingCustomer`, `Subscription`, `WebhookEvent`, `Template.minimumPlan`) y `20260926140000_event_purchases` (D-32: `EventPurchase`, `Event.paidAccessEndsAt`). Ninguna borra ni renombra nada; sin `migrate reset`.

**Modelo comercial: un pago único por evento, sin renovación.** El plan pertenece al EVENTO. Los planes NO están en la base de datos: son producto, en `lib/billing/plans.ts` (precios, moneda, límites y features).

- **`EventPurchase`** — una compra de un plan para UN evento. Una fila por **sesión de cobro** (`(provider, providerCheckoutSessionId)` único: idempotencia). Campos: `eventId`, `userId` (propietario en el momento de la compra), `provider`, `providerPaymentIntentId?`, `plan` (`Plan`: el plan que concede), `kind` (`INITIAL` = primera compra; `UPGRADE` = Esencial → Premium, solo la diferencia), `status` (`PENDING`, `PAID`, `FAILED`, `REFUNDED`, `CANCELED`), `amount` (**centavos**, `Int`), `currency` (ISO 4217, hoy `MXN`), `paidAt`, `accessStartsAt`, `accessEndsAt`. Solo `PAID` concede el plan. **El plan efectivo del evento es el mayor plan de sus compras `PAID`**; sin ninguna → `FREE` (no hay filas FREE). Una mejora es OTRA fila: el historial financiero no se sobrescribe (Esencial 49900 PAID + Premium/UPGRADE 30000 PAID → Premium). Se crea `PENDING` al iniciar el checkout y pasa a `PAID` solo desde el webhook verificado. Relaciones con `Event` y `User`: **`Restrict`** (el historial financiero no se borra en cascada; el borrado de eventos/cuentas, aún fuera de alcance, deberá tratarlo explícitamente). Nunca guarda datos de tarjeta.
- **`Event.paidAccessEndsAt`** — fin del acceso de un evento de pago: `max(compra + 30 días, fecha del evento + 30 días, fin actual)`. Solo crece: mover el evento hacia adelante lo extiende (se actualiza dentro de la transacción del guardado del borrador), hacia atrás nunca lo acorta. `null` = evento Gratis. Hoy solo se persiste (`getEventAccessState`: `free | active | expired`); no se cierra la invitación ni se borra nada.
- **`BillingCustomer`** — el cliente del proveedor por usuario, única tabla con esa referencia (`(userId, provider)` y `(provider, providerCustomerId)` únicos). Se crea de forma perezosa en el primer checkout y se **reutiliza** en todas las compras de la persona (un cliente de Stripe + N compras por evento).
- **`WebhookEvent`** — idempotencia: `(provider, externalEventId)` único, `type`, `processedAt`. Se inserta con `INSERT … ON CONFLICT DO NOTHING` en la MISMA transacción que aplica el evento; si aplicar falla, se revierte y el proveedor reintenta. No guarda el cuerpo.
- **`Template.minimumPlan`** (`Plan`, por defecto `FREE`) — plan mínimo de EVENTO para usar la plantilla; independiente de `designStatus` y `publicationStatus`. Magnolia: `FREE`.
- **`Subscription` (LEGACY)** — de D-31 (suscripción mensual por usuario). **Sin uso**: ningún código la lee ni la escribe (un test lo comprueba) y no se convierte en compras (no sabemos a qué evento correspondería). Se conserva la tabla, junto con `SubscriptionStatus` y `BillingInterval`, para no destruir datos de prueba en silencio; se eliminará con una migración explícita cuando se confirme que está vacía.
- **Enums**: `BillingProvider` (`STRIPE`; `MERCADO_PAGO` reservado), `Plan`, `PurchaseStatus`, `PurchaseKind`.
- **Uso por evento** (`server/repositories/usage.ts`): invitados = filas `Guest` del evento (los acompañantes permitidos no cuentan); galería = filas `GalleryImage` del evento (la portada y las imágenes de sedes no cuentan). **No existe conteo de eventos por cuenta.** Deuda: no hay cuota por GB de almacenamiento.
- **Bajar o perder un plan no borra nada**: ningún código de facturación ni de límites elimina eventos, invitaciones, invitados, RSVP, publicaciones ni archivos (un test lo verifica); solo se bloquea AÑADIR por encima del límite del evento.
- **Preparado para Admin** (no implementado): por evento se puede leer su plan, sus compras, importes y `paidAt` con una sola consulta (`findEventBillingById`).

## 18. Consola de administración: `User.role` y campos editables de plantilla (D-33)

Migración aditiva `20260926150000_user_role`: `CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN')` y `ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER'`. No borra, renombra ni actualiza filas: **todos los usuarios existentes quedan `USER`** (nadie se asciende automáticamente). Sin `migrate reset`.

- **`User.role`** (`UserRole`, por defecto `USER`) — rol INTERNO. Solo lo lee `requireAdmin()` (`findUserRole`); la única forma de ascender a alguien es cambiarlo a mano en la base de datos (`docs/ADMIN.md` §2). No hay tabla de permisos ni de auditoría. El usuario demo del seed sigue siendo `USER`.
- **Campos de `Template` que la consola puede cambiar**: `publicationStatus` (`PUBLISHED` visible, `DRAFT` oculta, `ARCHIVED` archivada) y `minimumPlan` (plan mínimo del EVENTO). **No** puede cambiar `name`, `slug` ni `designStatus`. Ocultar no afecta a las invitaciones publicadas (leen su snapshot) ni impide republicarlas; cambiar `minimumPlan` no toca eventos existentes. El seed fija ambos solo al crear la plantilla.
- **Lo que la consola lee** (sin columnas nuevas): `User`, `Event`, `Invitation` (estado y revisiones), `InvitationPublication` (solo metadatos, nunca `snapshot`), `Guest` y `Rsvp` (**solo conteos**), `MediaAsset` (conteo, tamaño, huérfanos), `EventPurchase`, `BillingCustomer` (solo si existe), `WebhookEvent` (id, tipo, fecha). `Subscription` (legacy) no se lee.
- **Filtros por plan efectivo** (`eventPlanWhere`): «existe una compra `PAID` del plan (salvo Gratis) y no existe una `PAID` de un plan superior», la misma regla que `getEffectiveEventPlan`. **Filtros de publicación** (`eventPublicationWhere`): las reglas de `derivePublicationState` comparando `draftRevision` y `publishedRevision` de `Invitation`.
- **Preparado, no implementado**: registro de auditoría de acciones de administración y gestión de roles desde la interfaz.

## 19. Preproducción: auditoría, índices y restricciones (D-34)

Migración aditiva `20260926160000_preproduction_hardening`. No borra, renombra ni actualiza datos; las restricciones CHECK son `NOT VALID` (rigen para filas nuevas o modificadas sin revisar las antiguas). Sin `migrate reset`.

- **`AdminAuditLog`** — `id`, `adminUserId` (FK `Restrict` a `User`), `action` (`template.update`), `entityType` (`Template`), `entityId`, `before` / `after` (JSON con SOLO los campos cambiados: `publicationStatus`, `minimumPlan`), `createdAt`. Índices: fecha, `(entityType, entityId)`, administrador. Solo se inserta (dentro de la transacción del cambio); sin datos personales ni secretos.
- **Índices nuevos** (cada uno con su consulta): `WebhookEvent(processedAt)` (listado de la consola, más recientes primero), `EventPurchase(createdAt)` (listado y ordenación de la consola), `User(createdAt)` (idem), `Event(paidAccessEndsAt)` (eventos de pago por vencer/vencidos), `MediaAsset(status, createdAt)` (detección de huérfanos). Ya existían y no se tocan: `Guest.inviteToken` (único), `Invitation.slug` (único), `InvitationPublication(invitationId, isCurrent)`, `(invitationId, version)` único. No hay índices trigram para la búsqueda por texto (`contains`): se añadirán cuando el volumen lo justifique.
- **Unicidad nueva**: `EventPurchase(provider, providerPaymentIntentId)` (un pago pertenece a UNA sesión de cobro; los NULL no chocan). Sustituye al índice simple anterior.
- **Restricciones CHECK** (Prisma no las modela; no provocan deriva en `migrate diff`): `EventPurchase.amount >= 0`, `currency` de 3 letras mayúsculas, `status = PAID ⇒ paidAt` no nulo; `Guest.maxCompanions >= 0`; `Rsvp.attendeeCount` nulo o ≥ 0; `Invitation` (`draftRevision >= 1`, `publishedRevision >= 0`, `publishedVersion >= 0`); `InvitationPublication.version >= 1`; `MediaAsset.sizeBytes >= 0`; `Event.endsAt` nulo o ≥ `startsAt`.
- **Índice único parcial** `InvitationPublication_one_current_per_invitation` (`WHERE "isCurrent"`): a lo sumo UNA publicación vigente por invitación.
- **Estados y órdenes**: los estados son enums de PostgreSQL (no texto libre). No se impone unicidad de `position` (el editor reordena y una restricción provocaría fallos transitorios); el orden lo mantiene la transacción de guardado.
- **Política de eliminación**: ver `docs/OPERATIONS.md` §7 (por qué `Restrict` en `EventPurchase` y `AdminAuditLog` bloquea el borrado de eventos/usuarios con compras).
- **Tabla `Subscription` (legacy)**: sigue sin uso. Verificación: `SELECT count(*) FROM "Subscription";`. Si es 0, se puede eliminar con una migración explícita (`docs/OPERATIONS.md` §6); no se elimina en esta fase.
