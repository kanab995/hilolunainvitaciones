# Consola de administración interna (D-33)

> Herramienta INTERNA para operar Hilo Luna. No es una función para clientes ni un panel de "superusuario": consulta el estado del producto, el
> catálogo de plantillas y las compras, y detecta problemas operativos. Decisión: `docs/ARCHITECTURE.md` D-33. Datos: `docs/DATABASE_SCHEMA.md` §18.
> Rutas: `docs/ROUTES.md`. Ningún valor de este documento es real.

## 1. Quién es administrador

- El rol vive **solo en PostgreSQL**: `User.role` (`enum UserRole { USER ADMIN }`, por defecto `USER`). Todo usuario nace `USER`.
- **No se deduce** del correo, del dominio, de un parámetro de URL ni de metadatos de Clerk enviados por el cliente. El primer usuario registrado
  **no** es administrador automáticamente y no hay ningún correo escrito en el código.
- **No hay ninguna pantalla, acción ni endpoint para ascender a alguien.** El rol se concede a mano en la base de datos (§2). La consola muestra el rol,
  pero es de solo lectura.
- `requireAdmin()` (`server/auth/admin.ts`) es el ÚNICO punto de decisión: exige sesión de Clerk → resuelve el `User` → lee su `role` de la base de
  datos → exige `=== "ADMIN"`. Ante cualquier duda (sin rol, rol desconocido, error al leerlo, origen de datos de demostración) **falla cerrado**.
  Sin sesión → `/sign-in`; sin privilegios → `404` (igual que una ruta que no existe: no se revela que la consola existe).
- Toda página y toda Server Action de `/admin/**` llama a `requireAdmin()` (los layouts no se vuelven a ejecutar al navegar entre páginas hijas y
  un enlace oculto no es una barrera). `proxy.ts` es solo la primera barrera (exige sesión en `/admin/**`).
- El enlace «Administración» del menú de cuenta solo aparece para administradores; es una cortesía de navegación, no una barrera.

## 2. Cómo convertir tu usuario en ADMIN (bootstrap manual)

Requisitos: haber iniciado sesión al menos una vez en la aplicación con tu cuenta (así existe tu fila en `User`) y tener acceso a la base de datos.

**Con Prisma Studio** (recomendado):

```bash
npm run db:studio
```

1. Abre la tabla `User` y localiza **tu fila** por `email` (usa el correo con el que inicias sesión).
2. Cambia la columna `role` de `USER` a `ADMIN` y pulsa «Save 1 change».
3. Vuelve a la aplicación y abre `/admin` (recarga la página; no hace falta cerrar sesión).

**Con SQL** (alternativa, si prefieres `psql` o el editor de tu proveedor). Sustituye el correo por el tuyo:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'tu-correo@example.com';
```

Comprueba que se afectó **una** fila. Para revocar el acceso: `UPDATE "User" SET "role" = 'USER' WHERE "email" = '…';`. Hazlo siempre contra la base de
datos correcta (la de producción no es la de desarrollo). Aplica antes las migraciones pendientes: `npm run db:deploy`.

## 3. Qué muestra y qué NO hace

| Sección | Ruta | Contenido |
|---|---|---|
| Resumen | `/admin` | Usuarios, eventos, invitaciones publicadas, invitados, RSVP y compras pagadas; eventos por plan efectivo; ingresos (total y 30 días); compras Esencial/Premium/mejoras; acceso de pago por vencer/vencido; archivos; salud del sistema; actividad reciente |
| Usuarios | `/admin/users`, `/admin/users/[id]` | Lista con búsqueda (nombre/correo) y paginación de servidor (25); detalle con sus eventos, plan efectivo de cada uno y compras |
| Eventos | `/admin/events`, `/admin/events/[id]` | Lista con filtros (publicación, tipo, plan efectivo); detalle con propietario, plantilla, publicación, plan, acceso, conteos y **historial de compras** |
| Plantillas | `/admin/templates` | Lista de todo el catálogo; **edita solo** visibilidad (`publicationStatus`) y plan mínimo del evento (`minimumPlan`) |
| Compras | `/admin/purchases`, `/admin/purchases/[id]` | Lista con filtros (estado, tipo, plan); detalle con ids del proveedor **enmascarados** |
| Webhooks | `/admin/webhooks` | Eventos del proveedor de pagos ya procesados (proveedor, id parcial, tipo, fecha) |
| Auditoría | `/admin/audit` | Cambios de administración (quién, qué, antes → después). Solo lectura |

**No implementado a propósito:** impersonar usuarios, borrar usuarios/eventos, botón de reembolso, conceder planes a mano, modificar compras (marcar
pagada, cancelar, editar importe o moneda), exportar CSV, acciones masivas, mensajería de soporte, feature flags, registro de auditoría completo,
analítica externa. **La consola nunca modifica el contenido de los clientes.** Stripe y el webhook verificado siguen siendo la única autoridad sobre las compras.

## 4. Plantillas: campos editables

- Editables: `publicationStatus` (Visible / Oculta / Archivada) y `minimumPlan` (Gratis / Esencial / Premium = plan mínimo **del evento**).
- NO editables desde la consola: `name`, `slug`, `designStatus` y el resto de metadatos (el servicio solo reenvía esas dos claves; se prueba).
- **Ocultar** una plantilla (`DRAFT`/`ARCHIVED`) la retira de las **nuevas** selecciones (catálogo, alta de evento, cambio de plantilla). Las invitaciones
  ya publicadas **siguen funcionando** (la página pública lee su snapshot, no la tabla de plantillas) y sus propietarios pueden seguir **publicando
  cambios** (republicar no exige que la plantilla siga visible).
- Cambiar `minimumPlan` **no toca ningún evento existente**: solo afecta a futuras selecciones y cambios de plantilla.
- Ocultar y cambiar el plan mínimo piden confirmación dentro de un diálogo («¿Ocultar Magnolia del catálogo?», «Las invitaciones ya existentes seguirán
  funcionando.», «Este cambio solo afectará nuevas selecciones.»). Sin `window.confirm`.
- El catálogo público (`/templates`, `/pricing`) se genera de forma estática: la acción revalida esas rutas para que el cambio surta efecto de inmediato.
- `npm run db:seed` fija `publicationStatus` y `minimumPlan` **solo al crear** una plantilla; al repetir el seed no pisa lo que decidió el administrador.

## 5. Privacidad: mínimo necesario (frontera de datos)

- La consola lee mediante `server/repositories/admin.ts` (único módulo con Prisma para `/admin/**`) y entrega **DTOs mínimos** (`server/admin/dto.ts`);
  ningún modelo de Prisma llega a la interfaz.
- **Nunca** se cargan: correos, teléfonos, mensajes, respuestas RSVP ni `inviteToken` de invitados (de los invitados solo hay **conteos** y el resumen de
  confirmaciones); contraseñas; ids de Clerk (solo «Vinculada / Sin vincular»); datos de tarjeta; el contenido (`snapshot`) de las publicaciones;
  cuerpos ni firmas de webhooks (la tabla no los guarda).
- Los identificadores del proveedor de pagos (sesión, pago, cliente) se muestran **enmascarados** (`cs_test_••••••wxyz`, `cus_••••••1234`): sirven para
  localizarlos en el panel del proveedor, no para usarlos. El cliente de Stripe se muestra como «Presente / No registrado».
- **Salud del sistema** (`server/admin/health.ts`): solo «Configurado / No configurado» por servicio (base de datos, almacenamiento, Clerk, Stripe) y los
  **nombres** de las variables que faltan; nunca un valor. Stripe se considera configurado con `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y los tres
  precios de pago único.
- **Archivos**: total, tamaño aproximado, subidas `PENDING` de más de 24 h y archivos `READY` sin ninguna referencia (borrador, sedes, portada ni publicación
  vigente). Es un diagnóstico informativo: no borra nada.
- La tabla `Subscription` (legacy) **no se lee** en ningún punto de la consola. Para confirmar que está vacía antes de eliminarla en una migración
  explícita: `SELECT count(*) FROM "Subscription";`.

## 6. Ingresos y monedas

- «Ingresos brutos registrados» = suma de `EventPurchase.amount` con `status = PAID` (nunca `PENDING`, `FAILED`, `REFUNDED` ni `CANCELED`), en MXN.
  Un reembolso total pasa la compra a `REFUNDED` y deja de contar como ingreso actual. No es contabilidad: no incluye impuestos, comisiones ni conciliación.
- Las compras pagadas en **otra moneda** no se suman como pesos ni se convierten: se muestran aparte. Hoy el webhook solo acepta MXN, así que aparecen solo si
  alguien insertó datos a mano.
- «Últimos 30 días» filtra por `paidAt`. «Compras Esencial / Premium» son compras iniciales pagadas; «Mejoras» son las `UPGRADE` pagadas.

## 7. Plan efectivo y acceso (mismas reglas que el producto)

- El plan efectivo de un evento se calcula con `getEffectiveEventPlan` (mayor plan de sus compras `PAID`; sin ninguna, Gratis) y el acceso con
  `getEventAccessState` / `isEventAccessActive`. **No hay un segundo cálculo especial** para la consola.
- Los FILTROS por plan y por publicación de la lista de eventos son esas mismas reglas escritas como condición de base de datos (`eventPlanWhere`,
  `eventPublicationWhere`); una prueba las contrasta exhaustivamente con las funciones de dominio, y se comprobó su equivalencia contra PostgreSQL real.
- Acceso: «Activo» / «Expirado» / «Sin compra» (un evento Gratis no expira). Todavía **no se bloquea** la invitación pública al vencer (D-32).

## 8. Operación

- **Listas**: `?page=&q=&status=&plan=…` en la URL, validadas contra listas blancas; 25 por página; orden por defecto «más recientes» con desempate por id.
- **Webhooks**: solo aparecen los eventos **procesados** (`WebhookEvent`: proveedor, id, tipo, fecha). Los ignorados o con error no se registran; para
  depurarlos hay que mirar los registros del servidor (`docs/BILLING.md` §9) y el panel de Stripe.
- **Diagnóstico habitual**: un evento pagado que no cambia de plan → compras del evento (`/admin/events/[id]`): ¿hay una compra `PENDING`? → webhook
  (`/admin/webhooks`) y `docs/BILLING.md` §9.
- **Deuda conocida**: la auditoría cubre solo los cambios de plantillas (lo único que la consola modifica); el rol no se puede gestionar desde la
  interfaz; sin expiración de la invitación pública; sin cuotas de almacenamiento.

## 9. Auditoría y archivos huérfanos (D-34)

- **Auditoría** (`AdminAuditLog`): cada cambio REAL de visibilidad o plan mínimo de una plantilla deja una entrada con el administrador, la plantilla y los campos que cambiaron (antes → después), en la misma transacción que el cambio. Un cambio que no modifica nada no deja entrada. Solo se inserta: nadie edita ni borra entradas desde la aplicación. Se consulta en `/admin/audit` (últimas 50) y en el resumen. No contiene datos personales ni secretos. Un administrador con entradas de auditoría no se puede borrar de la base de datos (FK `Restrict`).
- **Huérfanos**: el resumen tiene «Analizar huérfanos» (solo lectura: cantidad y tamaño estimado). **No hay botón de borrado** en la consola. La limpieza es manual: `npm run media:orphans` (análisis) y `npm run media:orphans -- --apply --confirm=DELETE` (borra un lote; vuelve a comprobar cada archivo antes de borrarlo y nunca toca uno publicado). Política: subidas `PENDING` de más de 24 h y archivos `READY` sin referencias (borrador ni publicación vigente) de más de 24 h.
