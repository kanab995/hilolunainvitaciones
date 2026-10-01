# Operación de Hilo Luna (D-34)

> Guía operativa para staging y producción: copias de seguridad, restauración, retención, soporte y mantenimiento. **No inventa proveedores**: el
> alojamiento y la base de datos gestionada no están decididos (`docs/DEPLOYMENT.md`); donde importa se dice «tu proveedor». Ningún valor es real.

## 1. Fuentes de verdad (qué se respalda y qué no)

| Dato | Dónde vive | ¿Se respalda desde Hilo Luna? |
|---|---|---|
| Cuentas (perfil interno), eventos, invitaciones, publicaciones, invitados, RSVP, compras, auditoría | **PostgreSQL** | **Sí: es lo crítico.** |
| Imágenes subidas | **Almacenamiento de objetos S3 compatible (hoy Cloudflare R2)** | Ver §3. Los archivos NO están en PostgreSQL (solo sus metadatos). |
| Identidad (credenciales, sesiones, verificación de correo, contraseñas) | **Clerk** | No: es de Clerk. Aquí solo se guarda `User.clerkUserId`. Ver §5. |
| Pagos, tarjetas, recibos | **Stripe** | No: **Stripe no necesita copia de seguridad de tarjetas** y Hilo Luna nunca las guarda. Las compras (`EventPurchase`) sí están en PostgreSQL. |
| Código y configuración | Repositorio + variables de entorno del host | Las variables (secretos) se guardan en el gestor de secretos del host, nunca en el repositorio. |

## 2. Copia de seguridad de PostgreSQL

Recomendación (independiente del proveedor):

1. **Copias automáticas diarias** con retención mínima de **14–30 días** y, si el proveedor lo ofrece, **recuperación a un punto en el tiempo (PITR)**. Es lo que más reduce la pérdida de datos (un webhook de pago o un RSVP recién guardado).
2. **Copia manual antes de cada migración** (`prisma migrate deploy`) y antes de operaciones de soporte destructivas. Ejemplo genérico (sustituye la URL; no la pegues en el repositorio ni en un chat):

```bash
pg_dump --format=custom --no-owner --file=hiloluna-$(date +%Y%m%d-%H%M).dump "$DATABASE_URL"
```

3. Guardar las copias **fuera** del mismo proveedor/cuenta que la base de datos (una cuenta comprometida no debe poder borrar también las copias) y **cifradas**.
4. **Probar la restauración** al menos una vez antes del lanzamiento y luego de forma periódica: una copia que nunca se ha restaurado no es una copia.

### Restaurar el volcado (`pg_restore`)

```bash
# 1. Crear una base NUEVA y vacía para restaurar (nunca sobre la dañada ni sobre la de producción).
createdb -h <host> -U <usuario> hiloluna_restaurada

# 2. Restaurar el volcado en esa base nueva.
pg_restore --no-owner --host=<host> --username=<usuario> --dbname=hiloluna_restaurada hiloluna-AAAAMMDD-HHMM.dump

# 3. Verificar antes de usarla (checklist de abajo).
```

### Checklist de restauración

1. Declarar el incidente y **pausar las escrituras** (modo mantenimiento del host o detener la aplicación) para no mezclar datos.
2. Restaurar la copia en una base de datos **nueva** (no sobre la dañada) con `pg_restore` (arriba) y comprobar que las tablas clave tienen filas: `User`, `Event`, `Invitation`, `InvitationPublication`, `Guest`, `Rsvp`, `EventPurchase`, `WebhookEvent`.
3. Aplicar las migraciones pendientes si la copia es anterior a la última versión: `npm run db:deploy` (contra la base restaurada; **nunca `migrate reset`**) y confirmar `prisma migrate status` = al día.
4. Apuntar `DATABASE_URL` a la base restaurada y arrancar. Comprobar `/api/health/ready` y ejecutar `npm run smoke`.
5. **Conciliar pagos**: comparar en Stripe (Dashboard → Pagos) los cobros de la ventana perdida con `EventPurchase`. Reenviar los eventos de webhook que faltan (Dashboard → Webhooks → reenviar, o `stripe events resend evt_…`); el webhook es idempotente y verifica cada pago contra Stripe.
6. Los RSVP y borradores guardados después de la copia se pierden: avisar a los anfitriones afectados si procede.

**Simulacro realizado (D-37):** se ejecutó el procedimiento completo de arriba contra una base PostgreSQL real de verificación (nunca la del propietario): `pg_dump --format=custom` de una base con plantillas, un evento, un usuario y un invitado → `createdb` de una base nueva → `pg_restore --no-owner` → `prisma migrate status` respondió **«Database schema is up to date!»** → los conteos de `User`/`Template`/`Event`/`Guest`/`EmailDelivery` fueron **idénticos** entre el origen y la base restaurada → la base de verificación se eliminó al terminar. El procedimiento documentado funciona tal cual está escrito; falta repetirlo alguna vez contra el proveedor real de staging/producción (los pasos son los mismos, solo cambian host/usuario).

## 3. Imágenes (Cloudflare R2 / S3 compatible)

- **Retención y copia — política adoptada (D-37, deliberadamente simple para esta fase):** **no** se duplican todos los archivos automáticamente (una réplica completa de todo el bucket es coste y complejidad que esta fase no justifica). En su lugar:
  1. Activa el **versionado de objetos** de R2 en el bucket de producción (gratis, revierte un sobrescrito/borrado accidental reciente sin infraestructura extra). Es la única medida que se recomienda activar ya.
  2. Si más adelante se decide una réplica periódica a otro proveedor, es una tarea aparte y explícita (no se implementa aquí).
  3. R2 no hace copias de seguridad por sí mismo: sin versionado, un borrado es permanente.
- **Qué ocurre si se borra un objeto** (accidental o por `npm run media:orphans -- --apply`):
  - El registro `MediaAsset` correspondiente pasa a `DELETED` (se conserva como constancia; nunca se borra la fila) o, si el borrado fue directo en el bucket sin pasar por la aplicación, el registro queda apuntando a una clave que ya no existe (imagen rota al servirse).
  - **Cómo recuperar**: con versionado de objetos activado, restaura la versión anterior desde el panel de R2 (o su API) usando la misma clave (`MediaAsset.storageKey`); la aplicación no necesita ningún cambio, porque la URL pública se deriva de esa clave. Sin versionado, solo queda restaurar desde una copia de la base de datos + bucket hecha ANTES del borrado (§2), y solo si esa copia del bucket existe.
  - Un objeto borrado por accidente **nunca** se recupera solo restaurando la base de datos: la fila `MediaAsset` no contiene el binario.
- **Política de retención**: mientras un `MediaAsset` esté `READY` y referenciado (portada, galería o sede de un evento, publicado o en borrador), se conserva indefinidamente — no hay expiración por antigüedad. Los huérfanos (`PENDING` > 24 h sin verificar, o `READY` sin ninguna referencia > 24 h) son candidatos a limpieza **manual** (`npm run media:orphans`, §6); nunca se borra un archivo publicado.
- **Coherencia con la base de datos**: los registros `MediaAsset` guardan la clave del objeto. Restaurar la base de datos sin restaurar el bucket (o al revés) deja imágenes rotas o huérfanas: restaura ambos al mismo momento cuando sea posible. Los objetos que ya no tienen registro se pueden detectar comparando el bucket con `MediaAsset.storageKey`.
- **Privacidad**: el binario que se guarda ya no contiene EXIF/GPS (se elimina al verificar la subida). Las fotos anteriores a esta fase pueden conservarlos: no hay migración retroactiva (deuda documentada en `docs/DATABASE_SCHEMA.md` §14.2). Procedimiento para identificarlas: §3.1.
- **Claves de R2**: el token de la aplicación solo debe tener Object Read & Write sobre el bucket de Hilo Luna. Rótalo si se sospecha filtración (`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`).

### 3.1 Identificar imágenes antiguas con posible EXIF/GPS (sin reprocesar en masa)

La normalización de imágenes (D-34) solo se aplica a las subidas verificadas **después** de esa fase. No hay forma de saber, sin inspeccionar el archivo, si uno anterior conserva metadatos — la base de datos no guarda «tenía EXIF o no». Procedimiento de identificación (sin tocar nada):

1. Candidatas: `MediaAsset` con `status = 'READY'` y `createdAt` **anterior** a la fecha de despliegue de D-34 (la fecha exacta de tu propio despliegue; anótala al lanzar).
   ```sql
   SELECT id, "storageKey", "createdAt" FROM "MediaAsset" WHERE status = 'READY' AND "createdAt" < '<fecha de despliegue de D-34>' ORDER BY "createdAt" ASC;
   ```
2. Para confirmar de verdad (la fecha es un indicio, no una certeza — una migración de datos previa podría alterar `createdAt`), descarga una muestra con el SDK de S3 o el panel de R2 y revisa sus metadatos con una herramienta como `exiftool` (no se ejecuta desde la aplicación).
3. **No reprocesar en masa sin un plan**: reescribir binarios existentes es una operación irreversible sobre archivos que pueden estar referenciados por publicaciones ya servidas (`InvitationPublication.mediaAssetIds`); antes de automatizar algo, decidir: ¿se reemplaza el objeto en el mismo `storageKey` (más simple, no rompe referencias) o se crea uno nuevo? Esto queda **fuera de esta fase**: aquí solo se documenta cómo identificarlas.

## 4. Stripe

- No hay nada que respaldar en Stripe. Los recibos y datos de facturación viven allí.
- **Recuperación tras perder un webhook**: reenvía los eventos desde el panel de Stripe; los repetidos se ignoran.
- **Reconciliar un pago que no cambió el plan**: `/admin/purchases` (¿hay una compra `PENDING`?) → `/admin/webhooks` → registros del servidor (`billing.payment_rejected` indica el motivo sin importes) → `docs/BILLING.md` §9.
- **Reembolsos**: no hay pantalla; se hacen en Stripe. Un reembolso total pasa la compra a `REFUNDED` y retira el plan (no borra nada).

## 5. Clerk

- **Clerk es la fuente de la identidad**: contraseñas, factores, sesiones y verificación de correo. Hilo Luna solo guarda `User.clerkUserId`, `email` y `name`.
- Si se pierde la base de datos pero no Clerk, las personas pueden volver a iniciar sesión, pero su `User` se crearía de nuevo (vinculación por correo verificado, `server/services/user-sync.ts`) y **no** recuperarían sus eventos hasta restaurar la base de datos.
- Exporta la lista de usuarios de Clerk desde su panel si necesitas un respaldo de identidades.

## 6. Mantenimiento periódico

| Tarea | Cómo | Frecuencia sugerida |
|---|---|---|
| Archivos huérfanos (subidas abandonadas, imágenes sin uso) | Consola → Resumen → «Analizar huérfanos» (solo lectura). Limpieza: `npm run media:orphans` (análisis), luego `npm run media:orphans -- --apply --confirm=DELETE`. Umbral: 24 h. Nunca borra un archivo publicado. | Mensual o si el almacenamiento crece raro |
| Revisar webhooks y compras `PENDING` antiguas | Consola → Webhooks / Compras (filtro «Pendiente») | Semanal en el lanzamiento |
| Auditoría de cambios de administración | Consola → Auditoría | Cuando haya varios administradores |
| Tabla `Subscription` (legacy, sin uso) | `SELECT count(*) FROM "Subscription";` — verificado en la base de datos temporal de esta fase: **0 filas** (ninguna prueba automatizada la usa; ningún código de la aplicación la lee ni la escribe desde D-32). Ejecuta la misma consulta contra **tu** base antes de decidir: si también es 0, se puede eliminar con una migración explícita (`DROP TABLE "Subscription"; DROP TYPE "SubscriptionStatus"; DROP TYPE "BillingInterval";`). **No se elimina automáticamente ni en esta fase**: falta tu confirmación explícita sobre tu base real. | Una vez, antes del lanzamiento |
| Dependencias | `npm audit` (sin `--force`) y actualizar con cuidado | Mensual |

## 7. Política de eliminación de cuentas y datos (SIN implementar; procedimiento manual de soporte)

**No existe «borrar cuenta»** en la aplicación. Qué ocurre hoy con los datos de una cuenta (`User`) y por qué:

| Dato | Relación | Efecto al borrar el `User` en la base de datos |
|---|---|---|
| `Event` (y todo lo que cuelga: invitación, secciones, publicaciones, invitados, RSVP, sedes, galería…) | `owner` con `onDelete: Cascade` | Se borra en cascada. |
| `MediaAsset` (metadatos) | `owner` con `Cascade` | Se borran los registros; **los objetos del bucket NO** (quedan huérfanos y hay que borrarlos aparte). |
| `BillingCustomer` | `Cascade` | Se borra la referencia local; el cliente sigue existiendo en Stripe. |
| **`EventPurchase`** | `Restrict` (hacia `Event` y `User`) | **Bloquea el borrado.** El historial financiero no se borra en cascada por diseño: contabilidad, disputas y reembolsos. |
| **`AdminAuditLog`** | `Restrict` (hacia el administrador) | Bloquea el borrado de un administrador con acciones registradas. |
| `Subscription` (legacy) | `Cascade` | Se borra (sin uso). |

**Por qué `Restrict` bloquea**: un evento con compras no se puede borrar mientras existan sus `EventPurchase`; y un usuario con eventos con compras tampoco. Es una protección deliberada, no un error.

**Procedimiento manual de soporte** (solo con solicitud verificada de la persona titular; guarda un registro de la solicitud):

1. Verificar la identidad de quien solicita (correo verificado de la cuenta).
2. Copia de seguridad de la base de datos (§2).
3. **Sin compras**: borrar sus eventos y, después, el `User` (los eventos se borran en cascada). Borrar sus objetos del bucket (claves `users/<userId>/…`). Eliminar la cuenta en Clerk desde su panel.
4. **Con compras**: no se pueden borrar. Alternativa: **anonimizar** — cambiar `User.name`/`email` a valores no identificables (p. ej. `eliminado-<id>@hiloluna.invalid`), desvincular `clerkUserId`, borrar invitados/RSVP/imágenes del evento (los datos personales de terceros) y conservar las compras. Documentar qué se conserva y por qué (obligación contable). **[PENDIENTE de revisión legal: plazos y base legal de conservación.]**
5. Cancelar/anonimizar el cliente en Stripe si procede (desde Stripe).
6. Confirmar a la persona qué se borró y qué se conservó.

Una función de «borrar cuenta» autoservicio queda como trabajo futuro (requiere decidir la política de conservación de compras).

## 8. Retención de datos (estado actual)

- Los eventos de pago están disponibles públicamente hasta **30 días después de la fecha del evento** (`Event.paidAccessEndsAt`); después `/i/[slug]` muestra «Esta invitación ya no está disponible.» **Nada se borra**: los datos siguen en la base de datos y el anfitrión puede seguir viéndolos. Un evento Gratis no expira por ahora.
- No hay borrado automático de eventos, invitados, RSVP ni imágenes. La política definitiva de conservación está **pendiente de decisión legal/comercial**.

## 9. Registros y observabilidad

- Los registros son **JSON de una línea por evento** en stdout (`server/observability/logger.ts`); el host los recoge. Nivel con `LOG_LEVEL` (`info`, `warn`, `error`).
- **Nunca** contienen secretos, tokens de invitación, correos, teléfonos ni mensajes/respuestas de RSVP (redacción por nombre de campo y por forma del valor en `server/observability/redact.ts`; los errores se reducen a nombre/código/tipo). Un NOMBRE de variable de entorno (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) se distingue de un token real y no se enmascara — así un aviso de configuración sigue diciendo QUÉ variable corregir.
- Eventos útiles: `startup.config_warnings`, `billing.payment_rejected` (motivo), `billing.webhook_failed` / `billing.webhook_transient_failure`, `rate_limit.provider_error`, `media.orphan_cleanup`, `rsvp.save_failed`, `publish.failed`, `health.database_unreachable`, `email.sent` / `email.failed` / `email.skipped`.
- **Monitoreo de errores (Sentry, opcional, D-37)**: `logger.error(...)` reenvía la excepción a Sentry si `SENTRY_DSN` está configurado (`server/observability/monitoring.ts`); sin esa variable, no hace nada (ni carga el SDK). Nunca envía la petición ni el usuario; el mensaje y las migas de pan se sanean con las mismas reglas que el registro. Sin tracing de rendimiento (muestra 0 a propósito). Ver `docs/DEPLOYMENT.md` §14 para el checklist de producción.
- Salud: `GET /api/health` (vida) y `GET /api/health/ready` (configuración + base de datos) para el monitor del host (`docs/DEPLOYMENT.md` §15: cómo conectar un monitor externo tipo UptimeRobot/Better Uptime). Sin analítica de marketing todavía (`docs/DEPLOYMENT.md`).

## 10. Cookies y seguimiento

Hoy solo hay cookies técnicas de sesión (Clerk) y **ninguna analítica ni publicidad de terceros**, por eso no hay banner de cookies. **Debe reevaluarse** (aviso de privacidad y, si aplica, consentimiento) en cuanto se añada cualquier analítica, píxel o servicio que use cookies/almacenamiento no esencial.
