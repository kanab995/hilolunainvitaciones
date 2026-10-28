# Compras por evento y Stripe (D-32) — guía de configuración y pruebas

> Modelo comercial: **UN pago único por evento, sin renovación mensual.** Decisión de arquitectura: `docs/ARCHITECTURE.md` D-32 (sustituye a D-31,
> el modelo de suscripción mensual por usuario). Datos: `docs/DATABASE_SCHEMA.md` §17. Rutas: `docs/ROUTES.md`.
> Ningún valor de este documento es real: son marcadores. **No pegues claves reales en el repositorio.**

## 1. Modelo comercial

| Plan | Precio (pago único, por evento) | Invitados | Imágenes de galería |
|---|---|---|---|
| Gratis | $0 MXN | 30 | 5 |
| Esencial | $499 MXN | 100 | 15 |
| Premium | $799 MXN | 300 | 40 |

- El plan pertenece al **evento**, no a la cuenta: una misma persona puede tener un evento Gratis, otro Esencial y otro Premium.
- **No hay límite de eventos** por cuenta ni por plan. Un evento nuevo nace **Gratis** y se mejora desde su propio dashboard («Mejorar evento»).
- Las features actuales (publicar, enlaces personalizados, QR, calendario, fotos propias) están activas en todos los planes por configuración.
- Precios, moneda, límites y variables de Stripe viven en **un solo archivo**: `lib/billing/plans.ts`. Nada más escribe «499» o «799».
- **Impuestos:** no se implementa Stripe Tax ni cálculo fiscal. Los importes se tratan como el precio mostrado; la política fiscal debe definirse antes de una operación comercial real.

## 2. Cómo funciona

1. Desde el dashboard de un evento, «Mejorar evento» abre un panel con Gratis, Esencial y Premium. Cada botón es un formulario que envía **solo** `eventId` y `plan` (`ESSENTIAL` | `PREMIUM`) a una Server Action.
2. El servidor exige sesión, comprueba que el evento es **del usuario** (uno ajeno = «no encontrado»), calcula qué se compra y resuelve el precio desde las variables de entorno. El cliente nunca envía un precio.
3. Crea (o reutiliza) el cliente de Stripe del usuario, crea una **Checkout Session en modo `payment`** (pago único), anota una compra `PENDING` y redirige a Stripe. Metadata mínima: `hiloLunaUserId`, `eventId`, `targetPlan`.
4. Stripe cobra y llama al **webhook** `POST /api/webhooks/stripe`. **Solo el webhook verificado concede el plan.** Volver a `/dashboard/events/[id]?payment=success` no activa nada: muestra «Estamos confirmando tu pago…» hasta que la compra queda confirmada.
5. El plan de un evento sale de la base de datos (compras `PAID`); no se llama a Stripe en cada petición.

### 2.1 Qué verifica el webhook antes de conceder un plan

El evento de Stripe es solo un aviso: el servidor vuelve a leer la sesión de cobro y **no confía en la metadata**. Se concede solo si TODO se cumple:

1. la sesión está **cobrada** (`payment_status = paid`), o completada sin cobro porque un código de 100 % dejó el total en 0 (§14);
2. trae exactamente **un precio** y es uno **conocido** (una de las tres variables `STRIPE_PRICE_…`);
3. el plan de ese precio coincide con `targetPlan`;
4. la moneda es **MXN** y el importe cobrado es **exactamente** el esperado (`499`, `799` o la diferencia `300`, en centavos), o ese precio menos el descuento de un código promocional de Stripe, siempre que las cuentas cuadren (§14);
5. el evento existe y su propietario es el usuario de la metadata (y del cliente de Stripe, si está registrado);
6. una mejora exige que el evento ya tenga **Esencial pagada**.

Además: firma obligatoria (`Stripe-Signature`), idempotencia por id de evento (`WebhookEvent`) y por sesión de cobro (una compra por sesión), y todo en una transacción. Los eventos `customer.subscription.*` del modelo anterior se **ignoran** y no conceden nada.

Eventos que se procesan: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed` y `charge.refunded` (solo reembolso total).

## 3. Mejoras y plan efectivo

- Se permite: Gratis → Esencial, Gratis → Premium (directo, $799) y Esencial → Premium. **No hay bajada de plan ni recompra.**
- **Esencial → Premium cobra solo la diferencia** ($799 − $499 = **$300**, calculada de `lib/billing/plans.ts`: no está escrita a mano). Estrategia elegida: un **precio de Stripe específico de la mejora** (`STRIPE_PRICE_ESSENTIAL_TO_PREMIUM`), porque calcular un importe dinámico en Checkout obligaría a crear precios al vuelo. Si se cambia un precio en `plans.ts`, hay que actualizar también el precio de la mejora en Stripe (el webhook rechaza cualquier cobro que no coincida con el importe configurado).
- El **historial financiero no se sobrescribe**: la mejora es una **segunda compra** (`kind = UPGRADE`, plan Premium, importe 300). Ejemplo: compra 1 = Esencial, 499, PAID; compra 2 = Premium (mejora), 300, PAID. El plan efectivo es el **mayor plan de las compras `PAID`** (`getEffectiveEventPlan`).
- Un pago **fallido, pendiente o cancelado no cambia el plan** (un evento Esencial que intenta la mejora y falla sigue Esencial; uno Gratis que falla sigue Gratis). Un **reembolso total** pasa la compra a `REFUNDED` y retira el plan que concedía; nada se borra.
- Si se paga dos veces por error (dos pagos abiertos a la vez), el plan no cambia con el segundo y queda registrado en el historial: se corrige con un reembolso manual desde Stripe.

## 4. Ventana de acceso

- `Event.paidAccessEndsAt` (y `accessStartsAt` / `accessEndsAt` en cada compra). Regla: **acceso completo hasta 30 días después de la fecha del evento**.
- Comprar **después** del evento: `max(compra + 30 días, evento + 30 días)`, así siempre hay al menos 30 días desde la compra.
- Si un evento de pago **cambia de fecha**: `paidAccessEndsAt = max(fin actual, nueva fecha + 30 días)`. Mover el evento hacia adelante **extiende** el acceso; hacia atrás **nunca lo acorta**. Se aplica dentro de la transacción del guardado del borrador. Una mejora posterior tampoco lo acorta.
- Se muestra como «Disponible hasta 16 de junio de 2027» en el dashboard del evento y en «Compras y planes», con el texto «Tu invitación permanecerá disponible hasta 30 días después del evento.»
- **Expiración (preparada, no aplicada):** `getEventAccessState` devuelve `free | active | expired` e `isEventAccessActive()` lo resume. Hoy la invitación pública **no** consulta esto: vencer no cierra nada ni borra datos. Siguiente paso de enforcement (fuera de esta fase): que `/i/[slug]` responda «Esta invitación ya no está disponible.» cuando `expired`. Un evento Gratis no expira.

## 5. Configuración en Stripe (modo de prueba primero)

1. **Productos y precios** (Catálogo de productos), en **modo de prueba**, todos **de pago único (NO recurrentes)** y en **MXN**:
   - «Hilo Luna Esencial» → 499 MXN → `STRIPE_PRICE_ESSENTIAL_ONE_TIME`.
   - «Hilo Luna Premium» → 799 MXN → `STRIPE_PRICE_PREMIUM_ONE_TIME`.
   - «Hilo Luna: mejora de Esencial a Premium» → 300 MXN → `STRIPE_PRICE_ESSENTIAL_TO_PREMIUM`.
   - «Hilo Luna: archivo listo para imprimir» → 199 MXN, impuestos incluidos → `STRIPE_PRICE_ADDON_PRINT_FILE` (complemento, §13; opcional).
2. **Claves** (Desarrolladores → Claves de API): `STRIPE_SECRET_KEY` (`sk_test_…`) y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`).
3. **Webhook** (Desarrolladores → Webhooks → Añadir endpoint): URL `https://<tu-dominio>/api/webhooks/stripe`; eventos: los de §2.1. Copia su secreto `whsec_…` → `STRIPE_WEBHOOK_SECRET`. Sin él no se cobra (no se podrían activar los planes).
4. **Recibos:** en Configuración → Correos electrónicos activa «Correos de recibos de pago exitoso». Hilo Luna no construye facturas ni UI de recibos.
5. **Customer Portal:** ya no es esencial (un pago único no tiene nada que «administrar»). La integración se conserva por si se usa para recibos, pero **ninguna pantalla la presenta como gestión del plan**.
6. Variables en `.env` (ver `.env.example`). **Las variables mensuales anteriores ya no se usan:** `STRIPE_PRICE_ESSENTIAL_MONTHLY` y `STRIPE_PRICE_PREMIUM_MONTHLY` se pueden borrar de tu `.env` (esta migración no toca tu `.env`; actualízalo tú).

Sin `STRIPE_SECRET_KEY` la aplicación funciona con todos los eventos en Gratis, `/pricing` se muestra y el pago responde «Los pagos todavía no están configurados en este entorno.». Claves de modos distintos (`sk_test` con `pk_live`) se reportan como inconsistencia, nombrando variables y nunca valores.

## 6. Probar en local con Stripe CLI

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

`stripe listen` imprime un `whsec_…` **de esa sesión**: úsalo como `STRIPE_WEBHOOK_SECRET` local y reinicia el servidor. Después:

1. Crea un evento (queda **Gratis**) y comprueba el límite de 30 invitados.
2. En el dashboard del evento pulsa «Mejorar evento» → Esencial → paga con `4242 4242 4242 4242` (cualquier fecha futura y CVC). Al volver verás «Estamos confirmando tu pago…» y, tras el webhook, «Plan Esencial · Disponible hasta …». Ya puedes pasar de 30 a 100 invitados.
3. «Mejorar evento» → «Mejorar por $300 MXN» → pago → el evento pasa a Premium (300 invitados) y «Compras y planes» muestra las dos compras.
4. Otro evento del mismo usuario sigue **Gratis**. Cierra sesión y vuelve a entrar: los planes persisten.
5. Pago fallido: `4000 0000 0000 0002` (el evento conserva su plan). Reenviar un evento: `stripe events resend evt_…` (idempotente).

## 7. Producción

1. Crea los tres productos/precios también en **modo real** (los `price_…` son distintos) y las claves `sk_live_…` / `pk_live_…`.
2. Endpoint de webhook real (`https://hiloluna.com/api/webhooks/stripe`), mismos eventos y su `whsec_…` propio.
3. Variables en el servidor de producción (no en el repositorio). No mezcles claves de prueba con precios reales.
4. Decisiones comerciales pendientes: **impuestos / Stripe Tax** y datos fiscales, política de reembolsos, textos legales, y si algún día habrá cupones, cuotas o precios por otra moneda.

## 8. Datos anteriores (modelo mensual)

La tabla `Subscription` (y `SubscriptionStatus` / `BillingInterval`) del modelo anterior queda como **legacy sin uso**: no se lee ni se escribe y **no se convierte en compras** (no sabemos a qué evento correspondería). Si tuviera filas de prueba, se ignoran; se puede eliminar con una migración explícita cuando se confirme que está vacía. `BillingCustomer` y `WebhookEvent` se reutilizan. Las suscripciones que existieran en Stripe (modo de prueba) no conceden nada: los eventos `customer.subscription.*` se ignoran.

## 9. Diagnóstico

- **Pagó y el plan no cambia:** revisa que el endpoint de webhook esté activo con los eventos de §2.1 y que `STRIPE_WEBHOOK_SECRET` corresponda a ese endpoint. El dashboard del evento reconcilia una vez con Stripe al volver del pago, pero el webhook sigue siendo la fuente de verdad.
- **El pago se cobró pero no concede el plan:** el log del servidor registra `pago cs_… rechazado (motivo)` (`rejected_amount`, `rejected_currency`, `rejected_price`, `rejected_owner`…) sin importes ni datos personales. Lo más común: el precio de Stripe no está en MXN o su importe no coincide con `lib/billing/plans.ts`.
- **«Los pagos todavía no están configurados»:** falta `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` o algún precio (el log nombra la variable, nunca su valor).

## 10. Consola de administración

Las compras se pueden consultar (solo lectura) en `/admin/purchases` y en el historial de cada evento (`/admin/events/[id]`), con los ids del proveedor enmascarados; los webhooks procesados, en `/admin/webhooks`; y la configuración de Stripe (presente/ausente, nunca valores) en el resumen de `/admin`. La consola **no** marca pagos, no concede planes, no reembolsa ni edita importes: el webhook verificado sigue siendo la única autoridad (`docs/ADMIN.md`).

## 11. Protección contra doble cobro (D-34)

**Riesgo resuelto:** dos sesiones de pago abiertas para el mismo evento podían cobrarse dos veces. Estrategia (en `startEventCheckout`):

1. **Antes de crear la sesión** se revisan las compras `PENDING` y `FAILED` del evento (últimas 25 h), la más reciente primero, consultando el estado real de su sesión en Stripe:
   - **misma compra, sesión abierta** → se devuelve el mismo enlace de pago (no se crea otra sesión);
   - **sesión ya completada** (pagó, el webhook aún no llegó) → `payment_pending`: «Ya hay un pago de este evento en proceso…»; no se abre otra;
   - **sesión abierta de otro plan** (p. ej. Esencial abierta y ahora se elige Premium) → se caduca en Stripe (best-effort) para que no puedan pagarse los dos;
   - **sesión caducada o inexistente** → la compra pendiente pasa a `CANCELED` y se puede reintentar sin obstáculos.
2. **La sesión nueva** se crea con una **clave de idempotencia** de Stripe estable por intento: hash de usuario + evento + plan + tipo + ventana de 30 minutos + nº de compras ya registradas del evento. Dos peticiones simultáneas (doble clic) coinciden y Stripe devuelve **la misma sesión**; una sola compra `PENDING` (una fila por sesión). Al cambiar la ventana o registrarse otra compra, la clave cambia y nunca se devuelve una sesión caducada.
3. Las sesiones llevan `expires_at` de **31 minutos** (Stripe exige ≥ 30): una sesión abandonada caduca sola y su webhook `checkout.session.expired` cierra la compra pendiente.

**Residual:** una carrera exacta en el borde de la ventana de 30 minutos, o dos pagos completados en paralelo en dos pestañas ya abiertas, sigue siendo posible aunque muy improbable; se corrige con un reembolso manual en Stripe (el segundo pago queda en el historial). Un webhook nunca concede dos planes por el mismo pago.

**Reintentos del webhook:** el evento solo se registra en la misma transacción que aplica su efecto; un fallo temporal de la base de datos responde 503 (`Retry-After`), otros fallos 500; Stripe reintenta y el reintento procesa el evento. Ver `tests/hardening/billing-hardening.test.ts`.

**Verificación del Price antes de cobrar (staging):** antes de crear la sesión, `startEventCheckout` consulta el `price_…` real en Stripe (`BillingProvider.verifyPrice`) y exige que esté **activo, sea de pago único, y tenga exactamente el importe y la moneda** de `lib/billing/plans.ts` (Esencial 499, Premium 799, mejora 300 MXN). Si no coincide, el checkout **falla de forma segura** (`invalid_config`, «La configuración de pagos de este entorno es inconsistente…») **sin abrir cobro, sin crear cliente ni compra pendiente**, y se registra `billing.price_mismatch` con la variable afectada. Motivo: antes solo el webhook comprobaba el importe, así que un Price mal configurado cobraba al cliente y luego se rechazaba el plan. Un resultado correcto se recuerda 5 minutos (una llamada a Stripe por precio, no por checkout); un fallo transitorio de Stripe no se toma por desajuste (error genérico y reintento).

## 12. Checklist de producción (resumen)

1. [ ] **Modo de prueba (staging)**: 3 productos/precios de pago único en MXN (Esencial 499, Premium 799, mejora Esencial → Premium 300), claves `sk_test_…`, webhook a staging con su `whsec_…`.
2. [ ] Pago de prueba completo: compra, mejora, doble clic (una sola sesión), pago fallido y reenvío de un evento (idempotente).
3. [ ] **Modo real (producción)**: los mismos 3 productos/precios en modo real (los `price_…` son distintos), claves `sk_live_…`/`pk_live_…`, endpoint `https://hiloluna.com/api/webhooks/stripe` con los eventos de §2.1 y su `whsec_…` propio. No mezcles claves de prueba con precios reales (el arranque avisa de modos distintos).
4. [ ] Recibos activados (Configuración → Correos electrónicos).
5. [ ] Decisión de **impuestos / Stripe Tax** y datos fiscales: **PENDIENTE**.
6. [ ] Política de reembolsos definida (los reembolsos se hacen en Stripe; un reembolso total retira el plan).
7. [ ] Alertas por fallos 5xx del webhook en el panel de Stripe.

## 13. Complemento «Archivo listo para imprimir» (D-48)

Compra **opcional e independiente del plan**, por evento: **$199 MXN, impuestos aplicables incluidos**, solo para eventos **Esencial y Premium**
(por ahora, bodas). Incluye el **archivo digital en PDF**; no la impresión física ni el envío de tarjetas. Vive en su propia tabla
(`EventAddonPurchase`): **nunca** cambia el plan del evento, ni su acceso de pago, ni la mejora Esencial → Premium, ni los precios de los planes.

### 13.1 Flujo completo

1. **Vista previa** (`/dashboard/events/[id]/print`): libre, PNG con marca de agua, con la invitación PUBLICADA. Muestra el precio, qué incluye y
   hasta qué fecha funcionará el QR impreso (fin del acceso del evento = 30 días después del evento).
2. **«Comprar · $199 MXN»** solo aparece si: la venta está encendida (`PRINT_ADDON_ENABLED=1`) + Stripe configurado + `STRIPE_PRICE_ADDON_PRINT_FILE`
   + plan Esencial o Premium + invitación de boda publicada + no comprado ya. Un evento Gratis ve «Mejorar evento».
3. **Server Action** (`startPrintAddonCheckoutAction`): el navegador solo envía el id del evento. El servidor comprueba sesión y propiedad, que
   se pueda imprimir, el plan, que no esté comprado, reutiliza una sesión abierta (o avisa «confirmando» si ya se pagó), verifica el `price_…`
   real en Stripe (activo, pago único, 19 900 centavos MXN), crea o reutiliza el cliente y abre una sesión **`mode: payment`** con metadata
   `{ hiloLunaUserId, eventId, addon: "PRINT_FILE" }` (sin `targetPlan`, también copiada al PaymentIntent) y clave de idempotencia estable.
   Anota la compra `PENDING` (a lo sumo una por evento y complemento, ver §13.2).
4. **Pago en Stripe** → regreso a la versión para imprimir con `?payment=success` (o `canceled`, sin cargo). El regreso **no desbloquea nada**:
   reconcilia una vez con Stripe con las mismas verificaciones que el webhook y muestra «Estamos confirmando tu pago…».
5. **Webhook** (el mismo endpoint firmado e idempotente): la ruta la decide el **precio cobrado**. Desbloquea solo si el precio es el del
   complemento, la metadata no lo contradice, MXN y 19 900 exactos, y el evento es del usuario. Guarda la compra `PAID` con su `unlockKey`.
6. **Correo** «Tu invitación lista para imprimir | Hilo Luna» (Resend, `ADDON_PURCHASE_CONFIRMATION`, `docs/EMAIL.md`): nombre del evento,
   producto y un enlace a la sección del PANEL (pide sesión). Sin PDF adjunto ni enlace público de descarga. Uno por compra que desbloquea.
7. **Descarga**: «Descargar PDF para imprimir» (formato, reverso, QR, iniciales, ciudad, marcas de corte), **ilimitada**, generada en cada
   petición desde la versión publicada vigente y protegida por sesión + propiedad del evento + compra pagada. Nunca se guarda en el bucket.
8. **Historial**: «Compras y planes» muestra, dentro de cada evento y APARTE de los pagos del plan, el producto, el precio pagado, la fecha, el
   estado, «Ir a la descarga» y el reembolso si lo hubo. La consola lo lista en `/admin/purchases/addons` (§13.5).
9. **Reembolso total** en Stripe → `charge.refunded` → la compra pasa a `REFUNDED` y libera su desbloqueo; si no queda otro cobro pagado del
   complemento, la descarga deja de estar disponible (se puede volver a comprar). Un reembolso parcial no cambia nada. Reembolsar el PLAN no
   toca el complemento (se pagó aparte).

`/pricing` presenta el complemento («También en papel, igual de especial») **sin venderlo**: no hay botón de compra; con la venta apagada se
rotula «Muy pronto». La compra siempre se hace desde el evento, después de la vista previa.

### 13.2 Contra cobros duplicados (dos pestañas, doble clic, reintentos)

| Capa | Qué evita |
|---|---|
| El botón no aparece si ya está comprado; el servicio responde `already_purchased` | Volver a comprar algo ya pagado |
| Una sesión **abierta** del complemento se reutiliza (mismo enlace); una **completada** solo avisa «confirmando» | Abrir otra sesión mientras la primera sigue viva o ya se pagó |
| Clave de idempotencia estable (usuario + evento + complemento + ventana de 30 min + nº de compras) y **caducidad fija dentro de la ventana** | Doble clic o dos pestañas a la vez = la MISMA sesión de Stripe (mismos parámetros) |
| Si Stripe responde «clave en uso» (dos peticiones en el mismo instante), se espera 1,5 s y se reutiliza la sesión de la otra pestaña | Un error visible en la segunda pestaña |
| **Índice parcial** `EventAddonPurchase_one_pending_per_event_addon`: a lo sumo UNA compra `PENDING` por evento y complemento. Si dos pestañas abren sesiones distintas (justo en el cambio de ventana), la segunda no se registra, **se caduca en Stripe** y se usa la primera | Dos sesiones pagables a la vez |
| Webhook idempotente (`WebhookEvent`) | Aplicar dos veces el mismo aviso |
| `unlockKey` única + CHECK | Dos desbloqueos pagados del mismo complemento |

Con todo eso, un segundo cobro solo puede venir de fuera del flujo normal (p. ej. una sesión creada a mano en Stripe). Si ocurre, queda
**`PAID` sin desbloqueo**, se registra `billing.addon_duplicate_payment` (Sentry), aparece como **«Cobro duplicado»** en la consola y en el
historial del cliente («lo revisaremos para reembolsarlo») y se reembolsa con §13.6.

### 13.3 Garantías sobre planes y precios

El complemento nunca crea, cambia ni reembolsa compras de planes, no mueve `Event.paidAccessEndsAt`, no se lee al calcular el plan
(`getEffectiveEventPlan` solo recibe `EventPurchase`) y su precio no puede ser el de un plan (`resolveStripeConfig` rechaza precios repetidos).
Los precios de los planes no cambian ($0 / $499 / $799). Lo comprueban `tests/billing/addon.test.ts` y `tests/billing/addon-safety.test.ts`.

### 13.4 Activar (solo con la autorización del propietario)

Crea el precio de pago único de 199 MXN (modo de prueba en staging, real en producción), ponlo en `STRIPE_PRICE_ADDON_PRINT_FILE` y enciende
`PRINT_ADDON_ENABLED=1`. Encendido sin precio, o con un precio mal formado (no `price_…`) o repetido, la validación del entorno solo AVISA y el complemento queda apagado («Muy pronto»): un complemento mal configurado nunca invalida los pagos de los planes, el webhook ni el arranque del sitio. Para apagar la venta:
`PRINT_ADDON_ENABLED=0` (las compras ya hechas siguen descargándose). Antes del primer despliegue con este código se aplican dos migraciones
aditivas (`20261019120000_add_event_addon_purchases`, `20261020120000_addon_single_pending_and_confirmation_email`); `npm run build` las aplica
a la base de datos de ESE entorno.

### 13.5 Consola

`/admin/purchases/addons` (enlace «Ver complementos» desde Compras): búsqueda por evento o usuario, filtro por estado y **«Solo cobros
duplicados»**, aviso con el número de duplicados pendientes. El detalle (`/admin/purchases/addons/[id]`) muestra si ese cobro desbloquea,
la fecha de reembolso, ids enmascarados, el id del evento, cómo buscarlo en Stripe y TODAS las compras del complemento en ese evento. El
detalle de cada evento (`/admin/events/[id]`) tiene su panel «Complementos». Solo lectura, con `requireAdmin()`, como el resto de la consola.

### 13.6 Procedimiento: reembolsar un cobro duplicado

1. `/admin/purchases/addons?flag=duplicate` → abre la fila marcada **«Cobro duplicado»** (desbloquea: **No**).
2. Anota el **id del evento**, la fecha, el importe y los últimos cuatro caracteres del pago (`pi_••••••abcd`).
3. Panel de Stripe → **Pagos** → busca `metadata["eventId"]:"<id del evento>"`. Aparecen los dos cobros de 199 MXN: elige el que coincide en
   fecha y terminación con la fila duplicada.
4. **Reembolsar → importe completo** (un reembolso parcial no cambia nada en Hilo Luna).
5. Comprueba: en la consola la fila pasa a **«Reembolsada»** y el aviso de duplicados baja; el cliente conserva la descarga.

Si por error se reembolsa el cobro que desbloqueaba, **el desbloqueo pasa al otro cobro pagado** (`billing.addon_unlock_transferred`): el
cliente no pierde la descarga mientras quede un pago. Solo al reembolsar ambos se retira.

### 13.7 Prueba completa en staging (Stripe en modo de prueba)

**Nunca con claves de producción**: solo `sk_test_`/`pk_test_`, la base de datos de STAGING y `APP_ENV=staging`. Los pasos con casillas
están en `docs/STAGING.md` §10.1; en resumen: checkout, webhook, desbloqueo, descarga, correo, dos pestañas, cobro duplicado y su
reembolso, reembolso total, evento Gratis, y que el plan del evento no cambie en ningún caso.

**Pendiente**: revisión fiscal (B2) antes de cobrar en producción; reintento manual del correo del complemento (hoy `retryFailedEmailDelivery`
solo cubre compras de planes).

## 14. Códigos de descuento (Stripe)

La página de pago de Stripe muestra **«Agregar código promocional»** en todos los cobros (planes, mejora y complemento). Los códigos se
crean y administran **solo en el panel de Stripe**: Hilo Luna nunca aplica un descuento por su cuenta, no guarda códigos y no tiene
pantalla para crearlos.

**Cómo verifica el webhook un cobro con descuento** (`chargeMatchesPrice`, `server/billing/provider.ts`): el punto 4 de §2.1 se amplía.
El precio de lista de la sesión (`amount_subtotal`) debe ser EXACTAMENTE el esperado, el descuento (`total_details.amount_discount`) no
puede ser negativo ni mayor que el precio, y lo cobrado debe ser precio − descuento. El resto de comprobaciones no cambia.

**100 % de descuento (cortesía):** Stripe completa la sesión sin cobrar (`payment_status = no_payment_required`, total 0, **sin
`payment_intent`**). Cuenta como pagada solo si la sesión está `complete` y su total es 0. La compra queda en el historial con importe
`$0` y el correo de confirmación dice «Pago: $0 MXN».
**Ojo:** una cortesía no se puede «reembolsar»: no hay cobro que devolver. Si hiciera falta retirarla, hoy no hay forma desde la
aplicación (deuda conocida).

**Crear un código** (Stripe → modo real, o modo de prueba para ensayar):

1. **Catálogo de productos → Cupones → Crear cupón.**
   - Tipo: porcentaje (p. ej. **100 %** para una cortesía) o importe fijo en **MXN**.
   - Duración: **Una vez** (son pagos únicos).
   - **Aplicar a productos específicos**: elige SOLO el producto que quieres (p. ej. «Plan Esencial»). Sin esta restricción el
     código serviría también para Premium, la mejora y el archivo para imprimir.
2. Dentro del cupón: **Crear código promocional** → escribe el código (p. ej. `SOBRINO`).
   - **Limitar a 1 canje** si es para una sola persona; opcional: fecha de caducidad y «solo primera compra».
3. Comparte el código. En la página de pago la persona toca «Agregar código promocional», lo escribe y paga (o termina sin pagar si
   es 100 %).

Desactivar un código en Stripe impide usarlo desde ese momento; no afecta a las compras ya hechas.
