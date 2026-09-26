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

1. la sesión está **cobrada** (`payment_status = paid`);
2. trae exactamente **un precio** y es uno **conocido** (una de las tres variables `STRIPE_PRICE_…`);
3. el plan de ese precio coincide con `targetPlan`;
4. la moneda es **MXN** y el importe cobrado es **exactamente** el esperado (`499`, `799` o la diferencia `300`, en centavos);
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
