# ASSET_LICENSES — Hilo Luna

> Registro de procedencia y licencias de **todo** activo de terceros o generado que llegue a producción (fuentes, imágenes, audio, íconos, ilustraciones).
> **Regla de oro (CLAUDE.md):** no se introduce ningún activo de terceros sin registrar aquí su licencia **antes** de mergear.

Última revisión: 2026-10-02 · Estado: **2 fuentes, dependencias de código, 10 imágenes de la plantilla Magnolia (§5.1), 10 imágenes de la plantilla Level 12 (§5.2), 11 imágenes de la plantilla Aurora XV (§5.3), 11 imágenes de la plantilla Celeste (§5.4), 10 imágenes de la plantilla Spider Friends (§5.5) y 10 imágenes de la plantilla Baby Bloom (§5.6); ningún audio ni ícono propio.** Se eliminaron los SVG de demostración de Next/Vercel y no se incluye favicon.

---

## 1. Políticas vigentes

### 1.1 Tipografía
- Solo fuentes **de código abierto con uso comercial permitido** (SIL OFL 1.1 o equivalente) durante el MVP.
- **Display principal:** Cormorant Garamond. **UI principal:** Inter.
- Auto-alojadas mediante la optimización de fuentes de Next.js (`next/font`), sin peticiones a CDN de terceros en tiempo de ejecución.
- **Prohibido** añadir fuentes de pago o propietarias sin aprobación explícita.
- Toda fuente nueva (incluidas las que se ofrezcan al usuario en el selector del editor) se registra en §3 antes de usarse.

### 1.2 Producción de assets visuales
- La dirección visual y los assets originales los produce ChatGPT bajo dirección del propietario del proyecto.
1. Preferir assets **originales generados específicamente para Hilo Luna**.
2. **No** raspar ni copiar imágenes de competidores, Pinterest, Instagram, Google Imágenes ni otros sitios.
3. La fotografía solo puede provenir de: fotografía propia del usuario · fotografía de stock con licencia adecuada · imaginería original generada.
4. Todo activo de terceros debe tener derechos de uso comercial **documentados**.
5. La procedencia se registra en este archivo.

### 1.3 Música
- No se usa Spotify Web Playback SDK ni se transmite contenido de Spotify dentro de Hilo Luna.
- No se usan reproductores ocultos de YouTube como audio de fondo.
- Reproducción de fondo **solo** con: (a) audio de la biblioteca licenciada de Hilo Luna, o (b) audio subido por el usuario que confirme tener los derechos.
- Enlaces externos (Spotify, YouTube, otra URL) son **solo enlaces**.
- Detalle técnico: `docs/ARCHITECTURE.md` §10 y `docs/DATABASE_SCHEMA.md` (`MusicTrack`, `MediaAsset.rightsConfirmedAt`).

### 1.4 Los mockups no son assets de producción
Los archivos de `design/reference/` son **referencia visual**. No se copian a `public/`, no se sirven, no se recortan para producción. Las imágenes que aparecen en ellos (flores, tarjetas, teléfonos, personas) deben **regenerarse/producirse** como assets propios bajo §1.2 y registrarse aquí. Marcas de terceros dentro de los mockups (Liverpool, Amazon, Sears, WhatsApp, Instagram, Spotify, carátula de canción) tampoco se reproducen (ver `PROJECT_SPEC` Q-05).

---

## 2. Formato del registro

Campos obligatorios por activo: **nombre · fuente · autor/proveedor · licencia · URL de origen · fecha de obtención**. Campos adicionales: uso en el proyecto y notas.

Para **imaginería generada**: en "fuente" indicar la herramienta/modelo; en "autor/proveedor" quién la dirigió; en "licencia" los términos de uso comercial del generador vigentes en la fecha; en "URL" el enlace a esos términos; y en notas un identificador del *prompt* o brief (guardado fuera del repo o en `docs/assets-briefs/`).

Estado: `pendiente` (planeado, no incorporado) · `activo` · `retirado`.

---

## 3. Tipografías

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Uso | Estado / notas |
|---|---|---|---|---|---|---|---|
| Cormorant Garamond | Google Fonts (vía `next/font/google`, auto-alojada en build) | Christian Thalmann (Catharsis Fonts) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Cormorant+Garamond | 2026-09-24 (scaffold; descargada en build por `next/font/google`) | Display principal: titulares del producto y de la plantilla Magnolia por defecto | `activo`. **Pendiente:** verificar contra el `OFL.txt` oficial y anotar el copyright exacto |
| Inter | Google Fonts (vía `next/font/google`, auto-alojada en build) | Rasmus Andersson | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Inter | 2026-09-24 (scaffold; descargada en build por `next/font/google`) | UI principal y cuerpo | `activo`. **Pendiente:** verificar contra el `OFL.txt` oficial y anotar el copyright exacto |
| Playfair Display | Google Fonts | Claus Eggers Sørensen | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Playfair+Display | *(al incorporarla)* | Opción del selector de fuentes del editor (aparece en el mockup 04) | `pendiente` — solo si se mantiene en el selector |
| Montserrat | Google Fonts | Julieta Ulanovsky y colaboradores | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Montserrat | *(al incorporarla)* | Opción del selector de fuentes del editor (aparece en el mockup 04) | `pendiente` — solo si se mantiene en el selector |

> Nota: la autoría y el tipo de licencia son los publicados por Google Fonts a la fecha de la última revisión; **deben comprobarse contra el archivo `OFL.txt` y los metadatos reales** al incorporar cada fuente, y corregirse aquí si difieren.

**Obligaciones OFL a respetar:** conservar el aviso de copyright y la licencia con la fuente; no vender la fuente por sí sola; no usar el "Nombre de Fuente Reservado" para versiones modificadas. Auto-alojar en el propio build cumple con el uso permitido.

Fuentes adicionales necesarias para plantillas futuras (Noir, Safari, Riviera…) se añaden a esta tabla antes de usarse, y deben cumplir §1.1.

---

## 4. Íconos y dependencias de UI de terceros

Aunque no son "assets visuales" en sentido estricto, se registran por trazabilidad. Licencias **leídas de los `package.json` instalados** (2026-09-24).

| Nombre | Versión | Fuente | Autor/proveedor | Licencia | URL | Fecha | Estado |
|---|---|---|---|---|---|---|---|
| lucide-react (íconos) | 1.48.0 | npm | Eric Fennis / Lucide Contributors | ISC | https://github.com/lucide-icons/lucide | 2026-09-24 | `activo` (instalado con shadcn; aún sin uso) |
| shadcn (CLI y `shadcn/tailwind.css`) | 4.21.0 | npm | shadcn | MIT | https://github.com/shadcn-ui/ui | 2026-09-24 | `activo` |
| cn (utilidad de clases) | 0.4.0 | npm | shadcn (mantenedor verificado en npm) | MIT | https://github.com/shadcn-ui/cn | 2026-09-24 | `activo` |
| radix-ui | 1.6.7 | npm | Radix UI | MIT | https://github.com/radix-ui/primitives | 2026-09-24 | `activo` |
| class-variance-authority | 0.7.1 | npm | Joe Bell | Apache-2.0 | https://github.com/joe-bell/cva | 2026-09-24 | `activo` |
| tw-animate-css | 1.4.0 | npm | Luca Bosin | MIT | https://github.com/Wombosvideo/tw-animate-css | 2026-09-24 | `activo` |
| Next.js / React / React DOM | 16.3.6 / 19.2.8 | npm | Vercel / Meta | MIT | https://github.com/vercel/next.js · https://github.com/react/react | 2026-09-24 | `activo` |
| Tailwind CSS | 4.3.3 | npm | Tailwind Labs | MIT | https://github.com/tailwindlabs/tailwindcss | 2026-09-24 | `activo` |
| TypeScript | 5.9.3 | npm | Microsoft | Apache-2.0 | https://github.com/microsoft/TypeScript | 2026-09-24 | `activo` (dev) |
| ESLint | 9.39.5 | npm | ESLint | MIT | https://github.com/eslint/eslint | 2026-09-24 | `activo` (dev) |

Nota: el código de componentes de shadcn/ui que se copie a `components/ui/` es MIT. El scaffold **no** incluyó ningún componente (se eliminó el `Button` genérico generado porque su estilo no proviene de los mockups).

---

## 5. Imágenes

**Incorporadas: 10 imágenes de Magnolia (§5.1).** Categorías previstas (cada una se registra como fila propia al producirse):

Fuente:
ChatGPT / OpenAI image generation

Autor/proveedor:
OpenAI — generado bajo dirección del propietario de Hilo Luna

Términos:
OpenAI Terms of Use — Output ownership

URL:
https://openai.com/policies/terms-of-use/

Fecha:
2026-09-24

| Categoría | Origen previsto | Notas |
|---|---|---|
| Héroe de home, banners CTA, escenas de plantilla | Imaginería original generada | Ver §1.2. Registrar herramienta, términos y brief |
| Tarjetas de categoría (Bodas, XV años, Bautizos…) | Imaginería original generada | Evitar personas reconocibles reales |
| Miniaturas/escenas por plantilla (tarjeta de galería y detalle) | Imaginería original generada | Una por plantilla |
| Decoración floral/ornamentos (PNG/WebP con transparencia) | Imaginería original generada o vectores propios | Cuidar coherencia y peso |
| Fotografías de ejemplo dentro de invitaciones demo | Generadas o stock con licencia comercial | Sin retratos de personas reales sin autorización |
| Fotos subidas por usuarios | **Propiedad del usuario** | Ver términos de servicio (pendiente): el usuario declara tener derechos |

**Assets pendientes de la Homepage** (`TODO(asset): replace with approved Hilo Luna asset`; hoy son placeholders con escenas difusas hechas con tokens (CSS), sin ningún archivo de imagen en el repo):

| Dónde | Asset esperado | Componente / dato |
|---|---|---|
| Hero | Fotografía de fondo: telas y flores claras, luz suave | `Hero` (`MediaSlot` de fondo) |
| Hero, detalle de plantilla y miniaturas | Flores/decoración de las esquinas y fotografías de las pantallas de la invitación de muestra (portada, historia, detalles, galería) | `preview-screens.tsx` |
| Categorías (6) | Bodas, XV años, Bautizos, Cumpleaños, Baby Shower, Infantiles | `eventCategories[].imageSrc` en `lib/content/home.ts` |
| Así de fácil | Miniaturas de invitaciones y foto del editor | `how-it-works-visuals.tsx` |
| Funciones | Miniaturas de galería, carátula del reproductor, mapa | `feature-demos.tsx` |
| Plantillas (home y galería `/templates`) | Una escena por plantilla (9): Magnolia, Ivory, Étoile, Tuscany, Noir, Blossom, Riviera, Dream, Safari (Noir en fondo oscuro) | `templates[].thumbnail.src` en `lib/content/templates.ts` |
| Detalle `/templates/[slug]` | Escena tras el teléfono (flores y piedra), una por plantilla | `TemplateDetail` (`MediaSlot` de fondo, tono de `template.thumbnail`) |
| Galería `/templates` | Fotografía del héroe: flores y tarjeta de invitación sobre tela | `PageHero` (`MediaSlot` de fondo) |
| Banner final | Rosas claras sobre tela | `FinalCta` |
| Invitación (`/i/[slug]`) de Ivory y Étoile | Fondo de portada, decoración y fotografías propias de cada plantilla (hoy placeholders difusos con los colores del tema). **Magnolia ya tiene los suyos (§5.1)** | `lib/invitation/templates/{ivory,etoile}.ts` (`decor`) |
| Mesa de regalos | **Sin logos de terceros** (Liverpool, Amazon, Sears): se usa texto provisional hasta documentar su licencia (Q-05) | `featureDemo.gifts` |
| Música | La demo muestra el texto "Perfect · Ed Sheeran" **sin carátula ni reproducción** (indicado por el propietario para la maqueta); sustituir por una pista de la biblioteca propia cuando exista (N-01/N-05) | `featureDemo.music` |

Plantilla de fila:

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Usado en | Estado / notas |
|

### 5.1 Imágenes incorporadas — plantilla Magnolia (invitación pública `/i/demo-magnolia`)

Registradas **antes** de usarse en código. Archivos originales, sin modificar (no se generan versiones derivadas: Next.js optimiza en tiempo de ejecución con `next/image`). Comprobado por `tests/invitation/assets.test.ts`: todo `/templates/magnolia/*` referenciado existe y está listado aquí.

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Usado en | Estado / notas |
|---|---|---|---|---|---|---|---|
| cover-bg.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | `lib/invitation/templates/magnolia.ts` → `decor.heroBackdrop`; lo dibuja `HeroSection` (única imagen con `priority`) | `activo` · 941 × 1672 · `public/templates/magnolia/cover-bg.png` · Fondo de la portada de Magnolia: pared cálida con magnolias, hojas y pétalos; centro despejado para el texto |
| ceremony-chapel.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `locations[ceremony].photo` en `lib/invitation/mock/andrea-fernando.ts` → `LocationSection` | `activo` · 1122 × 1402 · `public/templates/magnolia/ceremony-chapel.png` · Capilla de piedra con arcos y arreglos florales al atardecer |
| reception-hacienda.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `locations[reception].photo` → `LocationSection` | `activo` · 1122 × 1402 · `public/templates/magnolia/reception-hacienda.png` · Patio de hacienda con mesas, luces cálidas y enredaderas floridas |
| gallery-couple.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `gallery[0]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/magnolia/gallery-couple.png` · Pareja de espaldas caminando por una calle empedrada entre flores (personas generadas, no reales) |
| gallery-bouquet.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `gallery[1]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/magnolia/gallery-bouquet.png` · Ramo de magnolias y rosas |
| gallery-rings.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `gallery[2]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/magnolia/gallery-rings.png` · Anillos dorados sobre una piedra con pétalos |
| gallery-table.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `gallery[3]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/magnolia/gallery-table.png` · Mesa con vajilla, velas y flores |
| dress-code.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `dressCode.illustration` → `DressCodeSection` | `activo` · 1122 × 1402 · `public/templates/magnolia/dress-code.png` · Ilustración de acuarela de una pareja con vestimenta formal (ilustración, no fotografía real; rostros sin rasgos) |
| gift-registry.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | Datos demo: `giftRegistry.photo` → `GiftRegistrySection` | `activo` · 1122 × 1402 · `public/templates/magnolia/gift-registry.png` · Caja de regalo con moño rosa y magnolias |
| decor-corners.png | ChatGPT / OpenAI image generation | OpenAI — generado bajo dirección del propietario de Hilo Luna | OpenAI Terms of Use — Output ownership | https://openai.com/policies/terms-of-use/ | 2026-09-24 | `lib/invitation/templates/magnolia.ts` → `decor.section*` (fragmentos `tl` `tr` `bl` `br`) → `Decor` | `activo` · 1254 × 1254 (PNG con transparencia) · `public/templates/magnolia/decor-corners.png` · Cuatro esquinas florales (magnolias) en una sola hoja; se usan fragmentos por posicionamiento CSS, sin crear archivos nuevos |

Notas comunes: generadas por ChatGPT (OpenAI) bajo dirección del propietario de Hilo Luna; los términos de OpenAI vigentes a la fecha asignan la titularidad de la salida al usuario (verificar de nuevo si cambian). Los *briefs/prompts* no se guardan en el repo. Las personas de `gallery-couple.png` y `dress-code.png` son generadas (no retratos reales) y `dress-code.png` es una ilustración. Los archivos pesan ~2 MB cada uno (PNG); `next/image` sirve versiones WebP redimensionadas.

---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

### 5.2 Imágenes incorporadas — plantilla Level 12 (invitación pública `/i/demo-level-12`)

Registradas **antes** de usarse en código. Reemplazan una versión anterior (composición vectorial propia hecha por el asistente) por imágenes de estilo cinematográfico generadas bajo dirección del propietario de Hilo Luna. Cuatro de los diez archivos (`cover-bg.png`, `gallery-1.png`, `gallery-5.png`, `dress-code.png`) se recibieron con un logotipo de calzado real visible y el asistente los **retocó localmente** (difuminado/relleno de la zona del calzado con `sharp`, sin ningún servicio externo) antes de incorporarlos, para no mostrar marcas de terceros; `decor-corners.png`, `location-arena.png` y `gallery-2.png`–`gallery-4.png`/`gift-registry.png` se incorporan tal como se recibieron. Comprobado por `tests/invitation/assets.test.ts`: todo `/templates/level-12/*` referenciado existe y está listado aquí.

> **Nota de revisión (verbatim, a petición del propietario):** "Level 12 demo assets are custom-generated/edited cinematic demo images for Hilo Luna. They were reviewed to avoid visible third-party logos, registered game characters, console marks, or copyrighted game assets."
>
> En español: son imágenes de demostración cinematográficas, generadas/editadas a medida para Hilo Luna. Se revisaron una por una (con acercamiento sobre el calzado y las zonas de marca) para evitar logotipos de terceros visibles, personajes de videojuego registrados, marcas de consola o elementos de videojuego con derechos de autor; donde se encontró uno (ver arriba), se retocó antes de aceptarse.

Fuente, autor/proveedor y licencia son los mismos para las diez filas (repetidos por fila, mismo formato que §5.1, campos obligatorios de §2). La URL queda sin valor porque la generación no proviene de un sitio o API con términos públicos consultables desde este registro; es responsabilidad del propietario conservar la evidencia de origen de la herramienta que usó.

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Usado en | Estado / notas |
|---|---|---|---|---|---|---|---|
| cover-bg.png | Imagen generada por IA, bajo dirección del propietario; retocada localmente por el asistente (relleno/difuminado con `sharp`) para quitar un logotipo de calzado real | Propietario de Hilo Luna (generación) + asistente (retoque de marcas) | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | `lib/invitation/templates/level-12.ts` → `decor.heroBackdrop`; lo dibuja `HeroSection` (única imagen con `priority`) | `activo` · 1122 × 1402 · `public/templates/level-12/cover-bg.png` · Fondo de la portada, estilo cinematográfico: festejado en fiesta gamer/neón con letrero "12"; **se difuminó el logotipo visible en ambos tenis** |
| decor-corners.png | Imagen generada por IA, bajo dirección del propietario | Propietario de Hilo Luna | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | `lib/invitation/templates/level-12.ts` → `decor.section*` (fragmentos `tl` `tr` `bl` `br`) → `Decor` | `activo` · 1254 × 1254 (PNG con transparencia) · `public/templates/level-12/decor-corners.png` · Cuatro cúmulos 3D (globos, regalos, controles) en una sola hoja; se usan fragmentos por posicionamiento CSS, sin crear archivos nuevos; sin marcas visibles |
| location-arena.png | Imagen generada por IA, bajo dirección del propietario | Propietario de Hilo Luna | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `locations[0].photo` en `lib/invitation/mock/santiago-level-12.ts` → `LocationSection` | `activo` · 1448 × 1086 · `public/templates/level-12/location-arena.png` · Salón de fiestas con gabinetes de arcade GENÉRICOS (sin pantallas de juegos reales), barra, sillones y pista; sin marcas visibles |
| gallery-1.png | Imagen generada por IA, bajo dirección del propietario; retocada localmente por el asistente (relleno/difuminado con `sharp`) para quitar tres marcas de calzado real (dos tenis, tres zonas) | Propietario de Hilo Luna (generación) + asistente (retoque de marcas) | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `gallery[0]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/level-12/gallery-1.png` · Festejado con control de videojuego genérico sentado con amigos en un gabinete de arcade; **se difuminaron tres marcas de calzado reales** (swoosh y un emblema de talón en dos tenis distintos) |
| gallery-2.png | Imagen generada por IA, bajo dirección del propietario | Propietario de Hilo Luna | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `gallery[1]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/level-12/gallery-2.png` · Mesa de dulces y snacks con galletas con forma de control, estilo neón; sin marcas visibles |
| gallery-3.png | Imagen generada por IA, bajo dirección del propietario | Propietario de Hilo Luna | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `gallery[2]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/level-12/gallery-3.png` · Festejado junto al pastel de cumpleaños con velas y letrero "12"; sin marcas visibles |
| gallery-4.png | Imagen generada por IA, bajo dirección del propietario | Propietario de Hilo Luna | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `gallery[3]` → `GallerySection` | `activo` · 1402 × 1122 · `public/templates/level-12/gallery-4.png` · Mesa de dulces (macarons, paletas de chocolate, dulces) vista de cerca; sin marcas visibles |
| gallery-5.png | Imagen generada por IA, bajo dirección del propietario; retocada localmente por el asistente (relleno/difuminado con `sharp`) para quitar un logotipo de calzado real | Propietario de Hilo Luna (generación) + asistente (retoque de marcas) | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `gallery[4]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/level-12/gallery-5.png` · Festejado bailando entre amigos que aplauden; **se difuminó el logotipo visible en un tenis** |
| dress-code.png | Imagen generada por IA, bajo dirección del propietario; retocada localmente por el asistente (relleno/difuminado con `sharp`) para quitar un logotipo de calzado real | Propietario de Hilo Luna (generación) + asistente (retoque de marcas) | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `dressCode.illustration` → `DressCodeSection` | `activo` · 1122 × 1402 · `public/templates/level-12/dress-code.png` · Fotografía de producto (plano cenital) de la ropa y el calzado sugeridos: sudadera, chamarra, pantalón y tenis; **se difuminó el logotipo visible en el tenis delantero** |
| gift-registry.png | Imagen generada por IA, bajo dirección del propietario | Propietario de Hilo Luna | Original para Hilo Luna, según declaración del propietario | — | 2026-10-01 | Datos demo: `giftRegistry.photo` → `GiftRegistrySection` | `activo` · 1122 × 1402 · `public/templates/level-12/gift-registry.png` · Regalos envueltos en papel negro con moños y listones de colores; sin marcas visibles |

Notas comunes: ninguna imagen reproduce personajes de videojuego registrados, marcas de consola (Nintendo/Xbox/PlayStation) ni assets de videojuego con derechos de autor. Los gabinetes de arcade y controles que aparecen son genéricos (sin pantallas con juegos reales ni logotipos de fabricantes). El niño que aparece es una persona generada por IA, no una persona real identificable. El retoque de las cuatro imágenes con logotipo de calzado se hizo **localmente** (difuminado + relleno con la librería `sharp`, ya presente en el proyecto para `server/media/normalize.ts`), sin subir las imágenes a ningún servicio adicional. Los archivos pesan entre 1.9 MB y 2.6 MB cada uno; `next/image` sirve versiones WebP redimensionadas.

### 5.3 Imágenes incorporadas — plantilla Aurora XV (invitación pública `/i/demo-aurora-xv`)

Registradas **antes** de usarse en código. **Sustituyen a una primera versión placeholder** (composición vectorial SVG geométrica, sin fotografía) que cubrió provisionalmente esta plantilla mientras no había otra fuente disponible; esa primera versión queda sin efecto y esta tabla describe únicamente los 11 archivos actuales. Origen: **fotografía generada con ChatGPT (modelo de generación de imágenes), bajo dirección de arte y revisión del propietario** — fuente expresamente aprobada por CLAUDE.md §1.4 ("Originales generados para Hilo Luna (ChatGPT bajo dirección del propietario)"), sin ningún archivo de terceros como entrada. El propietario generó y revisó los 11 archivos y los incorporó directamente a `public/templates/aurora-xv/` con estos mismos nombres. Comprobado por `tests/invitation/assets.test.ts`: todo `/templates/aurora-xv/*` referenciado existe y está listado aquí.

> **Nota de revisión (verbatim, a petición del propietario):** "Aurora XV demo assets are custom-generated/edited cinematic demo images for Hilo Luna. They were reviewed to avoid visible third-party logos, celebrity likenesses, registered marks, or copyrighted characters."
>
> En español: son imágenes de demostración generadas/compuestas a medida para Hilo Luna. Se revisaron para no incluir logotipos de terceros visibles, semejanza con celebridades, marcas registradas ni personajes con derechos de autor. Las personas que aparecen (quinceañera, amigas, invitados) son figuras **sintéticas generadas por IA, no fotografías de personas reales**, por lo que no hay riesgo de semejanza con un individuo identificable.

Fuente, autor/proveedor y licencia son los mismos para las once filas:

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Usado en | Estado / notas |
|---|---|---|---|---|---|---|---|
| cover-bg.png | Fotografía generada con ChatGPT, dirección de arte del propietario | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/aurora-xv.ts` → `decor.heroBackdrop`; lo dibuja `HeroSection` (única imagen con `priority`) | `activo` · 1122 × 1402 · `public/templates/aurora-xv/cover-bg.png` · Retrato de quinceañera con corona, ramo y letrero luminoso "XV" entre flores claras |
| decor-corners.png | Fotografía/ilustración generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/aurora-xv.ts` → `decor.section*` (fragmentos `tl` `tr` `bl` `br`) → `Decor` | `activo` · 1254 × 1254 (PNG con transparencia, verificado por canal alfa) · `public/templates/aurora-xv/decor-corners.png` · Cuatro esquinas florales doradas independientes, una por cuadrante, sobre fondo transparente |
| location-church.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `locations[0].photo` en `lib/invitation/mock/valentina-aurora-xv.ts` → `LocationSection` | `activo` · 1448 × 1086 · `public/templates/aurora-xv/location-church.png` · Nave de iglesia iluminada, pasillo con pétalos y velas, altar con flores claras |
| location-salon.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `locations[1].photo` → `LocationSection` | `activo` · 1402 × 1122 · `public/templates/aurora-xv/location-salon.png` · Salón de recepción con pista iluminada, letrero "XV" y mesas decoradas |
| gallery-1.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[0]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/aurora-xv/gallery-1.png` · Retrato de espaldas: detalle del vestido con flores y pedrería |
| gallery-2.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[1]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/aurora-xv/gallery-2.png` · Momento con amigas entre risas y luces cálidas |
| gallery-3.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[2]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/aurora-xv/gallery-3.png` · Pastel de tres pisos con topper "XV", rosas y velas |
| gallery-4.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[3]` → `GallerySection` | `activo` · 1402 × 1122 · `public/templates/aurora-xv/gallery-4.png` · Mesa de dulces (macarons, cupcakes, postres) con flores |
| gallery-5.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[4]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/aurora-xv/gallery-5.png` · Vals en la pista de baile, vestido en movimiento |
| dress-code.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `dressCode.illustration` → `DressCodeSection` | `activo` · 1122 × 1402 · `public/templates/aurora-xv/dress-code.png` · Flat-lay de accesorios formales (zapatos, joyería, clutch) en tonos champagne, sin marcas legibles |
| gift-registry.png | Fotografía generada con ChatGPT | Hilo Luna — generada con ChatGPT bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `giftRegistry.photo` → `GiftRegistrySection` | `activo` · 1122 × 1402 · `public/templates/aurora-xv/gift-registry.png` · Regalos envueltos con moños y flores en tonos champagne |

Notas comunes: fotografía generada por IA (ChatGPT), sin ningún archivo de terceros como entrada; revisada para descartar logotipos, marcas registradas o texto de marca legible (en `dress-code.png` una correa de sandalia muestra una marca de agua tipográfica ilegible, artefacto típico de generación por IA — no es un logotipo reconocible ni texto legible, pero queda anotado aquí por transparencia). Las personas representadas son sintéticas (generadas por IA), no fotografías de individuos reales. Los archivos pesan entre 1.8 MB y 2.7 MB cada uno; `next/image` sirve versiones WebP/AVIF redimensionadas en tiempo de petición, por lo que el peso del original no afecta directamente la carga del sitio.

### 5.4 Imágenes incorporadas — plantilla Celeste (invitación pública `/i/demo-celeste`)

Registradas **antes** de usarse en código. Origen DISTINTO al de §5.3 (fotografía de IA): son **composición vectorial original** (SVG propio, escrito por el asistente a partir del brief de texto del propietario — paleta, elementos, tono, prohibiciones explícitas de caricatura — sin ningún mockup de imagen para esta plantilla) rasterizada a PNG con `sharp` (mismo mecanismo que §5.2, usado en tiempo de generación únicamente; el código de generación no se conserva en el repositorio). Es un **placeholder deliberado**: no alcanza el nivel "cinematográfico" (fotorrealista) del brief original — ver nota de deuda técnica en el informe de entrega D-43. Comprobado por `tests/invitation/assets.test.ts`: todo `/templates/celeste/*` referenciado existe y está listado aquí.

> **Nota de revisión (verbatim, a petición del propietario):** "Celeste demo assets are custom-generated/edited cinematic demo images for Hilo Luna. They were reviewed to avoid visible third-party logos, celebrity likenesses, registered marks, or copyrighted characters."
>
> En español: son imágenes de demostración generadas/compuestas a medida para Hilo Luna. Se revisaron para no incluir logotipos de terceros visibles, semejanza con celebridades, marcas registradas ni personajes con derechos de autor — al ser composición vectorial geométrica (flores, velas, cruz, listones, perlas), ninguna de esas categorías aplica por construcción, no solo por revisión. Se evitó deliberadamente dibujar cualquier figura humana con rasgos (rostro, expresión): el "peluche" de `gift-registry.png` es una silueta redondeada sin cara, precisamente para no arriesgar un estilo de caricatura.

Fuente, autor/proveedor y licencia son los mismos para las once filas:

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Usado en | Estado / notas |
|---|---|---|---|---|---|---|---|
| cover-bg.png | Composición vectorial propia (SVG), brief de texto del propietario | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/celeste.ts` → `decor.heroBackdrop`; lo dibuja `HeroSection` (única imagen con `priority`) | `activo` · 1122 × 1402 · `public/templates/celeste/cover-bg.png` · Cruz delicada, velas, flores blancas y luz natural en tonos marfil/azul cielo |
| decor-corners.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/celeste.ts` → `decor.section*` (fragmentos `tl` `tr` `bl` `br`) → `Decor` | `activo` · 1254 × 1254 (PNG con transparencia, verificado por canal alfa) · `public/templates/celeste/decor-corners.png` · Cuatro esquinas florales doradas independientes (flor, cruz delicada, perlas), una por cuadrante, sobre fondo transparente |
| location-church.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `locations[0].photo` en `lib/invitation/mock/mateo-celeste.ts` → `LocationSection` | `activo` · 1122 × 1402 · `public/templates/celeste/location-church.png` · Silueta de parroquia luminosa con cruz, velas y flores blancas |
| location-venue.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `locations[1].photo` → `LocationSection` | `activo` · 1122 × 1402 · `public/templates/celeste/location-venue.png` · Arco floral de entrada y mesas con centros de flores blancas para la recepción |
| gallery-1.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[0]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/celeste/gallery-1.png` · Silueta de ropón de bautizo con listón, cruz y perlas (detalle, sin persona) |
| gallery-2.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[1]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/celeste/gallery-2.png` · Vela de bautizo, concha de agua bendita y Biblia, sin marcas |
| gallery-3.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[2]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/celeste/gallery-3.png` · Pastel de tres pisos con flores y cruz dorada en tonos marfil y azul cielo |
| gallery-4.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[3]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/celeste/gallery-4.png` · Mesa de dulces en dos niveles con flores claras |
| gallery-5.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[4]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/celeste/gallery-5.png` · Momento familiar abstracto (cintas de luz y flores, sin figuras, para no arriesgar semejanza con personas reales) |
| dress-code.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `dressCode.illustration` → `DressCodeSection` | `activo` · 1122 × 1402 · `public/templates/celeste/dress-code.png` · Siluetas de vestido y traje formal en tonos claros, sin marcas ni rasgos |
| gift-registry.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `giftRegistry.photo` → `GiftRegistrySection` | `activo` · 1122 × 1402 · `public/templates/celeste/gift-registry.png` · Regalos envueltos y silueta de peluche sin rostro, en tonos marfil y azul cielo |

Notas comunes: trazados y gradientes definidos íntegramente en código (SVG propio), sin ningún archivo de terceros como entrada ni personas, rostros o figuras humanas con rasgos dibujadas (se evitó a propósito: ver "Evitar… estilo caricatura" del brief — los momentos familiares/ceremoniales se resolvieron con flores, listones, velas y movimiento abstracto en vez de figuras, y el "peluche" de `gift-registry.png` es una silueta sin cara). Es un placeholder deliberadamente **no fotorrealista**: para el nivel "cinematográfico" del brief original, lo más indicado es que el propietario genere/edite las imágenes con su propia herramienta (como ya se hizo para Aurora XV, docs/ASSET_LICENSES.md §5.3) y las reemplace manteniendo estos mismos nombres de archivo. Los archivos pesan entre 75 KB y 280 KB cada uno; `next/image` sirve versiones WebP/AVIF redimensionadas en tiempo de petición.

### 5.5 Imágenes incorporadas — plantilla Spider Friends (invitación pública `/i/demo-spider-friends`)

Registradas **antes** de usarse en código. Mismo mecanismo que §5.2/§5.4: **composición vectorial original** (SVG propio, escrito por el asistente a partir del brief de texto del propietario — paleta, elementos, tono y una lista explícita de qué evitar legalmente — sin ningún mockup de imagen para esta plantilla) rasterizada a PNG con `sharp` (usado en tiempo de generación únicamente; el código de generación no se conserva en el repositorio). Elegido a propósito por la exigencia legal de la tarea (sin personajes registrados): una composición propia, trazo a trazo, no tiene ningún riesgo de reproducir por accidente un diseño con derechos de un tercero, a diferencia de un generador de imágenes entrenado con material con copyright. Es un **placeholder deliberado**, con la misma limitación ya documentada en §5.4: no alcanza un nivel fotorrealista. Comprobado por `tests/invitation/assets.test.ts`: todo `/templates/spider-friends/*` referenciado existe y está listado aquí.

> **Nota de revisión (verbatim, a petición del propietario):** "Spider Friends demo assets are custom-generated/edited cinematic demo images for Hilo Luna. They were reviewed to avoid visible third-party logos, registered superhero characters, protected costumes, brand marks, or copyrighted characters."
>
> En español: son imágenes de demostración generadas/compuestas a medida para Hilo Luna. Se revisaron para no incluir logotipos de terceros, personajes de superhéroes registrados, trajes protegidos, marcas comerciales ni personajes con derechos de autor. Ningún archivo usa la palabra "Spidey" ni los nombres "Spider-Man", "Marvel" o "Disney" (comprobado por `tests/invitation/spider-friends.test.tsx`). Las "arañas" son un personaje mascota propio: un bicho redondo con cara sonriente, no una persona con disfraz. Los niños de `gallery-3.png` llevan un antifaz genérico (una simple banda ovalada sobre los ojos, sin la forma angular de lente característica de un personaje registrado) y una capa de color sólido sin ningún patrón de telaraña sobre la prenda ni emblema en el pecho — ninguna prenda copia un traje oficial. Las telarañas son líneas radiales genéricas (un motivo decorativo de fiesta infantil anterior y más amplio que cualquier personaje concreto), nunca dibujadas sobre un traje. No se usa ningún logo, marca ni nombre de personaje real en ningún archivo.

Fuente, autor/proveedor y licencia son los mismos para las diez filas:

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Usado en | Estado / notas |
|---|---|---|---|---|---|---|---|
| cover-bg.png | Composición vectorial propia (SVG), brief de texto del propietario | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/spider-friends.ts` → `decor.heroBackdrop`; lo dibuja `HeroSection` (única imagen con `priority`) | `activo` · 1122 × 1402 · `public/templates/spider-friends/cover-bg.png` · Ciudad, cielo azul/amarillo, globos rojos/azules/amarillos, telarañas genéricas (líneas radiales) y dos arañitas mascota sonrientes; centro despejado para texto |
| decor-corners.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/spider-friends.ts` → `decor.section*` (fragmentos `tl` `tr` `bl` `br`) → `Decor` | `activo` · 1254 × 1254 (PNG con transparencia, verificado por canal alfa) · `public/templates/spider-friends/decor-corners.png` · Cuatro esquinas independientes: telaraña + arañita (arriba-izquierda), racimo de globos (arriba-derecha), silueta de ciudad y estrellas (abajo-izquierda), rayo y destellos tipo cómic (abajo-derecha) |
| location-venue.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `locations[0].photo` en `lib/invitation/mock/nico-spider-friends.ts` → `LocationSection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/location-venue.png` · Salón decorado con arco de globos, banderines de fiesta rojos/azules/amarillos, silueta de ciudad y mesa con cupcakes |
| gallery-1.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[0]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/gallery-1.png` · Pastel de tres pisos con telaraña genérica dibujada en la cubierta, topper con el número 6 y globos |
| gallery-2.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[1]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/gallery-2.png` · Torre de cupcakes en rojo, azul y amarillo con toppers de estrella |
| gallery-3.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[2]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/gallery-3.png` · Tres niños con antifaz genérico (banda ovalada) y capa de color sólido sin patrón, celebrando con los brazos en alto; confeti, globos y ciudad de fondo — ninguna prenda copia un traje registrado |
| gallery-4.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[3]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/gallery-4.png` · Bolsas de regalo con papel de china, una arañita mascota asomándose y silueta de ciudad |
| gallery-5.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[4]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/gallery-5.png` · Mesa puesta con platos con patrón de telaraña genérico, vasos, banderines y globos |
| dress-code.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `dressCode.illustration` → `DressCodeSection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/dress-code.png` · Flat-lay: sudadera roja, antifaz genérico, un par de tenis sin marca visible, capa azul con ribete amarillo y muñequeras |
| gift-registry.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `giftRegistry.photo` → `GiftRegistrySection` | `activo` · 1122 × 1402 · `public/templates/spider-friends/gift-registry.png` · Regalos envueltos en rojo, azul y amarillo con moños, una arañita mascota y globos |

Notas comunes: trazados y gradientes definidos íntegramente en código (SVG propio), sin ningún archivo de terceros como entrada. Sin logos, sin marcas, sin nombres de personajes reales, sin la palabra "Spidey". Las "arañas" son una mascota redonda con cara sonriente (un bicho, no una persona disfrazada); los niños de `gallery-3.png` llevan solo un antifaz genérico y una capa lisa, nunca un traje con patrón de telaraña ni un emblema en el pecho. Los archivos pesan entre 11 KB y 72 KB cada uno; `next/image` sirve versiones WebP/AVIF redimensionadas en tiempo de petición.

### 5.6 Imágenes incorporadas — plantilla Baby Bloom (invitación pública `/i/demo-baby-bloom`)

Registradas **antes** de usarse en código. Mismo mecanismo que §5.2/§5.4/§5.5: **composición vectorial original** (SVG propio, escrito por el asistente a partir del brief de texto del propietario — paleta, elementos, tono y una lista explícita de qué evitar, incluida la prohibición de estilo caricatura — sin ningún mockup de imagen para esta plantilla) rasterizada a PNG con `sharp` (usado en tiempo de generación únicamente; el código de generación no se conserva en el repositorio). Es un **placeholder deliberado**, con la misma limitación ya documentada en §5.4/§5.5: no alcanza un nivel fotorrealista. Comprobado por `tests/invitation/assets.test.ts`: todo `/templates/baby-bloom/*` referenciado existe y está listado aquí.

> **Nota de revisión (verbatim, a petición del propietario):** "Baby Bloom demo assets are custom-generated/edited cinematic demo images for Hilo Luna. They were reviewed to avoid visible third-party logos, celebrity likenesses, registered marks, brand marks, or copyrighted characters."
>
> En español: son imágenes de demostración generadas/compuestas a medida para Hilo Luna. Se revisaron para no incluir logotipos de terceros, semejanza con celebridades, marcas registradas ni personajes con derechos de autor. Siguiendo el mismo criterio ya usado en Celeste (docs/ASSET_LICENSES.md §5.4), ninguna figura humana se dibujó con rasgos (rostro, expresión): la silueta materna de `cover-bg.png`/`gallery-1.png` y las siluetas de invitadas de `gallery-4.png` son formas sólidas sin cara — evita cualquier riesgo de caricatura o de parecido con una persona real. El osito de peluche es un juguete sin rostro individualizado (ojos/nariz genéricos, no una "mascota" con personalidad). Ningún archivo incluye texto incrustado, marca ni logotipo.

Fuente, autor/proveedor y licencia son los mismos para las diez filas:

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Usado en | Estado / notas |
|---|---|---|---|---|---|---|---|
| cover-bg.png | Composición vectorial propia (SVG), brief de texto del propietario | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/baby-bloom.ts` → `decor.heroBackdrop`; lo dibuja `HeroSection` (única imagen con `priority`) | `activo` · 1122 × 1402 · `public/templates/baby-bloom/cover-bg.png` · Silueta materna sin rasgos junto a flores suaves, luna, nubes, globos pastel y un osito, luz cálida; centro despejado para texto |
| decor-corners.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | `lib/invitation/templates/baby-bloom.ts` → `decor.section*` (fragmentos `tl` `tr` `bl` `br`) → `Decor` | `activo` · 1254 × 1254 (PNG con transparencia, verificado por canal alfa) · `public/templates/baby-bloom/decor-corners.png` · Cuatro esquinas independientes: luna y estrellas (arriba-izquierda), nubes (arriba-derecha), flores y listón dorado (abajo-izquierda), osito y globo (abajo-derecha) |
| location-venue.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `locations[0].photo` en `lib/invitation/mock/baby-mateo-baby-bloom.ts` → `LocationSection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/location-venue.png` · Arco floral de entrada, globos pastel, mesa de dulces y ositos en tonos marfil, champagne y azul cielo |
| gallery-1.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[0]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/gallery-1.png` · Silueta materna elegante sin rasgos, rodeada de flores suaves y rayos de luz dorada |
| gallery-2.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[1]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/gallery-2.png` · Mesa de dulces de tres niveles con cupcakes, flores y detalles dorados, en tonos pastel |
| gallery-3.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[2]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/gallery-3.png` · Regalos envueltos, osito de peluche y flores en tonos pastel |
| gallery-4.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[3]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/gallery-4.png` · Cuatro siluetas de invitadas sin rasgos celebrando, con confeti y globos — ninguna figura tiene rostro |
| gallery-5.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `gallery[4]` → `GallerySection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/gallery-5.png` · Decoración suave con luna, globos pastel, flores, osito y un regalo con moño dorado |
| dress-code.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `dressCode.illustration` → `DressCodeSection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/dress-code.png` · Flat-lay: vestido y camisa en tonos claros, zapatos sin marca, manta y broches, sin figuras humanas |
| gift-registry.png | Composición vectorial propia (SVG) | Hilo Luna — diseñado y codificado por el asistente bajo dirección del propietario | Original para Hilo Luna | — | 2026-10-02 | Datos demo: `giftRegistry.photo` → `GiftRegistrySection` | `activo` · 1122 × 1402 · `public/templates/baby-bloom/gift-registry.png` · Regalos para bebé envueltos con moños dorados, un osito y detalles en tonos pastel |

Notas comunes: trazados y gradientes definidos íntegramente en código (SVG propio), sin ningún archivo de terceros como entrada. Sin logos, sin marcas, sin texto incrustado. Ninguna figura humana se dibujó con rasgos (rostro/expresión): todas las siluetas (madre, invitadas) son formas sólidas sin cara, mismo criterio que Celeste (§5.4). Los archivos pesan entre 36 KB y 85 KB cada uno; `next/image` sirve versiones WebP/AVIF redimensionadas en tiempo de petición.

---

## 6. Audio

Ninguno incorporado. **Biblioteca licenciada de Hilo Luna**: el proveedor/licencia está **pendiente de decidir** (pregunta abierta N-01 en `PROJECT_SPEC`); hasta entonces no existe pista alguna en el repo ni en producción.

| Nombre | Fuente | Autor/proveedor | Licencia | URL de origen | Fecha de obtención | Cobertura de licencia (comercial, territorio, sincronización, plazo) | Estado |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

Cada pista de la biblioteca debe tener además su registro en la tabla `MusicTrack` (ver `DATABASE_SCHEMA.md`) con los mismos datos de licencia. **Sin licencia documentada no hay pista.**

Audio subido por usuarios: no es un asset de Hilo Luna; se guarda con `rightsConfirmedAt` (aceptación explícita del usuario de que tiene los derechos). Hilo Luna debe contar con términos de servicio y un procedimiento de retirada por reclamación (**pendiente**, requiere revisión legal).

---

## 7. Marcas y contenido de terceros vistos en mockups

| Elemento | Dónde aparece | Tratamiento |
|---|---|---|
| Logos Liverpool / Amazon / Sears | Mockups 01 y 06 | **No reproducir.** Enlaces genéricos con ícono neutro hasta decisión legal (Q-05) |
| Logos WhatsApp / Instagram | Mockups 01 y 05 | Uso de marcas de terceros: seguir sus guías de marca al integrarlas; hasta entonces íconos genéricos de "compartir" |
| Carátula y "Perfect · Ed Sheeran" (reproductor) | Mockup 01 | **No reproducir.** La maqueta de marketing usará una pista/portada propia o placeholder neutro |
| Personas (avatares, novios, pareja en galería) | Mockups 01, 03, 05, 06 | Son imágenes de demostración; se regeneran/sustituyen por imaginería original sin personas reales identificables |

---

## 8. Proceso al incorporar un activo

1. Confirmar que cumple §1.
2. Añadir la fila correspondiente aquí (todos los campos obligatorios).
3. Guardar el archivo en la ruta prevista (`public/templates/<slug>/…`, `public/brand/…`) y referenciarlo por código; **nunca** enlazar hotlinks externos.
4. Referenciar la entrada en la descripción del PR.
5. Si la licencia exige atribución, añadirla al lugar visible que indique la licencia.
