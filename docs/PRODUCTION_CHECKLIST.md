# Checklist de producción — GO / NO-GO (D-37)

> Consolida lo verificado en `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/STAGING.md`, `docs/BILLING.md`, `docs/EMAIL.md` y
> `docs/ADMIN.md`. **No declara producción lista mientras exista un BLOCKER sin resolver.** Todo lo marcado como verificado en esta
> fase se probó contra servicios **falsos** o una base de datos **temporal** (nunca las cuentas ni la base de datos reales del
> propietario): el resto exige tus propias cuentas de producción y queda como trabajo tuyo.

## Clasificación

- **BLOCKER** — no se lanza sin esto. Pone en riesgo dinero, datos de personas o la ley.
- **REQUIRED** — se espera antes de anunciar el lanzamiento, pero un fallo aquí no es catastrófico el primer día.
- **OPTIONAL** — mejora la operación; puede quedar para después del lanzamiento.

## 1. BLOCKER

| # | Punto | Estado | Dónde |
|---|---|---|---|
| B1 | Textos legales de `/privacy` y `/terms` **aprobados** por un abogado (hoy son borrador, marcados `DRAFT`) | ❌ Pendiente de ti | `docs/OPERATIONS.md` §10, checklist legal en §4 de este documento |
| B2 | Decisión de impuestos / facturación (Stripe Tax u otra) tomada y configurada | ❌ Pendiente de ti | `docs/DEPLOYMENT.md` §6.1 |
| B3 | Stripe en modo **live**: cuenta activada para cobrar, 3 Prices reales verificados, claves `sk_live_`/`pk_live_`, webhook real | ❌ Pendiente de ti (cuenta real) | `docs/DEPLOYMENT.md` §6.1 |
| B4 | CSP aplicándose (`enforcing`) **con Clerk real**, sin violaciones bloqueantes en sign-up/sign-in/dashboard/editor/admin | ⚠️ Aplicándose verificado con claves falsas; **falta con Clerk real** | `docs/DEPLOYMENT.md` §7, §7.1; `docs/STAGING.md` §6 |
| B5 | Proveedor de límite de tasa real conectado y `RATE_LIMIT_REQUIRED=true` | ❌ Pendiente de ti (cuenta de Upstash real) | `docs/DEPLOYMENT.md` §8 |
| B6 | Copias automáticas de la base de datos activas (proveedor gestionado) con retención mínima 14–30 días | ❌ Pendiente de ti (proveedor de base de datos) | `docs/OPERATIONS.md` §2 |
| B7 | Restauración probada **contra el proveedor real** (el procedimiento ya se probó contra Postgres real de verificación en esta fase; falta repetirlo con tu proveedor) | ⚠️ Procedimiento verificado; falta con tu proveedor | `docs/OPERATIONS.md` §2 |
| B8 | R2 de producción: bucket propio, CORS sin `localhost`, token restringido | ❌ Pendiente de ti (cuenta de R2 real) | `docs/DEPLOYMENT.md` §5 |
| B9 | Decisión del alojamiento (host de Node.js) tomada, con build y ejecución exponiendo las mismas variables (`docs/DEPLOYMENT.md` §3.2) | ❌ Pendiente de ti | `docs/DEPLOYMENT.md` §0, §3.2 |
| B10 | Dominio y HTTPS de producción activos (`hiloluna.com`) | ❌ Pendiente de ti | `docs/DEPLOYMENT.md` §10 |

## 2. REQUIRED

| # | Punto | Estado | Dónde |
|---|---|---|---|
| R1 | Resend de producción: dominio verificado, `EMAIL_REQUIRED=true`, sin `EMAIL_STAGING_ALLOWLIST` | ❌ Pendiente de ti (cuenta real) | `docs/DEPLOYMENT.md` §13 |
| R2 | Primer administrador asignado a mano en la base de producción | ❌ Pendiente de ti | `docs/ADMIN.md` §2 |
| R3 | Monitor externo de `/api/health` y `/api/health/ready` conectado | ❌ Pendiente de ti | `docs/DEPLOYMENT.md` §15 |
| R4 | Monitoreo de errores (Sentry) configurado y probado con un error de prueba controlado | ❌ Pendiente de ti (opcional pero recomendado) | `docs/DEPLOYMENT.md` §14 |
| R5 | Alertas: 5xx elevados, webhook de Stripe fallando, `/api/health/ready` caído sostenido | ❌ Pendiente de ti | `docs/DEPLOYMENT.md` §14, §15 |
| R6 | `npm run smoke` con `SMOKE_EXPECT_PRODUCTION=1` contra el despliegue real | ⚠️ Verificado localmente con build de producción falso; falta contra tu dominio real | §5 de este documento |
| R7 | Recorrido manual completo de usuario (registro real, evento, RSVP, pago live de importe bajo si aplica) | ❌ Pendiente de ti | `docs/SMOKE_TESTS.md` |
| R8 | Confirmar `SELECT count(*) FROM "Subscription";` en tu base real (0 esperado; la base de verificación de esta fase dio 0) | ❌ Pendiente de ti | `docs/OPERATIONS.md` §6 |

## 3. OPTIONAL

| # | Punto | Estado |
|---|---|---|
| O1 | CSP con nonce o SRI (quitar `'unsafe-inline'`) | Riesgo aceptado para el MVP; revisar más adelante |
| O2 | Réplica automática de R2 a otro proveedor | No implementado a propósito (versionado de objetos basta por ahora) |
| O3 | Reprocesar imágenes antiguas para quitar EXIF/GPS retroactivamente | Procedimiento de identificación documentado; sin plan de reprocesado masivo |
| O4 | Eliminar la tabla `Subscription` (legacy) | Depende de R8 |
| O5 | Guardias/paging para alertas | No hace falta para el lanzamiento (un canal de equipo basta) |

## 4. Checklist legal (para quien revise los textos, no para el equipo técnico)

`/privacy` y `/terms` (`app/(site)/(marketing)/{privacy,terms}/page.tsx`, contenido en `lib/content/legal.ts`) están marcados `DRAFT — requiere revisión legal antes de lanzamiento` y tienen puntos `[PENDIENTE]` explícitos. Antes de aprobarlos, un abogado debe confirmar al menos:

1. Base legal y plazos de conservación de datos de invitados (nombre, RSVP, mensajes) — hoy no hay borrado automático (`docs/OPERATIONS.md` §8).
2. Tratamiento de datos por terceros: Clerk (identidad), Stripe (pagos), Cloudflare R2 (imágenes), Resend (correo al anfitrión) — todos mencionados en el borrador, confirmar que la lista está completa y los roles (encargado/responsable) son correctos para tu jurisdicción.
3. Procedimiento de eliminación/anonimización de cuentas (`docs/OPERATIONS.md` §7) — hoy es manual y tiene un punto `[PENDIENTE de revisión legal: plazos y base legal de conservación]`.
4. Política fiscal: IVA/facturación en México (o donde se venda), quién la absorbe si el precio ya está fijado en $499/$799 MXN.
5. Términos de pago único: sin renovación, mejora Esencial → Premium por la diferencia, ventana de acceso de 30 días tras el evento — confirmar que el texto lo explica sin ambigüedad.
6. Jurisdicción y ley aplicable, resolución de disputas.

## 5. Producción: comandos de validación

```bash
prisma validate
npm run typecheck
npm run lint
npm test
npm run build      # con las variables de BUILD de producción (docs/DEPLOYMENT.md §3.2)
npm audit          # sin --force
SMOKE_BASE_URL=https://hiloluna.com SMOKE_EXPECT_PRODUCTION=1 npm run smoke
```

Nunca `prisma migrate reset` ni `npm audit fix --force`.

## 5.1 Dirección de cliente confiable según el alojamiento elegido (punto 27)

`docs/DEPLOYMENT.md` §8 mantiene la guía neutral a la plataforma; aquí el detalle si eliges una en concreto (no es una recomendación de plataforma, solo cómo verificar la cabecera en cada una):

- **Vercel**: fija `x-forwarded-for` en su borde antes de que la petición llegue a la función — un cliente externo no puede falsificarla. No hace falta configuración adicional.
- **Cloudflare delante de cualquier host**: usa `cf-connecting-ip` (ya en uso); asegúrate de que el origen solo acepte tráfico de Cloudflare.
- **Un VPS/contenedor con nginx u otro proxy propio**: confirma que ESE proxy sobrescribe (no solo añade) `x-forwarded-for` con la IP real, y que la aplicación no es alcanzable saltándose el proxy.

## 6. Tabla GO / NO-GO por área

| Área | Estado | Motivo |
|---|---|---|
| **Auth (Clerk)** | 🟡 NO-GO | Código y CSP listos; falta validar con una instancia de Clerk **real** (sign-up/sign-in/dashboard/admin con la consola del navegador abierta). |
| **Database** | 🟡 NO-GO | Migraciones y el simulacro de respaldo/restauración funcionan contra Postgres real de verificación; falta el proveedor gestionado de producción con copias automáticas (B6) y repetir la restauración ahí (B7). |
| **Storage (R2)** | 🟡 NO-GO | Código y CORS documentados; falta el bucket y las claves reales de producción (B8). |
| **Payments (Stripe)** | 🔴 NO-GO | Verificación del Price antes de cobrar, protección contra doble cobro y el webhook idempotente están implementados y probados; falta la cuenta **live**, los Prices reales y el webhook real (B3), y la decisión de impuestos (B2). |
| **Rate limit (Upstash)** | 🔴 NO-GO | Abstracción lista y `RATE_LIMIT_REQUIRED=true` implementado; falta el proveedor real de producción (B5). |
| **Email (Resend)** | 🟡 NO-GO | Servicio, idempotencia y saneamiento implementados y probados con `DevEmailProvider`; falta la cuenta y el dominio real de producción (R1). |
| **CSP** | 🟡 NO-GO | Estricta por defecto y verificada con un build de producción real (falsas cuentas); falta la validación con Clerk **real** (B4) antes de activar producción. |
| **Legal** | 🔴 NO-GO | `/privacy` y `/terms` siguen en borrador (B1); impuestos sin decidir (B2). |
| **Taxes** | 🔴 NO-GO | Sin decisión (B2). |
| **Backups** | 🟡 NO-GO | Procedimiento documentado y **probado de verdad** contra Postgres real de esta fase (pg_dump → pg_restore → migrate status → conteos idénticos); falta activarlo en el proveedor gestionado real (B6) y repetir el simulacro ahí (B7). |
| **Monitoring** | 🟡 NO-GO (opcional) | Integración lista (Sentry opcional) y saneada; falta configurar el proyecto real y probar un error controlado (R4), y conectar un monitor externo de salud (R3). |
| **Admin** | 🟡 NO-GO | Consola, auditoría y protección de rol probadas; falta asignar el primer administrador en la base de producción (R2). |

**Veredicto global: NO-GO.** Ningún BLOCKER está resuelto todavía (todos dependen de cuentas y decisiones que solo el propietario puede tomar: proveedor de alojamiento, cuentas live de Stripe/R2/Upstash/Resend, aprobación legal e impuestos). El código, las pruebas automatizadas (1104 pruebas) y las verificaciones que sí se podían hacer sin esas cuentas —CSP estricta, cabeceras, robots/sitemap de producción, simulacro de respaldo/restauración, saneamiento de registros y de Sentry, prueba de carga ligera— están hechas y documentadas arriba. Actualiza esta tabla a medida que resuelvas cada BLOCKER.
