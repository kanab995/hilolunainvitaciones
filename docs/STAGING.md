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

### 0.1 Separar Preview (staging) de Production en Vercel — OBLIGATORIO antes del primer despliegue Preview

Comprobado el 21-oct-2026 con `vercel env ls` (solo nombres; los valores son sensibles y la CLI no puede leerlos): estas variables son UNA sola
entrada para «Production, Preview», es decir, **el mismo valor**: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, los tres
`STRIPE_PRICE_*` de planes, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `S3_*`, `APP_ENV`, `CSP_REPORT_ONLY`; y
`NEXT_PUBLIC_SITE_URL` vale `https://hiloluna.com` en Preview. Como el build de Vercel es `npm run build` (= `prisma migrate deploy && next build`),
**un despliegue Preview hoy aplicaría las migraciones a la base de PRODUCCIÓN y usaría Stripe real.** No hay ningún despliegue Preview todavía.

En Vercel → Settings → Environment Variables, para cada variable de la lista: editar → dejar marcada solo **Production** → guardar; y crear
una entrada nueva solo para **Preview** con el valor de staging:

| Variable (solo Preview) | Valor de staging |
|---|---|
| `APP_ENV` | `staging` |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.hiloluna.com` (o la URL fija de la rama) |
| `DATABASE_URL` | una base **nueva** de staging (otra Prisma Postgres/Neon), nunca la de producción |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `sk_test_…` / `pk_test_…` (modo de prueba) |
| `STRIPE_WEBHOOK_SECRET` | el `whsec_…` del endpoint de **prueba** que apunta a staging |
| `STRIPE_PRICE_ESSENTIAL_ONE_TIME`, `…_PREMIUM_ONE_TIME`, `…_ESSENTIAL_TO_PREMIUM`, `STRIPE_PRICE_ADDON_PRINT_FILE` | los `price_…` de **prueba** (499 / 799 / 300 / 199 MXN, pago único) |
| `PRINT_ADDON_ENABLED` | `1` (solo Preview) |
| `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | las de una instancia de Clerk de **desarrollo** (`sk_test_`/`pk_test_`) |
| `S3_*` | un bucket propio de staging (p. ej. `hiloluna-staging-media`) |
| `EMAIL_STAGING_ALLOWLIST` | tu correo |

El código lo vigila: con `APP_ENV=staging`, una clave `_live_` o el dominio `hiloluna.com` impiden arrancar (`server/config/env.ts`).
Después: un dominio fijo para staging (Vercel → Domains → `staging.hiloluna.com` asignado a la rama) y la protección de despliegues: Stripe
debe poder llegar al webhook (desactiva «Vercel Authentication» para ese dominio o usa «Protection Bypass for Automation»).

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

### 10.1 Complemento «Archivo listo para imprimir» (D-48) — compra completa en modo de prueba

> **Solo staging, solo modo de prueba.** Claves `sk_test_`/`pk_test_`, la base de datos de STAGING y `APP_ENV=staging`. En producción
> `PRINT_ADDON_ENABLED` sigue **apagado** hasta la autorización final del propietario. Antes de desplegar, rota el token de Upstash
> (`docs/PRODUCTION_CHECKLIST.md` B11).

**Preparación (una vez)**

1. Stripe (modo de prueba) → Catálogo de productos → producto «Archivo listo para imprimir» → precio **único (no recurrente) de 199 MXN**.
   Copia su `price_…`.
2. Variables de **staging** (además de las de §10): `STRIPE_PRICE_ADDON_PRINT_FILE=price_…` y `PRINT_ADDON_ENABLED=1`. Para el correo:
   `RESEND_API_KEY` de prueba y tu correo en `EMAIL_STAGING_ALLOWLIST` (sin él, el envío queda «Omitido», `docs/EMAIL.md`).
3. El endpoint del webhook de §10 ya recibe los eventos necesarios (`checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.payment_failed`, `charge.refunded`…); no hace falta otro.
4. Despliega staging. El build aplica `20261019120000_add_event_addon_purchases` y `20261020120000_addon_single_pending_and_confirmation_email`
   a la base de STAGING; comprueba con `DATABASE_URL=<staging> npx prisma migrate status` que no queda ninguna pendiente.
5. Ten a mano: un evento de **boda** con plan **Esencial** (compra de §10 paso 3) y la invitación **publicada**, otro evento **Gratis**, y la
   Stripe CLI con sesión en la cuenta de prueba (`stripe login`), solo para el paso 7.

**Recorrido** (tarjeta `4242 4242 4242 4242`, cualquier fecha futura y CVC)

1. **`/pricing`**: aparece «También en papel, igual de especial», $199 MXN, «impuestos aplicables incluidos», «No incluye la impresión física
   ni el envío de tarjetas», **sin botón de compra**. Con `PRINT_ADDON_ENABLED` vacío muestra «Muy pronto» (compruébalo antes de encenderlo).
2. **Evento Gratis** → Versión para imprimir: vista previa con marca de agua y «Mejorar evento», nunca «Comprar».
3. **Checkout** (evento Esencial) → Versión para imprimir → revisa la vista previa → «Comprar · $199 MXN» → Stripe muestra **199 MXN** →
   paga.
   - [ ] Vuelves con «Estamos confirmando tu pago…» o directamente «¡Listo!…».
   - [ ] **Webhook**: Stripe → Webhooks → entrega `checkout.session.completed` con **200**; `/admin/webhooks` la lista como procesada.
4. **Desbloqueo y descarga**
   - [ ] La tarjeta dice «Comprado el …» y aparece «Descargar PDF para imprimir»; descarga 5×7 y A5, con y sin marcas de corte, varias veces.
   - [ ] Con otra cuenta (no propietaria), `/dashboard/events/<id>/print/file` responde **404**.
   - [ ] «Compras y planes»: dentro del evento, **Complementos** → «Archivo listo para imprimir · $199 MXN», «Pagado», la fecha e «Ir a la
         descarga»; el «Historial de pagos» del plan **no cambió** (sigue la fila de 499).
   - [ ] El plan del evento sigue siendo **Esencial** y «Disponible hasta…» no cambió.
   - [ ] **Correo** «[STAGING] Tu invitación lista para imprimir | Hilo Luna»: nombre del evento, producto, «Ir a la descarga» lleva a
         `/dashboard/events/<id>/print` (pide sesión si no la tienes) y **no** trae adjunto. En `/admin/emails`: «Confirmación de complemento»,
         **Enviado**, una sola fila.
   - [ ] Stripe → Webhooks → **Reenviar** el mismo evento: 200 `duplicate`, ningún correo ni fila nueva.
5. **Dos pestañas y doble clic** (en un SEGUNDO evento Esencial de boda publicado, aún sin comprar)
   - [ ] Abre la Versión para imprimir en dos pestañas y pulsa «Comprar» en las dos casi a la vez (y un doble clic rápido): ambas llegan a la
         **misma** página de Stripe (mismo `cs_test_…` en la URL).
   - [ ] Paga en una; en la otra, Stripe dice que ya está pagada (o, al recargar la nuestra, «Estamos confirmando tu pago…» / «Comprado»).
   - [ ] `/admin/purchases/addons?q=<título>`: **una** compra Pagada (Desbloquea: Sí) y ningún «Cobro duplicado».
6. **Pago cancelado y fallido**: «Comprar» → «← Atrás» en Stripe → vuelve con «Cancelaste el pago: no se hizo ningún cargo.»; con la tarjeta
   `4000 0000 0000 0002` el pago se rechaza y no se desbloquea nada.
7. **Cobro duplicado forzado** (simula lo que el flujo normal impide): sobre el evento del paso 3, ya comprado, crea a mano una sesión con los
   ids de la consola (`/admin/events/<id>`: id del evento; `/admin/users/<id>`: id del usuario):

   ```bash
   stripe checkout sessions create --mode=payment --success-url="https://<staging>/dashboard" -d "line_items[0][price]=price_…" -d "line_items[0][quantity]=1" -d "metadata[hiloLunaUserId]=<id del usuario>" -d "metadata[eventId]=<id del evento>" -d "metadata[addon]=PRINT_FILE" -d "payment_intent_data[metadata][eventId]=<id del evento>"
   ```

   Abre la `url` que imprime y paga con `4242…`.
   - [ ] `/admin/purchases` y `/admin/purchases/addons` muestran «Hay 1 cobro duplicado…»; la fila nueva está **Pagada · Cobro duplicado**
         (Desbloquea: No). El registro/Sentry muestra `billing.addon_duplicate_payment`.
   - [ ] «Compras y planes» muestra la segunda fila con «Cobro duplicado · lo revisaremos para reembolsarlo»; la descarga sigue igual.
   - [ ] **No** llega un segundo correo de confirmación.
   - [ ] Reembolsa **ese** cobro siguiendo `docs/BILLING.md` §13.6 (búsqueda `metadata["eventId"]:"<id>"`, importe completo): la fila pasa a
         **Reembolsada**, el aviso desaparece y el cliente **conserva** la descarga.
8. **Reembolso total del complemento**: Stripe → el cobro restante del paso 3 → Reembolsar importe completo.
   - [ ] La compra pasa a **Reembolsada** (consola y «Compras y planes», con la fecha y «ya no da acceso a la descarga»).
   - [ ] La Versión para imprimir vuelve a ofrecer «Comprar» y el PDF limpio responde **404**; la vista previa sigue libre.
   - [ ] El plan del evento sigue siendo **Esencial**; ninguna fila de `EventPurchase` cambió.
   - [ ] (Opcional) Un reembolso **parcial** de otro cobro no cambia nada.
9. **Apagar**: `PRINT_ADDON_ENABLED=0` y redeploy → `/pricing` vuelve a «Muy pronto», el botón desaparece y las compras ya hechas siguen
   descargándose.

Anota cada resultado en §18. Si algo no coincide, **no** se enciende en producción.

### 10.2 Compra completa de prueba antes del lanzamiento (boda + QR a la mesa de regalos)

Requisitos: §0.1 hecho (staging con base, Stripe de **prueba**, Clerk de desarrollo y dominio propios) y §10.1 «Preparación» hecha. Tarjeta
`4242 4242 4242 4242`. Anota cada resultado en §18.

1. [ ] **Plantilla de boda**: `/templates` → una plantilla de boda (p. ej. Magnolia) → «Usar esta plantilla» (con cuenta de prueba).
2. [ ] **Crear y publicar**: completa nombres, fecha, ceremonia y recepción; en «Mesa de regalos» agrega al menos una tienda (para probar
   también el enlace directo, deja **una sola** con `https://`); **Publicar**. Abre `/i/<slug>` y confirma que se ve la mesa.
3. [ ] **Plan**: mejora el evento a **Esencial** (499 de prueba) y confirma el webhook (§10 paso 3).
4. [ ] **QR a la mesa de regalos**: Versión para imprimir → «Código QR del reverso» → **Mesa de regalos**. Debe decir «Elección guardada», la
   vista previa del reverso debe mostrar «Mesa de regalos / Escanea para ver nuestra mesa de regalos» y «Abre: …/i/<slug>#regalos».
5. [ ] **Comprar**: «Comprar · $199 MXN» → Stripe muestra 199 MXN → paga.
6. [ ] **Webhook**: Stripe (modo de prueba) → Webhooks → el endpoint de staging muestra `checkout.session.completed` con **200**; en
   `/admin/purchases/addons` aparece la compra **Pagada · Desbloquea: Sí**; llega el correo «[STAGING] Tu invitación lista para imprimir».
7. [ ] **Descargar el PDF** (5×7 y A5). Ábrelo: el reverso trae el QR y el texto de la mesa de regalos.
8. [ ] **Escanear el QR** impreso (o en pantalla) con la **cámara** de un iPhone y de un Android: debe abrir `staging…/i/<slug>#regalos` y
   mostrar directamente «Mesa de regalos» (no la portada). Repite con datos móviles y con la página recién abierta (sin caché).
9. [ ] **Volver a descargar**: recarga la página y descarga otra vez (también desde «Compras y planes» → «Ir a la descarga»): sin cobro nuevo.
10. [ ] **Sin doble cobro**: la tarjeta dice «Comprado» y no hay botón de compra; en otra pestaña abierta antes del pago, «Comprar» lleva a la
    misma sesión ya pagada o a «Estamos confirmando tu pago…»; en Stripe hay **un** solo pago de 199.
11. [ ] **Destino que desaparece**: en el editor quita la mesa de regalos (u oculta la sección) y **publica**. En Versión para imprimir debe
    aparecer «Elige de nuevo el destino del código QR», sin reverso ni botón de descarga (nunca un PDF con otro destino). Elige otro destino
    y la descarga vuelve. Restaura la mesa.
12. [ ] **Reembolso**: Stripe → el pago de 199 → Reembolsar el importe completo → la compra pasa a **Reembolsada** (consola y «Compras y
    planes»), la descarga responde 404 y vuelve «Comprar»; el plan Esencial no cambia.

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
| Complemento: `/pricing` sin compra y «Muy pronto» apagado | | |
| Complemento: checkout → webhook → desbloqueo → descarga | | |
| Complemento: correo de confirmación (uno solo) | | |
| Complemento: dos pestañas / doble clic → una sola sesión | | |
| Complemento: cobro duplicado forzado → señalado → reembolsado | | |
| Complemento: reembolso total → sin descarga; plan intacto | | |
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
