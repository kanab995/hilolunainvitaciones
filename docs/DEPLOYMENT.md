# Despliegue (staging y producción) — D-34

> Guía **neutral al proveedor**: el alojamiento de la aplicación y la base de datos gestionada **no están decididos**. Los pasos valen para cualquier
> host que ejecute Node.js (`npm run build` + `npm start`). No incluye valores reales; nunca subas secretos al repositorio.
> Ver también: `docs/STAGING.md` (checklist paso a paso de staging), `docs/OPERATIONS.md` (copias, soporte), `docs/BILLING.md` (Stripe), `docs/EMAIL.md` (Resend), `docs/SMOKE_TESTS.md` (pruebas de humo) y `docs/PRODUCTION_CHECKLIST.md` (bloqueadores y tabla GO/NO-GO antes de lanzar).

## 0. Principios

- **Staging y producción usan el mismo build y las mismas reglas.** En un despliegue (`NODE_ENV=production`) el arranque **falla con un error claro** si falta configuración crítica (`server/config/startup.ts`): nunca se sirve una app a medias. Staging usa claves de **prueba** (Clerk test, Stripe test) y el arranque **rechaza claves `live`** si `APP_ENV=staging`.
- **Tres entornos, recursos separados** (matriz en §3): `development` (máquina local), `staging` y `production`. Cada uno con su propia base de datos, instancia de Clerk, bucket de R2, modo de Stripe y base de límite de tasa. **Nada de producción se reutiliza en staging.**
- **`APP_ENV` distingue staging de producción** (ambos son `NODE_ENV=production`): es **obligatorio en cualquier despliegue**. Con `APP_ENV=staging` TODO el sitio es noindex (cabecera `X-Robots-Tag`, `robots.txt` con `Disallow: /`, sitemap vacío) y no puede usar el dominio de producción.
- El build **no necesita secretos** de Clerk/Stripe (ni claves de S3), pero sí una base de datos migrada (`/templates`, `/pricing` y `/sitemap.xml` leen el catálogo al generarse).
- **Variables de BUILD vs de EJECUCIÓN** (tabla en §3.2): la CSP, las imágenes remotas, el noindex de staging, `robots.txt` y la URL del sitio se **fijan AL CONSTRUIR** (`next.config.ts`, `app/robots.ts`, `NEXT_PUBLIC_*`): el build debe tener las mismas `APP_ENV`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` (y `CSP_REPORT_ONLY`, si la usas) que el servidor en ejecución; si no, la CSP no incluiría el origen de R2/Clerk, las subidas o el acceso se bloquearían, o staging quedaría indexable. El arranque **lo detecta y avisa** (`vuelve a ejecutar npm run build`, huella de build). Cambiar esas variables exige reconstruir. **No relajes este aviso.**
- Las variables sin prefijo `NEXT_PUBLIC_` son solo de servidor y no llegan al navegador.

## 1. Base de datos (PostgreSQL)

1. Crea una base PostgreSQL gestionada (versión reciente, con copias automáticas y, si es posible, PITR: `docs/OPERATIONS.md` §2). Región cercana a la aplicación.
2. Usuario de aplicación con permisos sobre el esquema (no superusuario). Conexión con TLS si el proveedor lo exige.
3. `DATABASE_URL=postgresql://…` en las variables del host. Con pool de conexiones (pgBouncer/serverless) usa la URL de pool para la app y la directa para migraciones si el proveedor lo pide.

## 2. Migraciones

```bash
npm run db:deploy
```

- `prisma migrate deploy` aplica solo las migraciones pendientes, **sin borrar datos**. **Nunca** uses `migrate reset` ni `migrate dev` contra staging/producción.
- Haz una **copia de seguridad antes** (`docs/OPERATIONS.md` §2).
- Las restricciones CHECK de `20260926160000_preproduction_hardening` se añaden `NOT VALID` (no revisan filas antiguas).
- **Política de seed (staging y producción):** el seed **no se ejecuta automáticamente** en ningún despliegue. Después de la primera migración, siembra SOLO el catálogo de plantillas una vez: `npm run db:seed:staging` (idempotente, datos no personales; **no** crea el evento demo Andrea & Fernando, usuarios, invitados ni compras; nunca pisa la visibilidad ni el plan mínimo que decidió el administrador). El seed completo `npm run db:seed` (evento demo y usuario de demostración) es **solo de desarrollo** y **se niega a correr** con `APP_ENV=staging|production`.
- **Nunca** en staging/producción: `prisma migrate dev`, `prisma migrate reset`, `prisma db push`. Solo `prisma migrate deploy`.
- Orden exacto de un despliegue: **1. copia de seguridad → 2. `npm run db:deploy` → 3. build y deploy → 4. `/api/health/ready` → 5. `npm run smoke`** (§12).

## 3. Variables de entorno

Copia `.env.example` al gestor de secretos del host y rellena **todo lo obligatorio en producción**:

| Grupo | Variables | Notas |
|---|---|---|
| App | `APP_ENV`, `NEXT_PUBLIC_SITE_URL` | `APP_ENV=staging` o `production` (**obligatorio** en un despliegue). `NEXT_PUBLIC_SITE_URL`: `https://hiloluna.com` en producción, `https://staging.hiloluna.com` (o la URL temporal https del proveedor) en staging; https, sin ruta, **no** localhost. Nunca se escribe el dominio en el código. |
| Base de datos | `DATABASE_URL` | §1 |
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | §4. Las dos de la **misma** instancia (test/live). |
| R2 / S3 | `S3_ENDPOINT`, `S3_REGION` (`auto`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | §5. `S3_PUBLIC_BASE_URL=https://media.hiloluna.com` (https, sin barra final). |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ESSENTIAL_ONE_TIME`, `STRIPE_PRICE_PREMIUM_ONE_TIME`, `STRIPE_PRICE_ESSENTIAL_TO_PREMIUM` | §6 y `docs/BILLING.md` |
| Límite de tasa | `RATE_LIMIT_REST_URL`, `RATE_LIMIT_REST_TOKEN`, `RATE_LIMIT_REQUIRED` | §8 |
| Correo (Resend) | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_REQUIRED`, `EMAIL_STAGING_ALLOWLIST` (solo staging) | §13, `docs/EMAIL.md` |
| Monitoreo (Sentry, opcional) | `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | §14 |
| Opcionales | `LOG_LEVEL`, `CSP_REPORT_ONLY` | §9, §7 |

Si algo obligatorio falta, `npm start` termina con un error que **nombra las variables** (nunca sus valores), p. ej. `[stripe] STRIPE_WEBHOOK_SECRET: …`. `/api/health/ready` responde 503 si la configuración o la base de datos no están listas.

### 3.1 Matriz por entorno

Sin valores secretos. «=» significa «una instancia/recurso propio de ese entorno»; **nunca** se comparten entre columnas.

| Variable / recurso | development | staging | production |
|---|---|---|---|
| `APP_ENV` | `development` (o vacío) | `staging` (**obligatorio**) | `production` (**obligatorio**) |
| `NODE_ENV` | lo fija `next dev` | `production` (lo fija `next build`/`start`) | `production` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://staging.hiloluna.com` (o URL temporal https) | `https://hiloluna.com` |
| `DATABASE_URL` | PostgreSQL local | = base **propia de staging** (nunca la local ni la de producción) | = base de producción |
| Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) | instancia de desarrollo (o vacío = demo) | instancia de **prueba** (`pk_test_`/`sk_test_`; `live` **rechazado**) | instancia de producción (`pk_live_`/`sk_live_`) |
| `S3_*` | vacío (subidas desactivadas) o MinIO local | = **bucket propio** `hiloluna-staging-media` (+ dominio de medios propio) | = `hiloluna-media` (`media.hiloluna.com`) |
| Stripe (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_*`) | modo de prueba | modo de **prueba** (nunca live) | modo real |
| `STRIPE_WEBHOOK_SECRET` | el de `stripe listen` | el del endpoint `https://staging…/api/webhooks/stripe` | el del endpoint de producción |
| `RATE_LIMIT_REST_URL` / `_TOKEN` | vacío (sin límite) | = base Upstash **propia** de staging | = base Upstash de producción |
| `RATE_LIMIT_REQUIRED` | — | `true` | `true` (**obligatorio**: producción nunca arranca sin proveedor real) |
| Resend (`RESEND_API_KEY`, `EMAIL_FROM`) | vacío (`DevEmailProvider`, no manda nada) | = cuenta de prueba propia; `EMAIL_STAGING_ALLOWLIST` obligatoria | = cuenta de producción, dominio verificado; **sin** `EMAIL_STAGING_ALLOWLIST` (no aplica fuera de staging) |
| `EMAIL_REQUIRED` | — | recomendado `true` | `true` |
| Sentry (`SENTRY_DSN`, opcional) | vacío | = proyecto de prueba propio (recomendado antes de lanzar) | = proyecto de producción propio |
| `CSP_REPORT_ONLY` | — | `true` en la primera prueba; luego vacío (§7) | vacío (se aplica; **nunca** `true` en un lanzamiento real) |
| `LOG_LEVEL` | `info` | `info` | `info` o `warn` |
| Indexación | — | **todo noindex** (cabecera + `robots.txt` + sitemap vacío) | solo marketing indexable; `/i/**`, panel, consola, vista previa y acceso siguen `noindex` |
| Seed | `npm run db:seed` | solo `npm run db:seed:staging` (manual, una vez) | solo `npm run db:seed:staging` (manual) |

**Separación de recursos (D-37, punto 18): ningún recurso de producción se reutiliza en staging, nunca al revés.** Antes de lanzar, confirma que production tiene su PROPIA base de datos, su propia instancia de Clerk, su propio bucket de R2, Stripe en modo **live**, su propia base de Upstash, su propio dominio verificado en Resend y (si se usa) su propio proyecto de Sentry — los ocho recursos de la fila de arriba, ninguno compartido con la columna de staging.

### 3.2 Variables de build vs de ejecución

| Momento | Variables | Consecuencia si difieren |
|---|---|---|
| **BUILD** (`next build`) | `APP_ENV`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (deriva el host de Clerk de la CSP y se incrusta en el cliente), `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` (CSP e `images.remotePatterns`), `CSP_REPORT_ONLY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (si se usa), y **`DATABASE_URL`** (`/templates`, `/pricing` y el sitemap leen el catálogo) | El arranque avisa «las variables del servidor no coinciden con las del build» (huella `HILOLUNA_CSP_FINGERPRINT`): **reconstruye** con las mismas variables. |
| **EJECUCIÓN** (`next start`) | `DATABASE_URL`, `CLERK_SECRET_KEY`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `RATE_LIMIT_*`, `LOG_LEVEL` | Se leen al arrancar; cambiarlas solo exige reiniciar. |

Regla práctica: el proveedor debe exponer **las mismas variables `APP_ENV`, `NEXT_PUBLIC_*`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` y `CSP_REPORT_ONLY` en el paso de build y en el de ejecución**.

## 4. Clerk (producción)

1. En el panel de Clerk crea la **instancia de producción** (distinta de la de desarrollo) para `hiloluna.com` y verifica el dominio (registros DNS que Clerk indica; el «Frontend API» suele ser `clerk.hiloluna.com`).
2. Rutas de acceso: **sign-in** `/sign-in`, **sign-up** `/sign-up`; tras iniciar sesión → `/dashboard` (ya configurado en `app/(site)/layout.tsx`).
3. **Dominios/orígenes permitidos**: `https://hiloluna.com` y, si lo usas, `https://www.hiloluna.com`. Añade también el dominio de staging en su propia instancia de prueba.
4. Copia las claves de **producción** (`pk_live_…`, `sk_live_…`) al host. **No mezcles** instancias: el arranque rechaza claves de modos distintos.
5. Correo: configura la verificación de correo obligatoria (la vinculación de cuentas por correo solo ocurre con correo verificado, `user-sync.ts`).
6. **CSP y Clerk**: la política deriva el host de Clerk de la clave pública. Con dominio propio (`clerk.hiloluna.com`) queda cubierto automáticamente. Verifica el inicio de sesión en staging con la consola del navegador abierta (§7).
7. Primer administrador: `docs/ADMIN.md` §2.

## 5. Cloudflare R2 (o S3 compatible)

1. **Estrategia de buckets: un bucket POR ENTORNO** (recomendado y adoptado): `hiloluna-staging-media` para staging y `hiloluna-media` para producción, cada uno con su **token de API** (Object Read & Write **solo sobre ese bucket**) y su dominio público (`media-staging.hiloluna.com` / `media.hiloluna.com`, o el `r2.dev` del bucket en las primeras pruebas). El arranque de staging **avisa** si el nombre del bucket no contiene «staging». La aplicación no soporta prefijos de clave por entorno: no compartas un bucket entre staging y producción.
2. **Dominio público de lectura**: conecta un dominio personalizado (p. ej. `media-staging.hiloluna.com`) al bucket → `S3_PUBLIC_BASE_URL=https://media-staging.hiloluna.com` (https, sin barra final).
3. **CORS del bucket** (las imágenes se suben directamente desde el navegador con una URL firmada). Debe permitir `PUT` desde **solo** los orígenes de ese entorno. No lo aplicamos por ti; configúralo en Cloudflare (bucket → Settings → CORS policy). Ejemplos, uno por bucket:

**Bucket de STAGING** (`hiloluna-staging-media`): su propio origen y, mientras pruebas desde tu máquina, `localhost`.

```json
[
  {
    "AllowedOrigins": ["https://staging.hiloluna.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Bucket de PRODUCCIÓN** (`hiloluna-media`): solo los orígenes reales, **sin `localhost`**.

```json
[
  {
    "AllowedOrigins": ["https://hiloluna.com", "https://www.hiloluna.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

   Añade solo los orígenes que realmente uses (si el staging es una URL temporal del proveedor, pon ESA URL en lugar de `staging.hiloluna.com`). Cómo verificar el CORS real: `docs/STAGING.md` §R2.
4. `next/image` solo optimiza imágenes del host de `S3_PUBLIC_BASE_URL` y de la ruta `/users/**` (`next.config.ts`); nada más.
5. Copias/versionado del bucket: `docs/OPERATIONS.md` §3.

## 5.1 Procesamiento de imágenes (EXIF/GPS)

Al finalizar cada subida el servidor elimina metadatos (EXIF/GPS, IPTC, comentarios) antes de declarar la imagen lista. JPEG/PNG/WEBP sin giro se limpian **sin recodificar**. Solo una foto con **orientación EXIF** (tomada de lado) necesita girarse y usa `sharp`, **el que ya trae Next.js** (dependencia opcional de `next`, cargada bajo demanda). Asegura que el host instale las dependencias opcionales de Next (por defecto sí); si `sharp` no está disponible, esas fotos se **rechazan** con un mensaje claro (nunca se publican con GPS).

## 6. Stripe

`docs/BILLING.md` §5–§7: productos y precios de pago único (499 / 799 / mejora 300 MXN), claves, webhook `https://<dominio>/api/webhooks/stripe` con sus eventos y `STRIPE_WEBHOOK_SECRET`. En staging usa **modo de prueba**; en producción, modo real con precios reales. **Pendiente de decisión: impuestos / Stripe Tax.**

### 6.1 Checklist de Stripe en modo LIVE (antes de vender de verdad)

No se crea nada de esto automáticamente: son pasos manuales en el panel de Stripe, en modo **Live** (interruptor arriba a la izquierda).

1. [ ] Cuenta de Stripe activada para cobrar de verdad (datos fiscales/bancarios verificados por Stripe).
2. [ ] Tres Prices reales, **de pago único** (no recurrentes), en MXN:
   - Esencial: **499 MXN** → `STRIPE_PRICE_ESSENTIAL_ONE_TIME`
   - Premium: **799 MXN** → `STRIPE_PRICE_PREMIUM_ONE_TIME`
   - Mejora Esencial → Premium: **300 MXN** → `STRIPE_PRICE_ESSENTIAL_TO_PREMIUM`
   Los importes deben coincidir EXACTAMENTE con `lib/billing/plans.ts`: `server/billing/stripe-provider.ts` (`verifyPrice`, D-35) verifica el Price real contra Stripe antes de cobrar y rechaza el checkout si no coincide.
3. [ ] Claves **live**: `STRIPE_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…` (el arranque rechaza mezclar live con test).
4. [ ] Webhook real apuntando a `https://hiloluna.com/api/webhooks/stripe`, eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`. Copia su `whsec_…` real a `STRIPE_WEBHOOK_SECRET`.
5. [ ] **Decisión de impuestos pendiente** (Stripe Tax u otra): documentar antes de la primera venta real (BLOCKER, `docs/PRODUCTION_CHECKLIST.md`).
6. [ ] Un pago real de prueba con importe bajo (o el flujo con una tarjeta real propia) antes de anunciar el lanzamiento, si el negocio lo permite.

## 7. Cabeceras de seguridad y CSP

`next.config.ts` aplica (en todas las rutas): `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy` restrictivo, `Cross-Origin-Opener-Policy: same-origin-allow-popups` y, en producción, `Strict-Transport-Security`. Las invitaciones (`/i/**`), el panel, la consola, la vista previa, el acceso y la API llevan además `X-Robots-Tag: noindex, nofollow`; las invitaciones, `Referrer-Policy: no-referrer` (el token del invitado va en la URL) y `Cache-Control: private, no-store`.

**CSP (versión segura compatible con el stack, sin nonce):** `default-src 'self'`; `script-src 'self' 'unsafe-inline'` + el host exacto de Clerk (derivado de la clave pública) + Cloudflare Turnstile; `connect-src` con Clerk y el endpoint de S3/R2; `img-src` con el dominio de medios; `frame-ancestors 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action` con `checkout.stripe.com`; `upgrade-insecure-requests` en producción. Sin comodines globales.

**Excepciones documentadas:**
- `'unsafe-inline'` en `script-src`: Next.js (App Router) emite scripts en línea para hidratar. **Reevaluado en D-37** (fase final de preproducción) con las dos alternativas que documenta Next.js:
  - **CSP con nonce**: exige generar el nonce en `proxy.ts` (por petición) y renderizar **todas** las páginas de forma dinámica (`docs/next.js` lo advierte explícitamente: «all pages must be dynamically rendered»); las páginas estáticas de marketing (`/`, `/templates`, `/pricing`, `/privacy`, `/terms`) perderían la generación estática y la caché de CDN, y la CSP pasaría a construirse en `proxy.ts` en vez de en `next.config.ts` (cambio de arquitectura, no solo de configuración).
  - **SRI (Subresource Integrity) sin nonce**: mantiene la generación estática, pero es una función **experimental** de Next 16 (`experimental.sri`) — activar una feature experimental para producción en esta fase, sin ventana de prueba dedicada, no es prudente («NO romper Next.js»).
  - **Decisión: se mantiene `'unsafe-inline'`, riesgo aceptado para el MVP.** Mitigación existente sin cambios: `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, sin `unsafe-eval` en producción, sin `script-src *`. Revisar de nuevo si se recibe un pentest que lo exija o si el coste de mover el marketing a renderizado dinámico deja de importar.
- `'unsafe-inline'` en `style-src`: Tailwind y estilos en línea de React.
- **Stripe**: el pago es una **redirección** a Stripe Checkout alojado; el navegador no carga Stripe.js, así que no hay hosts de Stripe en `script-src`. Si algún día se añade Stripe.js/Elements, ampliar la CSP (`js.stripe.com`, `api.stripe.com`, frames de Stripe).
- **Resend**: no aplica al navegador — el correo se manda desde el servidor (`server/email/resend-provider.ts`), nunca hay un script ni una llamada de Resend en el cliente. No añade nada a la CSP.
- **Riesgo de compatibilidad con Clerk**: no se ha probado contra una instancia real de Clerk (solo con claves falsas). **Verifica sign-in/sign-up en staging con la consola del navegador abierta.** Procedimiento (detalle en `docs/STAGING.md` §CSP):
  1. Primer despliegue de staging con `CSP_REPORT_ONLY=true` (en el **build** y en la ejecución): la política se envía como `Content-Security-Policy-Report-Only`, no bloquea nada y la consola muestra cada violación («Refused to … because it violates … (report only)»).
  2. Recorre registro, inicio y cierre de sesión, restauración de sesión, subida de imágenes y el redireccionamiento a Stripe Checkout. Anota cada violación y el origen mínimo que la resuelve (nunca un comodín global) en `server/security/csp.ts`.
  3. Sin violaciones: quita `CSP_REPORT_ONLY`, **reconstruye** y repite el recorrido con la CSP aplicándose.
  Diferencia: en Report-Only una violación solo se registra; aplicándose, el navegador **bloquea** el recurso (un Clerk bloqueado = nadie inicia sesión). **No actives producción sin haber completado este recorrido con Clerk real.**
- **Staging** añade `X-Robots-Tag: noindex, nofollow` a TODAS las respuestas (`APP_ENV=staging`), y su `robots.txt` bloquea el sitio entero.

### 7.1 Validación de CSP estricta hecha en esta fase (D-37)

Verificado con un **build de producción real** (`APP_ENV=production`, sin `CSP_REPORT_ONLY`) contra una base de datos temporal, con claves de Clerk/Stripe/Resend/Sentry **falsas** (sin cuentas reales):
- La CSP se **aplica** por defecto (cabecera `Content-Security-Policy`, nunca `-Report-Only`, confirmado con `curl` y con `npm run smoke` en modo `SMOKE_EXPECT_PRODUCTION=1`).
- `HSTS`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` presentes; `X-Powered-By` ausente.
- `robots.txt`/`sitemap.xml` correctos para producción (marketing indexable, `/i/**`/panel/consola/vista previa/acceso bloqueados).
- Hidratación de Next.js, 100 peticiones públicas secuenciales y 100 concurrentes sin error ni señal de fuga de memoria (proceso local).
- **NO verificado** (requiere cuentas reales): que la CSP deje pasar Clerk/Stripe/Resend REALES sin violaciones — sigue siendo el procedimiento manual de arriba, obligatorio antes de activar producción.

## 8. Límite de tasa

Protege: envío de RSVP, consulta de enlaces con `?guest=` y emisión de URLs de subida de imágenes. **No** se aplica al webhook de Stripe. Hoy hay dos implementaciones:
- **Sin proveedor** (`Noop`): no limita nada. Válido en desarrollo. En producción el arranque emite un aviso `SIN LÍMITE DE TASA`.
- **REST compatible con Upstash Redis**: contadores de ventana fija con `INCR` + `EXPIRE … NX` en `POST {RATE_LIMIT_REST_URL}/pipeline`.

**Cómo conectarlo (Upstash):**
1. Crea una base Redis en Upstash (región cercana a la app).
2. Copia su **REST URL** y **REST Token**.
3. `RATE_LIMIT_REST_URL=https://<instancia>.upstash.io`, `RATE_LIMIT_REST_TOKEN=<token>`, `RATE_LIMIT_REQUIRED=true` (para que producción **no arranque** sin él).
4. Reinicia y comprueba que no hay aviso en el arranque.

**Otros proveedores** (Cloudflare KV/D1 u otro Redis): implementa la interfaz `RateLimiter` (`server/security/rate-limit.ts`, método `check(rule, identity)`) y elígela en `createRateLimiter`. **No hay un limitador en memoria a propósito** (no protege con varias instancias).

**Política ante fallos del proveedor:** *fail-open* (se permite el intento y se registra `rate_limit.provider_error`): una caída del limitador **ya conectado** no debe impedir que un invitado confirme su asistencia. Esto es distinto de no tener proveedor: con `RATE_LIMIT_REQUIRED=true` (**obligatorio en producción**, D-37 punto 22) la aplicación **no arranca** si falta `RATE_LIMIT_REST_URL`/`_TOKEN` — no hay un modo silencioso donde producción quede sin límite alguno por una configuración incompleta; el fail-open solo cubre la caída **momentánea** de un proveedor que sí estaba configurado.

**Dirección del cliente (D-37, punto 27 — revisado):** se toma de `cf-connecting-ip`, `x-forwarded-for` (primer valor) o `x-real-ip` (`server/security/client-identity.ts`, `pickClientAddress`). Son fiables **solo** si tu plataforma de alojamiento o tu proxy/CDN las fija y **sobrescribe** las que envíe el cliente directamente; si el host no las sobrescribe, cualquiera podría falsificarlas y esquivar el límite (o hacer que dos invitados compartan cubo). Con Cloudflare delante (o R2, ya en uso): `cf-connecting-ip` la fija Cloudflare y no la puede falsificar el cliente si el origen solo acepta tráfico de Cloudflare. Con cualquier otra plataforma (serverless, edge, o un balanceador/proxy propio): confirma en su documentación que ES ELLA quien fija `x-forwarded-for`/`x-real-ip` en el borde (no solo las reenvía) antes de que la petición llegue a la aplicación, y que la aplicación no es alcanzable saltándose ese borde. Verificación práctica (neutral a la plataforma elegida): registra temporalmente la cabecera cruda que llega (con una ruta de prueba, nunca en producción) y compara contra la IP real de quien prueba; nunca confíes en la cabecera sin haber comprobado que el host la sobrescribe. Detalle específico de la plataforma que elijas: `docs/PRODUCTION_CHECKLIST.md`.

## 9. Registros y salud

- Registros JSON en stdout (`LOG_LEVEL`). Sin servicio externo de observabilidad todavía. Nunca incluyen secretos ni datos personales (`docs/OPERATIONS.md` §9).
- Monitor de vida: `GET /api/health` → `{"status":"ok"}`. Monitor de preparación (base de datos + configuración): `GET /api/health/ready` → 200 `ready` / 503 `not_ready`.

## 10. Dominio y DNS

- **Producción:** `hiloluna.com` (y `www` redirigiendo a la raíz si lo deseas) con HTTPS. `NEXT_PUBLIC_SITE_URL=https://hiloluna.com`. `media.hiloluna.com` → bucket (§5). `clerk.hiloluna.com` y los registros de correo de Clerk según su panel (§4). Webhook de Stripe: `https://hiloluna.com/api/webhooks/stripe`.
- **Staging:** preferencia `staging.hiloluna.com` (registro `CNAME`/`A` que indique el proveedor de despliegue, HTTPS automático) con `NEXT_PUBLIC_SITE_URL=https://staging.hiloluna.com`. Si el proveedor da una **URL temporal** (`https://<app>.<proveedor>.app`), puede usarse desde el primer día: la arquitectura solo necesita esa URL en `NEXT_PUBLIC_SITE_URL` (nada está escrito en el código) y luego se cambia y se reconstruye. Medios: `media-staging.hiloluna.com` (o el `r2.dev` del bucket de staging). Webhook de Stripe (modo de prueba): `https://staging…/api/webhooks/stripe`. La instancia de Clerk de prueba debe listar el dominio de staging.

## 11. Build y arranque

```bash
npm ci                # postinstall ejecuta `prisma generate`
npm run db:deploy     # solo migraciones pendientes (nunca migrate dev/reset/db push)
npm run build         # con las variables de BUILD de §3.2
npm start
```

- Staging ejecuta exactamente esto: `prisma generate` (en `npm ci`/`postinstall`) → `next build` con las variables de build de staging → `next start` con las de ejecución.
- `npm run build` requiere `DATABASE_URL` apuntando a una base **migrada** (el catálogo y el sitemap se generan leyéndola) y, en la primera puesta en marcha, **con las plantillas ya sembradas** (`npm run db:seed:staging` antes del build; si no, las páginas de plantillas quedan vacías hasta el siguiente build). No requiere claves de Clerk/Stripe/S3 para construir, pero sí **las variables públicas de §3.2**.
- Rutas esperadas: estáticas (`/`, `/templates/*`, `/design-system`), dinámicas (`/admin/*`, `/dashboard/*`, `/i/[slug]`, `/pricing`, `/sitemap.xml`, `/api/*`). Ver la tabla del build.
- Ejecuta el build con **claves de prueba**, nunca reales, en CI.

## 12. Checklist de despliegue

Orden **obligatorio** de cada despliegue: **(1) copia de seguridad → (2) `prisma migrate deploy` → (3) build/deploy → (4) `/api/health/ready` → (5) `npm run smoke`**. Nunca `db push`. El paso a paso de staging, con los recorridos manuales, está en `docs/STAGING.md`.

1. [ ] Copia de seguridad de la base de datos (si ya hay datos).
2. [ ] `npm run db:deploy` sin errores; `prisma migrate status` = al día.
3. [ ] Variables de entorno completas (§3), `APP_ENV` declarado y **iguales en build y ejecución** (§3.2); el arranque no reporta errores ni avisos de huella de build.
4. [ ] Clerk: instancia correcta, dominio verificado, claves del mismo modo (§4).
5. [ ] R2: bucket, dominio de medios, CORS, token restringido (§5).
6. [ ] Stripe: precios de pago único, webhook y secreto; **pago de prueba completo en staging** (`docs/BILLING.md` §6).
7. [ ] Límite de tasa conectado y `RATE_LIMIT_REQUIRED=true` (§8).
8. [ ] Dominio, HTTPS, DNS (§10).
9. [ ] `/api/health/ready` responde `ready`.
10. [ ] `npm run smoke` contra el despliegue y el recorrido manual de `docs/SMOKE_TESTS.md`.
11. [ ] Primer administrador asignado (`docs/ADMIN.md` §2).
12. [ ] Textos legales `/privacy` y `/terms` **aprobados** (hoy son borrador) y decisión de impuestos tomada.
13. [ ] Monitoreo de `/api/health/ready` y alertas sobre errores 5xx del webhook en Stripe (§14, §15).
14. [ ] Correo transaccional: dominio verificado en Resend, `EMAIL_REQUIRED=true`, sin `EMAIL_STAGING_ALLOWLIST` (§13).
15. [ ] Checklist completo y clasificado por bloqueador: `docs/PRODUCTION_CHECKLIST.md` (tabla GO/NO-GO).

## 13. Correo transaccional en producción (Resend)

`docs/EMAIL.md` tiene la arquitectura completa; aquí solo lo específico de producción:

1. [ ] Dominio verificado en Resend (el de producción, `hiloluna.com` o un subdominio de correo dedicado) — SPF y DKIM en verde en su panel.
2. [ ] DMARC en modo `p=none` como mínimo (sube a `quarantine`/`reject` con el tiempo, `docs/EMAIL.md` §8.2).
3. [ ] `EMAIL_FROM="Hilo Luna <notificaciones@hiloluna.com>"` con el dominio verificado.
4. [ ] `EMAIL_REQUIRED=true` (el arranque falla sin la clave: no se puede lanzar en silencio sin avisos al anfitrión).
5. [ ] **Quita `EMAIL_STAGING_ALLOWLIST`** (o déjala vacía): esa variable solo tiene efecto con `APP_ENV=staging`; en producción no debe existir para no confundir una futura depuración.
6. [ ] Cuenta de Resend de **producción**, propia (nunca la de staging): claves distintas, remitente propio.
7. [ ] QA de `docs/EMAIL.md` §9 repetido en producción con un evento y una cuenta reales del propietario (no de prueba) antes de anunciar el lanzamiento.

## 14. Monitoreo de errores en producción (Sentry, opcional)

`server/observability/monitoring.ts` tiene el detalle técnico (qué se envía, qué se sanea). En producción:

1. [ ] Proyecto de Sentry **propio de producción** (nunca el mismo que staging: mezclar entornos hace ilegible la lista de errores).
2. [ ] `SENTRY_DSN` del proyecto de producción; `SENTRY_ENVIRONMENT=production` (opcional: si no se declara, usa `APP_ENV`).
3. [ ] Generar un error de prueba controlado ANTES del lanzamiento (p. ej. una ruta temporal que lance una excepción, o forzar un fallo del webhook con una firma inválida) y confirmar que aparece en Sentry con la pila pero sin datos personales.
4. [ ] Revisar manualmente el primer evento capturado: sin correos, sin tokens, sin cuerpos de petición, sin claves.
5. [ ] Alertas recomendadas (configúralas en Sentry o en el monitor externo de `/api/health/ready`, §15): tasa de errores 5xx elevada, el webhook de Stripe fallando repetidamente (`billing.webhook_failed` / `billing.webhook_transient_failure`), `/api/health/ready` en `not_ready` de forma sostenida. No hace falta un sistema de guardias (paging) complejo: un canal de Slack/correo del equipo basta para el lanzamiento.

## 15. Salud para un monitor externo (uptime)

`GET /api/health` (vida) y `GET /api/health/ready` (configuración + base de datos) ya existen y no filtran secretos (solo booleanos). Para conectarlos a un monitor externo (UptimeRobot, Better Uptime, o el propio del hosting) basta una comprobación HTTP simple — **no hace falta instalar ningún SDK**:

1. Monitor HTTP(S) a `https://hiloluna.com/api/health` cada 1–5 min, esperando `200` y (opcional) el cuerpo `{"status":"ok"}`.
2. Monitor HTTP(S) a `https://hiloluna.com/api/health/ready` cada 1–5 min, esperando `200`; una alerta si responde `503` de forma sostenida (más de N minutos, para no avisar por una caída de un segundo).
3. Alerta adicional recomendada: tasa de 5xx del propio proveedor de hosting (casi todos lo ofrecen sin configuración extra).
