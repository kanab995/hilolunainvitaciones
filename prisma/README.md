# prisma/

Base de datos de Hilo Luna: PostgreSQL + Prisma 6 (`docs/DATABASE_SCHEMA.md`, `docs/ARCHITECTURE.md` D-22).

| Archivo | Qué es |
|---|---|
| `schema.prisma` | Esquema (fuente de verdad de las tablas) |
| `migrations/` | Migraciones versionadas (`init_lunaria` es la inicial: conserva el nombre anterior de la marca porque una migración aplicada no se renombra) |
| `seed.ts` | Seed reproducible: 12 plantillas + evento demo Andrea & Fernando |
| `register-alias.mjs`, `alias-hooks.mjs` | Permiten ejecutar el seed con Node (alias `@/…`) sin dependencias extra |

## Puesta en marcha

1. Crea una base de datos PostgreSQL vacía y copia `.env.example` a `.env` con tu `DATABASE_URL`.
2. `npm run db:migrate` — aplica las migraciones (y genera el cliente).
3. `npm run db:seed` — carga las plantillas y el evento demo (idempotente).
4. `npm run dev` — `/dashboard/events/demo` redirige al evento sembrado.

Otros scripts: `db:generate`, `db:validate`, `db:deploy` (producción), `db:studio`.
Sin `DATABASE_URL` la aplicación usa los datos de demostración en memoria (solo lectura).

## Cuentas (Clerk) y el usuario demo

El seed crea `demo@hiloluna.local` **sin** `clerkUserId`: sirve para desarrollo (modo demostración sin claves de Clerk) y nunca se vincula a una persona real. Una persona que se registra recibe un usuario NUEVO, sin eventos. Para ver el evento demo con tu cuenta real en desarrollo, hazlo de forma explícita: en `npm run db:studio`, pon el `clerkUserId` de tu cuenta en el usuario demo (o cambia el `ownerId` del evento demo a tu usuario). No se hace automáticamente.

## Codificación UTF8

La base de datos debe estar en **UTF8**: los mensajes del RSVP pueden llevar emojis, que `WIN1252` (el valor por defecto de algunas instalaciones de PostgreSQL en Windows) no admite. Para comprobarlo: `SELECT datname, pg_encoding_to_char(encoding) FROM pg_database;`. Si es `WIN1252`, créala de nuevo con `CREATE DATABASE hiloluna ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C';` (o con la configuración regional UTF8 que prefieras) antes de `npm run db:migrate`.

## Probar el flujo completo con tu cuenta (sin flujo de creación todavía)

Como aún no se pueden crear eventos desde la aplicación, asigna el evento demo a tu cuenta de forma explícita: inicia sesión una vez con Clerk (así se crea tu `User`) y ejecuta, con el correo de esa cuenta:

- PowerShell: `$env:SEED_DEMO_OWNER_EMAIL="tu@correo.com"; npm run db:seed`
- Git Bash: `SEED_DEMO_OWNER_EMAIL=tu@correo.com npm run db:seed`

El seed conserva los tokens de invitación existentes (los enlaces personalizados siguen siendo los mismos). Repetir el seed SIN la variable devuelve el evento al usuario demo.
