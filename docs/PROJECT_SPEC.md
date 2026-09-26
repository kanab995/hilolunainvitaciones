# PROJECT_SPEC — Hilo Luna

> Estado: **borrador v0.1 — Fase 0**. Derivado de los 6 mockups de `design/reference/` y del brief inicial. Todo lo que no aparece en un mockup está marcado como **[INFERIDO]** o **[PENDIENTE]**.

Leyenda de procedencia: **[MOCKUP nn]** observado directamente · **[INFERIDO]** deducido, requiere validación · **[PENDIENTE]** sin definir, requiere decisión.

---

## 1. Visión

Plataforma SaaS para que cualquier persona, sin conocimientos de diseño, cree una invitación digital elegante, la personalice, la comparta (WhatsApp, redes, enlace) y gestione la asistencia de sus invitados. Tono: cálido, romántico, editorial. Público inicial: LatAm hispanohablante (México) **[INFERIDO]** por la copy ("Valle de Guadalupe", "Liverpool", Mercado Pago mencionado en el brief).

Propuesta de valor visible **[MOCKUP 01]**: "Tu evento merece una invitación inolvidable" · sin conocimientos de diseño · RSVP · música · galería · cuenta regresiva.

## 2. Tipos de usuario

| Rol | Descripción | Superficie |
|---|---|---|
| Visitante | Explora marketing y plantillas | Marketing |
| Anfitrión (owner) | Crea eventos, edita, publica, gestiona invitados | Dashboard + Editor |
| Invitado | Abre el enlace, ve la invitación, confirma asistencia | Invitación pública |
| Admin/Equipo de diseño **[PENDIENTE]** | Publica plantillas | Fuera de alcance por ahora |

## 3. Módulos

1. **Marketing** — home, galería de plantillas, detalle de plantilla, cómo funciona, precios, contacto, términos. Solo home, galería y detalle tienen mockup.
2. **Motor de invitaciones** — modelo de bloques + registro de plantillas + renderizador único.
3. **Editor** — lista lateral de secciones (reordenar, visibilidad, agregar), panel de edición por sección, vista previa móvil/escritorio en tiempo real, guardado automático, publicar.
4. **Dashboard del evento** — cabecera del evento, métricas de RSVP, accesos rápidos, actividad reciente.
5. **Invitados y RSVP** — lista, estados, confirmaciones, enlaces.
6. **Cuenta / Auth / Pagos / Storage / Email / Analytics** — **diferidos** (solo puntos de extensión).

## 4. Catálogo de bloques (secciones de invitación)

Cada bloque es reutilizable y tiene: esquema de contenido (Zod), valores por defecto, formulario de editor, componente de render con variantes.

| Bloque (`BlockType`) | Editor **[MOCKUP 04]** | Render **[MOCKUP 06]** | Notas |
|---|---|---|---|
| `COVER` Portada | ✔ "Nombres y foto principal" | ✔ Tarjeta con arco, nombres, botón "Abrir invitación" | Título/frase, nombre 1, nombre 2, imagen, alineación, estilo de texto, acento, overlay. El botón "Abrir invitación" es el gesto de usuario que habilita la música. |
| `DATE` Fecha | ✔ "Día, hora y frase" | ✘ sin sección visible propia en Magnolia; la fecha aparece en la portada (`17 · 05 · 27`) y el cierre | La fecha canónica vive en el **Evento**. El bloque guarda frase, mostrar hora y botón "Agregar al calendario". No genera sección propia en Magnolia (N-03). |
| `COUNTDOWN` Cuenta regresiva | ✔ | ✔ "Faltan 142 · 08 · 24 · 16" | Lee la fecha del Evento. Sin contenido propio salvo etiquetas. |
| `LOCATION` Ubicación | ✔ "Dirección y mapa" | ✔ **dos** tarjetas: Ceremonia y Recepción, con "Cómo llegar" | **Decidido:** un bloque con **lista de sedes**; la plantilla renderiza una tarjeta por sede. |
| `STORY` Historia | ✔ "Nuestra historia" | ✔ "Nuestra historia" | Título + 1–3 párrafos. |
| `GALLERY` Fotos | ✔ "Galería de momentos" | ✔ "Nuestros momentos" (mosaico) | Lista ordenada de imágenes con alt. |
| `ITINERARY` Itinerario | ✔ "Orden del evento" | ✔ línea de tiempo con íconos (Ceremonia, Cóctel, Cena, Fiesta, Brindis) | Lista de hitos: hora, título, ícono. |
| `GIFTS` Regalos | ✔ "Mesa de regalos" | ✔ "Tu presencia es nuestro mejor regalo" + enlaces | Ver Q-05. |
| `RSVP` | ✔ "Confirmación de asistencia" | ✔ "Confirma tu asistencia" + botón | El formulario de confirmación **no tiene mockup** (Q-13). |
| `MUSIC` Música | ✔ "Canción especial" | ✘ sin sección visible; control flotante de reproducción | Política de música vigente (§4.1): `sourceType` = `library`, `upload` o `external`. Solo arquitectura, sin proveedores. |
| `DRESS_CODE` Dress code | ✔ **añadido al editor** (decisión) | ✔ "Formal y elegante" + paleta + ilustración | Aparece en la lista del editor y en "Agregar sección". Formulario **sin mockup**; ícono por aprobar. |
| `CLOSING` Cierre | ✔ **añadido al editor** (decisión) | ✔ "Andrea & Fernando · Gracias por ser parte de nuestra historia" | Aparece en la lista del editor y en "Agregar sección". Formulario **sin mockup**; ícono por aprobar. |
| Agregar al calendario | ✘ | ✘ (solo en **[MOCKUP 01]** como feature) | **[INFERIDO]** acción dentro de `DATE`/`LOCATION`, no bloque propio. |

"Agregar sección" **[MOCKUP 04]** implica que el usuario puede añadir bloques. El selector de bloques no tiene mockup. Ningún bloque admite varias instancias por defecto (las varias sedes van dentro de `LOCATION`); `allowMultiple` queda disponible en el contrato de bloque para el futuro.

**Orden por defecto** de una invitación nueva **[INFERIDO, N-04]**: sigue el orden de lectura del invitado en [06] — Portada · Fecha · Historia · Cuenta regresiva · Ubicación · Itinerario · Fotos · Dress code · Regalos · RSVP · Cierre · Música. Es dato del usuario y se puede reordenar. El editor [04] muestra otro orden porque es una invitación de ejemplo; el paginador "1 / 10" del mockup pasa a ser "1 / N" dinámico (N = 12 por defecto).

### 4.1 Política de música (decidida)

- **Prohibido:** Spotify Web Playback SDK, streaming de Spotify dentro de Hilo Luna, reproductores ocultos de YouTube como audio de fondo.
- **Fuentes soportadas por la arquitectura:** (1) biblioteca de música licenciada por Hilo Luna, (2) audio subido por el usuario que confirma tener los derechos, (3) enlace externo opcional (Spotify, YouTube u otra URL) — **solo enlace**.
- **Reproducción de fondo:** únicamente con (1) o (2).
- **Configuración (`MusicSettings`):** `sourceType: "library" | "upload" | "external"`, `trackUrl`, `externalUrl`, `title`, `artist`, `autoplayAfterInteraction`, `volume`, `loop`.
- **Inicio de reproducción:** solo tras interacción del usuario ("Abrir invitación").
- **Alcance ahora:** solo arquitectura y esquema. **No** se implementan proveedores de música.


## 5. Catálogo inicial de plantillas **[MOCKUP 02/03]**

| Slug | Categoría | Estilos |
|---|---|---|
| magnolia | Boda | Floral, Romántica |
| ivory | Boda | Minimal, Elegante |
| etoile (Étoile) | XV años | Elegante |
| tuscany | Boda | Rústico |
| noir | Boda | Moderno |
| blossom | Bautizo | Floral |
| riviera | Boda | Destination |
| dream | XV años | Temático |
| safari | Baby Shower | Infantil |
| peonia (Peonía) | Boda | Romántica, Floral — solo en 03 |
| eucalipto | Boda | Natural, Moderna — solo en 03 |

**Estado de cada plantilla** (`status`, `docs/ARCHITECTURE.md` §4.9 y D-20):

| Slug | Estado | Qué significa para el usuario |
|---|---|---|
| magnolia | `implemented` | Invitación completa diseñada [06]; demo pública `/i/demo-magnolia`; se puede usar |
| ivory, etoile | `concept` | Tema provisional; detalle con vista previa básica (solo portada) y aviso de vista conceptual; **sin enlace a demo**; la invitación completa no está diseñada |
| tuscany, noir, blossom, riviera, dream, safari | `comingSoon` | Solo tarjeta; el detalle muestra "Próximamente" y "Usar esta plantilla" está deshabilitado; sin demo ni tema |

Toda plantilla del catálogo tiene página `/templates/[slug]` (nunca 404). Las únicas demos públicas implementadas son `/i/demo-magnolia`; `/i/demo-ivory` y `/i/demo-etoile` existen temporalmente solo para probar que el mismo contenido funciona con otro tema y **no se enlazan** desde la interfaz hasta aprobar sus diseños.

Solo **Magnolia** tiene invitación completa diseñada (06). Las demás solo existen como *tarjeta de galería*: su tema, decoraciones y variantes **están por diseñar**. Implica que la primera entrega del motor se valida con Magnolia y, como mínimo, una segunda plantilla de estética distinta (p. ej. Noir) para probar la independencia contenido/plantilla.

## 6. Flujos principales

1. **Descubrir → elegir**: Home → Galería (filtros por categoría/estilo) → Detalle → "Usar esta plantilla".
2. **Crear evento**: "Usar esta plantilla" / "Crear invitación" → (auth, diferido) → crear Evento + Invitación con contenido de ejemplo → Editor. **[INFERIDO]** el paso intermedio de datos básicos (tipo, nombres, fecha) no tiene mockup.
3. **Editar**: elegir sección → editar → vista previa en vivo → autoguardado ("Guardado hace unos segundos").
4. **Publicar**: "Publicar" → invitación disponible en su URL pública **[PENDIENTE]** compuerta de plan/pago.
5. **Compartir**: enlace `hiloluna.com/i/<slug>` (`getPublicInvitationUrl`), WhatsApp, Instagram **[MOCKUP 05]**.
6. **Confirmar (invitado)**: abre enlace → "Abrir invitación" → recorre → "Confirmar asistencia".
7. **Gestionar**: Dashboard → métricas (Confirmados / Pendientes / No asistirán), lista, actividad reciente.
8. **Cambiar de plantilla**: desde detalle/editor; el contenido se conserva (regla 17).

## 7. Alcance

**Dentro del proyecto (visión)**: todo lo anterior.

**Fuera de la Fase 0 y de las primeras tareas de código**: auth, storage real de imágenes, email/recordatorios, pagos, analytics, admin de plantillas, i18n, dominios personalizados, edición colaborativa, plantillas más allá de las necesarias para validar el motor.

## 8. Requisitos no funcionales

- **Rendimiento (invitación pública)**: móvil de gama media en 4G. LCP objetivo < 2.5 s. Imágenes optimizadas (AVIF/WebP, tamaños responsivos, `priority` solo en portada). Las decoraciones florales son imágenes pesadas → presupuesto por plantilla.
- **SEO**: marketing indexable; invitaciones `noindex` por defecto (privacidad) con Open Graph propio para previsualización en WhatsApp.
- **Privacidad**: datos de invitados (nombres, teléfonos, respuestas) son personales; acceso solo por owner; enlaces de invitado con token no adivinable.
- **Accesibilidad**: AA, `prefers-reduced-motion`, navegación por teclado en editor.
- **Robustez del editor**: autoguardado con control de concurrencia; nunca perder contenido al cambiar de plantilla o al ocultar/eliminar una sección sin confirmar.
- **Seguridad**: validación Zod en toda entrada; rate limiting en RSVP público (diferido pero previsto); sin HTML arbitrario en contenido (solo texto/rich-text acotado).

## 9. Contradicciones y huecos

### 9.1 Resueltas (decisión del propietario, 2026-09-24)

| ID | Tema | Decisión | Dónde quedó reflejada |
|---|---|---|---|
| Q-01 | URL pública | **`/i/[slug]`** (desviación consciente del mockup 05, que muestra `/andrea-fernando`) | `ROUTES` · `ARCHITECTURE` D-10 · `COMPONENTS` (`SharePanel`) |
| Q-02 | Tipografías | Solo open-source comercial: **Cormorant Garamond** (display) + **Inter** (UI), auto-alojadas con `next/font` | `DESIGN_SYSTEM` §3.2 · `ASSET_LICENSES` §3 |
| Q-03 | Música | Política §4.1 (biblioteca / subida con derechos / enlace externo; sin Spotify SDK ni YouTube oculto; solo tras interacción) | `ARCHITECTURE` §10, D-14 · `DATABASE_SCHEMA` |
| Q-04 | Prueba social falsa | **Omitir** hasta que sean datos reales | `COMPONENTS` (`SocialProof` diferido) |
| Q-09 | Ubicación | Un bloque `LOCATION` con lista de sedes | §4 · `DATABASE_SCHEMA` |
| Q-10 | Secciones que faltaban en el editor | `DRESS_CODE` y `CLOSING` se **añaden** al editor y a "Agregar sección" | §4 · `COMPONENTS` |
| Q-08 | "Tal vez" en RSVP | Cuenta como **Pendiente** | `DATABASE_SCHEMA` §6 |
| Q-16 | Producción de assets | Política de assets y registro obligatorio de licencias | `ASSET_LICENSES` |

Matiz de Q-08: el dashboard [05] no cambia (sigue mostrando Confirmados / Pendientes / No asistirán). Distinguir cuántos "Pendientes" son "Tal vez" solo es posible en la pantalla de Confirmaciones, que aún no tiene mockup.

### 9.2 Abiertas

Prioridad: 🔴 antes de escribir la primera pantalla · 🟠 antes de la funcionalidad afectada · 🟡 menor.

| ID | Pri | Tema | Detalle | Recomendación (a validar) |
|---|---|---|---|---|
| Q-05 | 🟠 | Logos de terceros | Liverpool, Amazon, Sears (mockups 01/06), WhatsApp/Instagram (01/05). | Íconos genéricos; logos solo con decisión legal. |
| Q-06 | 🟠 | Alcance del sidebar | **[05]** "Lista de invitados / Confirmaciones / Mensajes": ¿globales o del evento activo? "Plantillas": ¿galería pública o cambio de plantilla? | Navegación **por evento**; "Plantillas" = cambio de plantilla reutilizando la galería. |
| Q-07 | 🟠 | "Mensajes" | ¿Mensajes de invitados a los anfitriones o recordatorios enviados a invitados (email/WhatsApp, diferido)? | No modelar hasta definir. |
| Q-11 | 🟠 | Personalización de estilo | **[04]** acento, fuentes, overlay y alineación aparecen dentro de "Portada". ¿Globales o por sección? | `DATABASE_SCHEMA` §5: overrides de invitación **por plantilla** + `settings` por sección. |
| Q-12 | 🟠 | Escritorio | **[04]** tiene toggle "Escritorio"; no existe diseño de invitación en escritorio. | Provisional: columna móvil centrada. Requiere diseño. |
| Q-13 | 🟠 | Pantallas sin mockup | Cómo funciona, Precios, Contacto, Términos, Entrar, formulario RSVP, lista de invitados, confirmaciones, mensajes, configuración, selector "Agregar sección", **formularios de editor de las 11 secciones no-Portada**, menú hamburguesa de la invitación, lightbox, flujo publicar/compartir, estados vacío/carga/error, versiones móviles de marketing/dashboard/editor. | Solicitar mockups o autorizar composición mínima con componentes existentes (regla 5). |
| Q-13a | 🟡 | Editor móvil | RESPONSIVE §5 dejaba < 768 px "sin diseño". **Implementada la propuesta mínima** (lista → sección + «Vista previa» fija a pantalla completa) para poder editar desde teléfono; **pendiente de validar con diseño**. En el editor, «Fecha» y «Música» son filas de datos fijas y la portada/cierre no se reordenan (ver ARCHITECTURE §4.10). | Validar con quien produjo los mockups. |
| Q-14 | 🟡 | Categorías | La galería **[02]** no tiene chip "Cumpleaños" (sí existe en **[01]**). "Infantil" es categoría (chip) y estilo (tarjeta Safari). | Añadir Cumpleaños; `Infantil` solo como categoría. **Provisional en `/templates`:** se respeta [02] (chips Todas · Bodas · XV años · Infantil · Bautizo · Baby Shower, sin Cumpleaños) y Safari conserva el estilo "Infantil"; el chip "Infantil" agrupa el tipo `kids` **y** el estilo infantil para no quedar vacío. `?category=birthday` (enlace de la home) es válido y muestra el estado sin resultados hasta que exista el chip/plantillas de cumpleaños. |
| Q-15 | 🟡 | Botones | **[03]**: CTAs grandes con etiqueta serif; **[01/04/05]**: sans. | Variante `size="xl" font="serif"` exclusiva del detalle de plantilla. |
| Q-17 | 🟡 | Idioma | Solo español en los mockups. | Solo español; textos centralizados. |
| Q-18 | 🟠 | Publicación | ¿"Publicar" exige plan/pago? | Snapshot publicado (D-06); compuerta diferida. |
| Q-19 | 🟡 | Evento vs invitación | ¿Varias invitaciones por evento? | 1 a 1 en MVP, sin bloquear 1 a N. |
| Q-20 | 🟡 | Paginador del preview | **[04]** "‹ 1 / 10 ›": ¿salta a sección o pagina? | Scroll continuo + salto a sección. |
| **N-01** | 🟠 | **Biblioteca musical licenciada** | La política exige "biblioteca licenciada de Hilo Luna", pero no existe proveedor ni pistas. Sin ella, `library` no tiene contenido y solo funcionan `upload` y `external`. | Decidir proveedor/licencia (música con licencia comercial y de sincronización) antes de activar la opción. Mientras tanto la UI de música solo ofrece lo disponible. |
| **N-02** | 🟠 | **Subida de audio: responsabilidad legal** | El usuario "confirma tener los derechos". Hilo Luna necesita términos de servicio, texto de confirmación y procedimiento de retirada. | Requiere revisión legal; la confirmación queda registrada (`rightsConfirmedAt`). |
| **N-03** | 🟡 | **`DATE` y `MUSIC` sin sección visible** | En Magnolia [06] ninguna de las dos se ve como sección. | `DATE` alimenta portada/cierre y el botón de calendario; `MUSIC` es un control flotante. Otras plantillas podrán dar a `DATE` una variante visible. |
| **N-04** | 🟡 | **Orden por defecto** | El editor [04] y la invitación [06] muestran órdenes distintos. | Orden de §4 (lectura del invitado). |
| **N-05** | 🟡 | **Reproductor de la maqueta de marketing [01]** | Muestra "Perfect · Ed Sheeran" y carátula con logotipo. | Reemplazar por pista y carátula propias/neutras (`ASSET_LICENSES` §7). |
| **N-06** | 🟡 | **Cormorant vs. mockups** | Cormorant Garamond es más fina y de menor altura-x que la serif de los mockups; los titulares se verán distintos. | Calibrar tamaño (+10–15 %) y peso (500–600) comparando con el mockup. Desviación aceptada por la política de tipografía. |
| ~~**Q-21**~~ | ✅ | `/dashboard` vs `/dashboard/events` | **Resuelto por el propietario:** `/dashboard` redirige (307) a `/dashboard/events`. | Ver `ROUTES` §1.1. Se reabrirá si llega un mockup de portada del dashboard. |
| **Q-22** | 🟡 | Rutas del scaffold vs. propuesta previa | Las rutas del propietario no incluyen `messages`, `events/new`, cambio de plantilla ni las páginas de marketing restantes. | Se crean con su mockup (`ROUTES` §1.2). |
| **Q-23** | 🟡 | Ubicación del dominio de invitaciones | El scaffold no tiene `src/`; `invitation/` (bloques, plantillas, tema, renderizador) y `server/` no se crearon (sin lógica). | Proponer ambos en la raíz al implementarlos; confirmar entonces (`ARCHITECTURE` D-16). |

## 10. Supuestos de trabajo

- Un solo idioma (es-MX), una sola zona horaria por evento (guardada como IANA), fechas en UTC en BD.
- Las plantillas son artefactos de diseño **versionados en código** (revisión + deploy), no editables por usuarios.
- El contenido de demo para previsualizar plantillas es genérico por tipo de evento y **compartido** entre plantillas.

## 11. Glosario

- **Evento**: la celebración (fecha, tipo, dueño). Fuente de verdad de fecha y zona horaria.
- **Invitación**: documento visual del evento (secciones + plantilla + slug + estado).
- **Sección / Bloque**: unidad de contenido reutilizable (`BlockType`).
- **Plantilla**: identidad visual (tema, variantes de bloque, decoraciones). No contiene contenido del usuario.
- **Tema**: tokens visuales de una plantilla.
- **Variante**: manera alternativa de renderizar un bloque dentro de una plantilla.
- **Snapshot publicado**: copia inmutable del contenido resuelto que sirve la URL pública.
