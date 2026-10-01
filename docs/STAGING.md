# Staging real de Hilo Luna

> Checklist **reproducible** para levantar un entorno de **staging** con servicios reales (Clerk de prueba, PostgreSQL propio, Cloudflare R2 propio, Stripe en modo de prueba, límite de tasa real, correo con Resend) y validarlo. Complementa a `docs/DEPLOYMENT.md` (referencia de variables, CSP, R2, límite de tasa), `docs/SMOKE_TESTS.md`, `docs/OPERATIONS.md`, `docs/BILLING.md`, `docs/EMAIL.md` y `docs/PRODUCTION_CHECKLIST.md` (bloqueadores y tabla GO/NO-GO).
> **No contiene valores secretos.** Nunca pegues claves en el repositorio, en issues ni en el chat. Staging **no** implementa correo a invitados, analítica de marketing, ni el despliegue de producción definitivo, y **no cambia el modelo comercial** (pago único por evento: Esencial 499, Premium 799, mejora 300 MXN).

**Estado de esta guía:** la aplicación está preparada (`APP_ENV`, noindex global, seed de staging, smoke con `SMOKE_BASE_URL`), pero **las pruebas con Clerk, R2, Stripe y Upstash reales se ejecutan en tu staging** (requieren tus cuentas y claves). Cada sección termina con el **resultado esperado** y una casilla para anotar el resultado real; el registro de resultados está en §18 y los bloqueadores para producción en §19.

---

## 0. Recursos que necesitas (todos propios de staging, ninguno compartido con producción)

| Recurso | Nombre sugerido | Notas |
|---|---|---|
| Alojamiento Node.js con HTTPS | — | El que elijas (la app es neutral al proveedor). Debe permitir variables distintas de **build** y de **ejecución** (`docs/DEPLOYMENT.md` §3.2) y registros de la aplicación. |
| Dominio | `staging.hiloluna.com` | O la URL https temporal del proveedor. |
| PostgreSQL | `hiloluna_staging` | Base **distinta** de la local y de la futura de producción. |
| Clerk | instancia de **desarrollo/prueba** propia | Claves `pk_test_` / `sk_test_`. |
| Cloudflare R2 | bucket `hiloluna-staging-media` | Token de API **solo** sobre ese bucket. |
| Stripe | cuenta en **modo de prueba** | Nunca claves `live`. |
| Upstash Redis | base propia de staging | Solo REST URL y REST Token (no hay que instalar SDK). |

---

## 1. Variables de entorno

1. Rellena la columna **staging** de la matriz de `docs/DEPLOYMENT.md` §3.1, respetando **build vs ejecución** (§3.2).
2. Imprescindibles: `APP_ENV=staging`, `NEXT_PUBLIC_SITE_URL=https://<tu-dominio-de-staging>`, y todas las de Clerk, base de datos, `S3_*`, Stripe y `RATE_LIMIT_*` con `RATE_LIMIT_REQUIRED=true`.
3. En la primera vuelta: `CSP_REPORT_ONLY=true` (§6).
4. Comprueba que el arranque **no falla**. Si falla, el mensaje **nombra las variables** sin mostrar valores. Con `APP_ENV=staging` el arranque también rechaza: claves `live` de Clerk/Stripe, el dominio de producción como `NEXT_PUBLIC_SITE_URL`, y avisa si el bucket no contiene «staging».

- [ ] Arranque sin errores  · [ ] Sin avisos de «variables del servidor no coinciden con las del build»

## 2. Dominio y DNS

- [ ] Registro DNS de `staging.hiloluna.com` (o la URL temporal) con HTTPS válido.
- [ ] `NEXT_PUBLIC_SITE_URL` es exactamente ese origen (https, sin ruta).
- [ ] Verifica que **no** hay ninguna referencia al dominio en el código (`lib/site-config.ts` es la única fuente; staging sale de `NEXT_PUBLIC_SITE_URL`).

## 3. Base de datos y migraciones

1. Crea `hiloluna_staging` (vacía). **Nunca** apuntes staging a la base local ni a la de producción.
2. Con `DATABASE_URL` de staging:
   ```bash
   npm run db:deploy          # prisma migrate deploy
   npm run db:seed:staging    # solo plantillas (una vez); NO se ejecuta automáticamente
   ```
3. **Prohibido en staging:** `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, `npm run db:seed` (se niega con `APP_ENV=staging`).
4. Política de seed: solo el catálogo de plantillas. No se crean Andrea & Fernando, usuarios demo ni compras: los crea quien prueba con su cuenta real.

- [ ] `migrate deploy` sin errores  · [ ] `prisma migrate status` = al día  · [ ] Plantillas visibles en `/templates`

## 4. Build y despliegue

Orden fijo: **(1) copia de seguridad (si hay datos) → (2) `prisma migrate deploy` → (3) build/deploy → (4) `/api/health/ready` → (5) `npm run smoke`.**

```bash
npm ci               # prisma generate en postinstall
npm run db:deploy
npm run build        # con las variables de BUILD de staging (docs/DEPLOYMENT.md §3.2)
npm start            # con las variables de ejecución
```

- [ ] Build correcto  · [ ] `GET /api/health` → `{"status":"ok"}`  · [ ] `GET /api/health/ready` → `ready` (sin datos internos en la respuesta)

**Protección build ≠ ejecución (no relajar):** para comprobarla, arranca una vez con `NEXT_PUBLIC_SITE_URL` (o `S3_PUBLIC_BASE_URL`, `APP_ENV`, `CSP_REPORT_ONLY`) distinto del build: el registro de arranque debe mostrar el aviso «las variables del servidor no coinciden con las del build». Vuelve a construir y desaparece.

- [ ] Aviso de huella comprobado  · [ ] Aviso ausente tras reconstruir

## 5. Clerk real

En el panel de Clerk (instancia de prueba): añade el dominio de staging como origen permitido, verifica que **sign-in** es `/sign-in` y **sign-up** `/sign-up`, y copia `pk_test_…` / `sk_test_…` al host. **No uses claves falsas.**

Recorrido manual (usuario nuevo real; no guardes contraseñas de prueba en el repositorio):
- [ ] Registro (`/sign-up`) y verificación de correo
- [ ] Cierre de sesión y nuevo inicio (`/sign-in`)
- [ ] Restauración de sesión al recargar y al abrir otra pestaña
- [ ] `/dashboard/events` sin sesión → redirige a `/sign-in`
- [ ] `/admin` con usuario normal → 404; sin sesión → acceso
- [ ] Tras iniciar sesión se llega a `/dashboard`
- [ ] `/pricing` (pública, pero con CTA que dependen de la sesión) carga **con y sin sesión**. Corrección aplicada al preparar staging: `proxy.ts` ahora también cubre `/pricing` (sin `clerkMiddleware`, `auth()` de Clerk lanzaba y la página respondía 500 con Clerk real). Con una instancia de Clerk de **prueba**, la primera visita sin cookies puede pasar por el *handshake* de Clerk (redirección breve a su Frontend API): es normal y `npm run smoke` lo tolera en `/pricing`.

## 6. CSP con Clerk real (prueba prioritaria)

1. Primera vuelta con **`CSP_REPORT_ONLY=true`** (en **build** y ejecución). Abre la **consola del navegador** (Console y Network).
2. Recorre §5 completo, §8 (subida a R2) y el botón «Pagar» hasta llegar a Stripe Checkout. Confirma:
   - los scripts de Clerk cargan (`clerk.<tu dominio>` o `*.clerk.accounts.dev`),
   - los frames/fetch de Clerk y de Turnstile funcionan,
   - la subida a R2 no genera `connect-src` violation,
   - **no hay violaciones inesperadas** («Refused to … (report only)»).
3. Si hay violaciones: añade **el origen mínimo exacto** en `server/security/csp.ts` (nunca `*` ni comodines globales), reconstruye y repite. Anota aquí cada origen añadido.
4. Sin violaciones: quita `CSP_REPORT_ONLY`, **reconstruye** y repite el recorrido con la CSP **aplicándose**.
5. Diferencia a documentar: en *Report-Only* el navegador solo informa; aplicándose, **bloquea** (un Clerk bloqueado impide iniciar sesión). **No actives producción sin este recorrido.**

- [ ] Report-Only sin violaciones  · [ ] Enforcing sin violaciones  · Orígenes añadidos: ______

## 7. Cabeceras y noindex (con peticiones reales)

`next.config` no equivale a la cabecera real: compruébalas contra el despliegue.

```bash
curl -sI https://<staging>/            | grep -iE "content-security|x-robots|x-content-type|referrer|permissions|strict-transport|x-frame|x-powered"
curl -sI https://<staging>/i/<slug>    | grep -iE "x-robots|referrer|cache-control"
curl -s  https://<staging>/robots.txt          # esperado: User-Agent: * / Disallow: /
curl -s  https://<staging>/sitemap.xml         # esperado: sin <loc>
```

Esperado en staging: `X-Robots-Tag: noindex, nofollow` en **todas** las rutas; CSP (o `-Report-Only`); `nosniff`; `Referrer-Policy`; `Permissions-Policy`; `Strict-Transport-Security` (HTTPS); **sin** `X-Powered-By`; `/i/**` con `Referrer-Policy: no-referrer` y `Cache-Control: private, no-store`.

- [ ] Cabeceras correctas  · [ ] `robots.txt` bloquea todo  · [ ] sitemap vacío

## 8. Cloudflare R2 real

1. Crea el bucket `hiloluna-staging-media`, su token (Object Read & Write **solo** ese bucket) y el dominio público. Rellena `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` (no las imprimas).
2. **CORS:** aplica la política de staging de `docs/DEPLOYMENT.md` §5 (solo el origen de staging y, si pruebas desde tu máquina, `http://localhost:3000`).
3. Verificación real del CORS (la subida directa del navegador debe funcionar; el preflight debe permitir `PUT` desde el origen de staging y **rechazarlo** desde otro):
   ```bash
   curl -si -X OPTIONS "<S3_PUBLIC_BASE_URL o endpoint>/x" -H "Origin: https://staging.hiloluna.com" -H "Access-Control-Request-Method: PUT" | grep -i "access-control"
   curl -si -X OPTIONS "<S3_PUBLIC_BASE_URL o endpoint>/x" -H "Origin: https://origen-no-permitido.example" -H "Access-Control-Request-Method: PUT" | grep -i "access-control"   # sin cabeceras CORS
   ```
4. Sin `FakeStorageProvider`. Recorrido (usuario real, evento **creado para esta prueba**):
   - [ ] Iniciar sesión → crear evento (Magnolia) → abrir el editor
   - [ ] Subir portada; subir varias fotos de galería
   - [ ] Recargar el editor: las imágenes siguen ahí
   - [ ] Abrir la invitación pública (`/i/<slug>` tras publicar): se ven las imágenes desde el dominio de medios
   - [ ] Reemplazar y eliminar una imagen; comprobar que ya no aparece en el editor ni en lo publicado tras republicar
   - [ ] Referencias/limpieza: `npm run media:orphans` (solo analiza) no marca archivos publicados

## 9. EXIF/GPS con una foto real de móvil

1. Sube una foto tomada con el móvil **con ubicación activada** (idealmente en vertical, para que lleve orientación EXIF).
2. Comprueba: se ve **derecha** (orientación correcta), sirve por su URL pública y **no tiene metadatos**:
   ```bash
   # con exiftool (https://exiftool.org) sobre el archivo descargado; no compartas ni pegues los metadatos sensibles
   exiftool -GPS* -EXIF:all descargada.jpg      # esperado: sin GPS ni EXIF
   ```
   Si una foto con giro EXIF se rechaza con un mensaje, `sharp` no está disponible en el host (`docs/DEPLOYMENT.md` §5.1).
- [ ] Orientación correcta  · [ ] Sin GPS/EXIF  · [ ] Se sirve bien

## 10. Stripe en modo de prueba

1. Con claves **`sk_test_` / `pk_test_`** (nunca live): crea en el panel (modo de prueba) tres Precios **de pago único, MXN** y copia sus `price_…`:
   - Esencial **499 MXN** → `STRIPE_PRICE_ESSENTIAL_ONE_TIME`
   - Premium **799 MXN** → `STRIPE_PRICE_PREMIUM_ONE_TIME`
   - Mejora Esencial→Premium **300 MXN** → `STRIPE_PRICE_ESSENTIAL_TO_PREMIUM`
   Si el importe, la moneda o el tipo (pago único) no coinciden con `lib/billing/plans.ts`, el checkout **falla de forma segura ANTES de cobrar** (`verifyPrice` consulta el Price en Stripe; `docs/BILLING.md` §11). Pruébalo: apunta temporalmente `STRIPE_PRICE_ESSENTIAL_ONE_TIME` al Price de 799 y pulsa «Pagar»: debe mostrar «La configuración de pagos… es inconsistente» y no abrir Stripe; restáuralo después.
2. **Webhook real (sin Stripe CLI):** en el panel → Desarrolladores → Webhooks → endpoint `https://<staging>/api/webhooks/stripe` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`. Copia su `whsec_…` a `STRIPE_WEBHOOK_SECRET`.
3. Recorrido E2E con la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y CVC):
   - [ ] Evento Gratis → «Mejorar evento» → Esencial → pago → webhook → evento **Esencial** (Compras y planes: 1 fila PAGADA de 499)
   - [ ] Esencial → «Mejorar» a Premium → **300 MXN** → webhook → **Premium**
   - [ ] Historial: **499 + 300**; **no** aparece un cobro de 799 adicional
   - [ ] Price mal configurado (ver arriba): el checkout falla antes de cobrar
   - [ ] Stripe → Webhooks → el endpoint muestra entregas **200** (firma real verificada); en `/admin/webhooks` aparecen procesadas
4. **Pago fallido:** tarjeta `4000 0000 0000 0002` (rechazada) en un evento Gratis:
   - [ ] El plan **no cambia**, el evento sigue operativo y **no** hay `EventPurchase` PAGADA (la compra queda pendiente/fallida)
5. **Doble cobro** (mismo evento y plan):
   - [ ] Doble clic rápido en «Pagar»
   - [ ] Dos pestañas pulsando «Pagar» a la vez
   - Esperado: se **reutiliza la misma sesión de Checkout** (o aparece «pago en proceso»); nunca dos cobros. Anota el resultado en §17.

## 11. Límite de tasa real (Upstash)

1. Crea la base Redis en Upstash, copia REST URL y REST Token a `RATE_LIMIT_REST_URL` / `RATE_LIMIT_REST_TOKEN`, `RATE_LIMIT_REQUIRED=true`. No se instala ningún SDK: la app usa la API REST. El arranque no debe avisar de «SIN LÍMITE DE TASA».
2. **Prueba:** abre un enlace personalizado en incógnito y envía el RSVP **más de 10 veces en 10 minutos** (límite por invitado; 20 por cliente):
   - [ ] Aparece «Demasiados intentos. Espera unos minutos e inténtalo de nuevo.» (mensaje humano)
   - [ ] Pasada la ventana (10 min) vuelve a funcionar
   - [ ] Los envíos de Stripe al webhook **no** están limitados
3. **Fallo del proveedor** (fail-open + aviso): cambia temporalmente `RATE_LIMIT_REST_TOKEN` por un valor inválido y reinicia; envía un RSVP:
   - Esperado: **se permite** (fail-open) y en el registro aparece `rate_limit.provider_error` (con el código, sin la clave ni la identidad). **Restaura el token** y reinicia.
   - [ ] Comprobado

## 12. Administrador real

1. Con una cuenta de staging (ya iniciada al menos una vez), conviértela en ADMIN **manualmente** contra la base **de staging** (`docs/ADMIN.md` §2; nunca hay correo fijado en el código):
   ```sql
   UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = '<correo de la cuenta de staging>';
   ```
2. - [ ] Usuario normal: `/admin` → 404  · [ ] Admin: `/admin` abre (resumen, usuarios, eventos, plantillas, compras, webhooks, auditoría)
   - [ ] Un cambio de visibilidad/plan de una plantilla aparece en `/admin/audit`

## 13. Recorrido de usuario completo y RSVP

Usuario **nuevo** real:
- [ ] Registro → dashboard vacío → elegir Magnolia → crear boda → editar → autoguardado («Guardado») → subir fotos → **Publicar** → URL pública `/i/<slug>`
- [ ] Crear invitados → copiar enlace personalizado (`?guest=`)

En **incógnito**:
- [ ] Abrir el enlace personalizado → saludo con el nombre
- [ ] Confirmar asistencia, acompañantes y mensaje → «gracias»
- [ ] Recargar y **cambiar** la respuesta
- [ ] Dashboard, Guest Manager y actividad reciente reflejan la respuesta

## 14. Compartir: enlace, QR y calendario

- [ ] Copiar enlace (es `https://<staging>/i/<slug>`)
- [ ] QR en pantalla y descarga PNG/SVG; **escanearlo con otro dispositivo** abre la invitación
- [ ] `https://<staging>/i/<slug>/calendar.ics` descarga un `.ics` válido y lo abre el calendario

## 15. Expiración (sin esperar 30 días)

Crea un **evento de prueba propio para esto** (nunca modifiques eventos reales de quien prueba): créalo, publícalo, cómpralo (Esencial) con la tarjeta de prueba y guarda su `id`. Luego, contra la base **de staging**:

```sql
-- Forzar la expiración (solo el evento de prueba):
UPDATE "Event" SET "paidAccessEndsAt" = now() - interval '1 day' WHERE "id" = '<id del evento de prueba>';
```

- [ ] `/i/<slug>` → «Esta invitación ya no está disponible.» (sin nombres ni fecha)
- [ ] `/i/<slug>?guest=<token>` → igual
- [ ] Enviar el RSVP → rechazado (`expired`)
- [ ] `/i/<slug>/calendar.ics` → 404
- Revierte cuando termines: `UPDATE "Event" SET "paidAccessEndsAt" = now() + interval '30 days' WHERE "id" = '<id>';` (o bórralo desde el panel).

## 16. Seguridad de las respuestas, registros y errores

**Respuestas públicas** (`view-source:` de `/i/<slug>` y del enlace personalizado): **no** deben aparecer ids internos innecesarios, ids de Clerk (`user_…`), correos o teléfonos de invitados, `inviteToken` en el HTML visible de la página sin `?guest=`, credenciales de S3 ni datos de Stripe. `npm run smoke` con `SMOKE_INVITE_SLUG` automatiza una parte.

**Registros** durante inicio de sesión, subida, RSVP, Stripe y admin (registros del host, formato JSON en una línea): **no** deben aparecer correos completos, teléfonos, tokens de invitado completos, claves de Stripe/Clerk/S3 ni `whsec_…`.
- [ ] Sin PII/secretos en los registros de cada flujo

**Errores** (mensajes seguros y genéricos):
- [ ] 404 (`/ruta-que-no-existe`)  · [ ] subida inválida (archivo no imagen / demasiado grande)  · [ ] RSVP inválido  · [ ] checkout inválido (evento o plan ajeno)

## 17. Humo automático

```bash
SMOKE_BASE_URL=https://<staging> SMOKE_EXPECT_STAGING=1 npm run smoke
SMOKE_BASE_URL=https://<staging> SMOKE_INVITE_SLUG=<slug publicado> SMOKE_GUEST_TOKEN=<token> npm run smoke
```

`SMOKE_BASE_URL` es obligatorio (no hay valor por defecto). Con `SMOKE_EXPECT_STAGING=1` (o una URL con «staging») exige noindex global y `robots.txt` que bloquea todo. **La autenticación con Clerk se prueba a mano** (§5, §13): no se automatiza ni se guardan contraseñas de prueba.
- [ ] `npm run smoke` sin fallos

---

## 18. Registro de resultados (rellénalo tras la ejecución)

| Prueba | Resultado | Fecha / notas |
|---|---|---|
| Clerk (registro, inicio, cierre, restauración, protección) | | |
| CSP Report-Only con Clerk real | | |
| CSP aplicándose con Clerk real | | |
| R2: subir, recargar, publicar, reemplazar, eliminar | | |
| R2: CORS real | | |
| EXIF con foto de móvil | | |
| Stripe: Esencial → pago → webhook | | |
| Stripe: mejora a Premium (300) | | |
| Stripe: pago fallido | | |
| Stripe: doble clic / dos pestañas | | |
| Límite de tasa: bloqueo y recuperación | | |
| Límite de tasa: proveedor caído (fail-open + aviso) | | |
| Administrador | | |
| Recorrido de usuario y RSVP | | |
| QR / .ics | | |
| Expiración | | |
| Cabeceras y noindex | | |
| Registros sin PII | | |
| `npm run smoke` | | |

---

## 19. Bloqueadores para producción

**Movido a `docs/PRODUCTION_CHECKLIST.md` (D-37)**: la clasificación BLOCKER/REQUIRED/OPTIONAL y la tabla GO/NO-GO por área
(auth, base de datos, storage, pagos, límite de tasa, correo, CSP, legal, impuestos, copias de seguridad, monitoreo, administración)
viven ahora en ese documento — es la versión consolidada y vigente; esta sección ya no se actualiza por separado.
**Actualiza `docs/PRODUCTION_CHECKLIST.md` con el resultado de §18** cuando ejecutes staging: cualquier fallo real puede añadir o
subir de nivel un punto.
