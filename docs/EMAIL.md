# Correo transaccional (D-36)

> Alcance de esta fase: avisar al ANFITRIÓN de un RSVP nuevo y de una compra confirmada (inicial o mejora). **Nada de correo a
> invitados, recordatorios, campañas, boletines ni seguimiento de apertura/clic.** Clerk sigue mandando los suyos (registro,
> verificación, recuperación de acceso) y Stripe el recibo de pago si lo activas en su panel; esto no los duplica.

## 1. Arquitectura: `EmailProvider`

Mismo patrón que `BillingProvider` (`docs/ARCHITECTURE.md` D-32): el dominio y el servicio (`server/email/service.ts`) dependen
solo de la interfaz `EmailProvider` (`server/email/provider.ts`). Nadie fuera de `server/email/*-provider.ts` importa el SDK de
un proveedor concreto.

| Módulo | Rol |
|---|---|
| `server/email/provider.ts` | Interfaz `EmailProvider`, `EmailMessage`, `EmailProviderState` |
| `server/email/resend-provider.ts` | Único módulo que importa `resend` |
| `server/email/dev-provider.ts` | Desarrollo sin `RESEND_API_KEY`: no manda nada, registra un aviso mínimo (destinatario enmascarado) |
| `server/email/config.ts` | Lee y valida `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` (lógica pura) |
| `server/email/index.ts` | Elige el proveedor activo (mismo patrón que `server/billing/index.ts`) |
| `server/email/templates.ts` | Plantillas puras (HTML + texto) de los tres correos |
| `server/email/sanitize.ts` | Escapado de HTML e inyección de cabeceras |
| `server/email/staging-safety.ts` | Lista blanca de staging y prefijo `[STAGING]` |
| `server/email/run-after.ts` | `after()` de Next: el correo nunca bloquea la respuesta |
| `server/email/service.ts` | `sendRsvpNotification`, `sendPurchaseConfirmation`, `sendUpgradeConfirmation`, `retryFailedEmailDelivery` |
| `server/repositories/email-delivery.ts` | ÚNICO módulo que toca Prisma para correo (destinatario, `EmailDelivery`) |

Añadir otro proveedor (SES, Postmark…) es escribir otro adaptador que cumpla `EmailProvider` y elegirlo en `server/email/index.ts`;
no se toca `service.ts` ni los llamadores.

## 2. Qué dispara cada correo

| Correo | Se dispara desde | Condición |
|---|---|---|
| Nuevo RSVP | `server/services/public-rsvp-runtime.ts` (`onSaved`), tras `submitPublicRsvpFor` | El invitado respondió y **cambió** el estado o el número de asistentes respecto a lo que había (comparado en la MISMA transacción de guardado, `server/repositories/public-invitations.ts`). Reenviar exactamente la misma respuesta NO manda un correo nuevo. |
| Confirmación de compra | `server/services/billing-webhook.ts`, tras `confirmPayment` → `"granted"` | Solo cuando el webhook CONCEDIÓ el plan de verdad (nunca desde `?payment=success`, nunca en `already_paid` ni en un evento de webhook repetido). `kind = INITIAL`. |
| Confirmación de mejora | Igual que arriba | `kind = UPGRADE` (Esencial → Premium, la diferencia real pagada). |

Ninguno de los tres lee `to`/`subject`/`from` del navegador: el servidor resuelve siempre el destinatario (`User.email` del
propietario del evento, nunca el correo de un invitado ni el del payload del RSVP) y construye el asunto y el cuerpo.

## 3. Sin bloquear la respuesta: `after()`

Next 16 estabilizó `after()` (Server Actions y Route Handlers): el correo se intenta DESPUÉS de que la respuesta ya se envió al
invitado o a Stripe, con un límite de 8 s (`EMAIL_SEND_TIMEOUT_MS`, `server/email/service.ts`). No se introdujo una cola (Redis
u otra): un intento por disparo. Fuera del ciclo de vida de una petición (pruebas, scripts) `after()` lanza; `run-after.ts` lo
detecta y ejecuta el efecto igualmente, sin esperar su promesa.

**Garantía**: un fallo de plantilla, de proveedor o de temporización se registra (`email.failed`) y NUNCA se propaga — el RSVP ya
quedó guardado y la compra ya quedó confirmada antes de intentar el correo.

## 4. Idempotencia: `EmailDelivery`

`docs/DATABASE_SCHEMA.md` §20 tiene el detalle de columnas. Resumen práctico:

- **Compra / mejora**: `@@unique([kind, purchaseId])`. Verificado contra PostgreSQL real: una segunda fila con el mismo
  `(kind, purchaseId)` falla con `P2002`; el servicio lo interpreta como «ya se intentó» y no reenvía. Cubre el caso normal
  (Stripe reintenta el webhook) sin depender de que `WebhookEvent` haga todo el trabajo.
- **RSVP**: `purchaseId` es `NULL`, así que la restricción no aplica entre dos notificaciones de RSVP (Postgres no trata dos
  `NULL` como iguales). El control está en el propio guardado del RSVP: solo se llama a `onSaved` con `changed: true` cuando el
  estado o el número de asistentes cambiaron.
- Nunca se guarda el asunto ni el cuerpo del correo, ni la clave del proveedor: solo metadatos (`kind`, destinatario por
  referencia, `eventId`/`purchaseId`/`rsvpId`, estado, `providerMessageId`, `errorCode` saneado, fechas).

## 5. Seguridad de staging

`APP_ENV=staging` (D-35) no debe poder avisar a una persona real que se registró de prueba:

- `EMAIL_STAGING_ALLOWLIST` (correos separados por comas). **Sin lista, staging no manda NINGÚN correo** (fail-closed; no es
  «permitir a todos»). Fuera de la lista, la fila queda `SKIPPED` con motivo `staging_not_allowlisted`.
- Todo asunto que sí se envía en staging lleva el prefijo `[STAGING] `. En producción nunca se añade.

## 6. Privacidad y PII

- El correo del RSVP **nunca** incluye: `inviteToken`, el id interno del invitado, ids de Clerk, ni el mensaje que dejó el
  invitado (se queda en el dashboard; el CTA «Ver invitados» lleva ahí).
- Toda variable (nombre del invitado, título del evento) se ESCAPA (`escapeHtml`) antes de insertarse en el HTML: nunca se
  inserta HTML de confianza. `sanitizeHeaderValue` quita saltos de línea de `subject`/`from`/`replyTo` (inyección de cabeceras);
  nunca se construyen a partir de datos de un invitado.
- Los registros (`email.sent` / `email.failed` / `email.skipped`) llevan `kind`, `deliveryId` y `eventId` si aplica — **nunca**
  el destinatario completo, el asunto, el cuerpo ni la clave de API (el logger central ya redacta por nombre de campo y por
  forma del valor, `server/observability/logger.ts`; esto es una segunda capa deliberada).
- La consola (`/admin/emails`) muestra el destinatario ENMASCARADO (`ma••••@ejemplo.com`, `lib/admin/mask.ts`) y nunca el asunto
  ni el cuerpo (no se guardan).

## 7. Consola: solo lectura, sin botón de reenvío

`/admin/emails` lista tipo, destinatario enmascarado, estado y fecha — igual que `/admin/webhooks` y `/admin/purchases`.
**Decisión explícita**: NO se añadió un botón «Reintentar» en la consola. CLAUDE.md declara la consola «de solo lectura salvo
`Template.publicationStatus` y `Template.minimumPlan`»; añadir una escritura nueva ahí contradice ese contrato sin aprobación
expresa. En su lugar, `retryFailedEmailDelivery(deliveryId)` (`server/email/service.ts`) queda **preparado y funcional**
(reabre la MISMA fila `FAILED`, reconstruye el correo con los datos ACTUALES de la compra y reintenta) pero sin ningún punto de
entrada desde la interfaz. Cubre solo `PURCHASE_CONFIRMATION`/`UPGRADE_CONFIRMATION` (tienen toda la información en
`EventPurchase`); `RSVP_NOTIFICATION` responde `"unsupported"` — no se guarda el estado en el momento del intento fallido, así
que no hay un valor de "número de asistentes" fiable para reconstruirlo después. Si en el futuro se decide exponer el reintento,
es una línea de servidor (`requireAdmin()` + esta función) y una decisión consciente de ampliar el alcance de la consola.

## 8. Configuración

### 8.1 Variables (`.env.example`)

| Variable | Notas |
|---|---|
| `RESEND_API_KEY` | `re_…`. Sin ella: desarrollo usa `DevEmailProvider`; fuera de desarrollo, no se envía nada (`email.skipped`). |
| `EMAIL_FROM` | `Hilo Luna <notificaciones@hiloluna.com>` (dominio verificado en Resend). Sin barra de nombre también vale un correo simple. |
| `EMAIL_REPLY_TO` | Opcional. Nunca el correo de un invitado. |
| `EMAIL_REQUIRED` | `true` = producción FALLA al arrancar sin `RESEND_API_KEY` válida (recomendado antes de lanzar). |
| `EMAIL_STAGING_ALLOWLIST` | Solo relevante con `APP_ENV=staging`. Ver §5. |

### 8.2 Configuración manual en Resend

1. Crea la cuenta y añade el dominio (`hiloluna.com` o un subdominio dedicado de correo, p. ej. `mail.hiloluna.com`).
2. **DNS** — Resend genera los registros exactos al añadir el dominio (su panel los muestra tal cual; **no los inventes aquí**):
   - **SPF**: un registro `TXT` que autoriza a Resend a enviar por tu dominio.
   - **DKIM**: uno o más registros `TXT`/`CNAME` de firma (Resend los llama `resend._domainkey` o similar).
   - Verificación de dominio propia de Resend (otro `TXT`).
   Cópialos EXACTAMENTE como los muestra el panel de Resend en el momento de configurar; cambian por cuenta y por dominio.
3. **DMARC** (recomendado antes de producción, no incluido automáticamente): añade un registro `TXT` en `_dmarc.<dominio>` con
   una política inicial de monitoreo, por ejemplo `v=DMARC1; p=none; rua=mailto:<tu correo de alertas>;` — `p=none` primero
   (solo reporta, no rechaza) y se sube a `quarantine`/`reject` una vez que SPF y DKIM llevan un tiempo sin fallos. No se
   inventa una política agresiva de entrada.
4. Genera una API Key (permiso de solo envío si Resend lo ofrece) → `RESEND_API_KEY`.
5. `EMAIL_FROM` debe usar el dominio verificado, p. ej. `Hilo Luna <notificaciones@hiloluna.com>`.
6. En **staging**, usa el mismo dominio verificado (o uno de prueba de Resend) y rellena `EMAIL_STAGING_ALLOWLIST` con los
   correos de quienes prueban. Recorrido de QA de staging: `docs/STAGING.md` (o el checklist del §9 de este documento).

### 8.3 Checklist antes de producción

- [ ] Dominio verificado en Resend (SPF + DKIM en verde en su panel).
- [ ] DMARC en modo `p=none` como mínimo (§8.2 punto 3).
- [ ] `EMAIL_FROM` usa el dominio verificado.
- [ ] `EMAIL_REQUIRED=true` (el arranque falla si falta la configuración).
- [ ] Recorrido de QA (§9) completado en staging con destinatarios reales de la lista blanca.
- [ ] Revisar `/admin/emails` unos días: proporción de `FAILED` razonable, sin patrones de `SKIPPED` inesperados.

## 9. QA manual (staging)

1. Owner de prueba dentro de `EMAIL_STAGING_ALLOWLIST`.
2. Crear un RSVP (ATTENDING) desde el enlace del invitado → debe llegar «… confirmó su asistencia».
3. Cambiar la respuesta a DECLINED → debe llegar un segundo correo («… no podrá asistir»). Volver a enviar la MISMA respuesta
   sin cambiar nada → **no** debe llegar un tercero.
4. Comprar Esencial (tarjeta de prueba) → «Tu evento ya tiene Hilo Luna Esencial», con el importe real (499 MXN).
5. Mejorar a Premium → «Tu evento ahora es Premium», con la diferencia real (300 MXN), no 799.
6. Revisar los registros del host durante los tres envíos: sin correos completos, sin `RESEND_API_KEY`, sin asunto ni cuerpo.
7. Revisar `/admin/emails`: tres filas `SENT`, destinatario enmascarado, sin datos de más.

## 10. Deuda / fuera de alcance (a propósito)

- Correo a invitados (confirmaciones, recordatorios de RSVP, recordatorio del evento).
- Campañas, boletines, cualquier cosa de marketing; sin enlace de baja porque no aplica (correo estrictamente transaccional).
- Webhook de Resend (`delivered`/`bounced`/`opened`/`clicked`): `SENT` hoy solo significa «el proveedor lo aceptó».
- Reintento desde la consola (§7): la función existe, la interfaz no.
- Preferencias de notificación por anfitrión (hoy: siempre activadas para RSVP).
- Reembolsos: no generan correo (Stripe puede mandar el suyo si se configura en su panel).
