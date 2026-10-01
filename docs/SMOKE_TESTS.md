# Pruebas de humo (staging / producción)

> Verifican, tras un despliegue, que el producto funciona de extremo a extremo. **No ejecutan pagos reales**: el pago se prueba SIEMPRE con claves
> y tarjetas de **modo de prueba** de Stripe en staging. Ver `docs/DEPLOYMENT.md` §12.

## A. Automáticas (sin sesión): `npm run smoke`

```bash
SMOKE_BASE_URL=https://staging.ejemplo.com npm run smoke
```

Con una invitación publicada de prueba (opcional):

```bash
SMOKE_BASE_URL=https://staging.ejemplo.com SMOKE_INVITE_SLUG=andrea-y-fernando SMOKE_GUEST_TOKEN=<token> npm run smoke
```

Contra **staging** (todo noindex, D-35):

```bash
SMOKE_BASE_URL=https://staging.hiloluna.com SMOKE_EXPECT_STAGING=1 npm run smoke
```

Contra **producción** (marketing indexable, CSP aplicándose, HSTS, https — D-37):

```bash
SMOKE_BASE_URL=https://hiloluna.com SMOKE_EXPECT_PRODUCTION=1 npm run smoke
```

Comprueba: páginas públicas (`/`, `/templates`, `/pricing`, `/privacy`, `/terms`, `/sign-in`), `/api/health` y `/api/health/ready`, `robots.txt` y
`sitemap.xml` (sin invitaciones), cabeceras de seguridad (CSP, nosniff, X-Frame-Options, Referrer-Policy, HSTS en https), que `/dashboard`, `/admin` y `/preview`
no devuelven contenido sin sesión, que el webhook rechaza peticiones sin firma, y, si se indica una invitación, que es noindex, sin `Referer`, sin caché
compartida y que su `.ics` responde. En modo producción exige además https, CSP APLICÁNDOSE (nunca Report-Only), HSTS, que la home y `/templates` sean
indexables y que `robots.txt` NO bloquee el sitio entero. Sale con código 1 si algo falla. No imprime secretos ni el token completo. Sin inicio de
sesión automatizado en ningún modo (D-37, punto 29): el recorrido con sesión sigue siendo el de la sección B, manual.

## B. Manuales con sesión (checklist)

Usa una cuenta de prueba y **tarjetas de prueba de Stripe** (`4242 4242 4242 4242`). Marca cada paso.

**Acceso y home**
- [ ] Home carga, sin errores en la consola del navegador (revisa violaciones de CSP).
- [ ] Registro (`/sign-up`) con correo nuevo → verificación → entra a `/dashboard/events`.
- [ ] Cerrar sesión y volver a entrar; una ruta privada sin sesión redirige a `/sign-in`.

**Crear y editar**
- [ ] Plantillas (`/templates`) → «Usar esta plantilla» → crear evento (nace Gratis, borrador).
- [ ] Editor: cambiar nombres, fecha, historia; el autoguardado dice «Guardado».
- [ ] Subir una **foto con GPS** (de un móvil): se ve bien orientada; al descargarla desde su URL pública **no** contiene EXIF/GPS.
- [ ] Publicar → «Publicado»; el enlace `/i/<slug>` abre sin cuenta.

**Invitados y RSVP**
- [ ] Añadir un invitado → copiar su enlace personalizado.
- [ ] Abrir el enlace en una ventana privada → saludo personalizado → responder RSVP → el panel lo refleja.
- [ ] Responder muchas veces seguidas con el limitador conectado → aparece «Demasiados intentos…».
- [ ] QR del evento y del invitado se generan y descargan; «Agregar al calendario» descarga un `.ics` válido.

**Pago (modo de prueba)**
- [ ] «Mejorar evento» → Esencial → pagar con `4242…` → vuelve con «Estamos confirmando tu pago…» → tras el webhook, «Plan Esencial · Disponible hasta …».
- [ ] Doble clic en «Pagar»: una sola sesión en Stripe.
- [ ] Mejora a Premium (solo la diferencia, 300 MXN) → «Compras y planes» muestra las dos compras.
- [ ] Pago fallido (`4000 0000 0000 0002`): el evento conserva su plan.
- [ ] Stripe → Webhooks: los eventos aparecen entregados (200).

**Consola de administración**
- [ ] Un usuario normal abre `/admin` → 404. El administrador entra.
- [ ] Resumen con cifras; «Analizar huérfanos» responde.
- [ ] Plantillas: ocultar una → desaparece de `/templates` y las invitaciones ya publicadas siguen abiertas → aparece una entrada en **Auditoría**.

**Expiración**
- [ ] Con un evento de pago de prueba y `paidAccessEndsAt` en el pasado (ajústalo en la base de **staging**): `/i/<slug>` → «Esta invitación ya no está disponible.», el RSVP no se acepta y `/i/<slug>/calendar.ics` responde 404. Mover la fecha del evento hacia adelante lo reactiva.

**Cabeceras y salud**
- [ ] `/api/health/ready` → `ready`.
- [ ] `curl -sI https://<dominio>/i/<slug>` muestra `x-robots-tag: noindex`, `referrer-policy: no-referrer` y `cache-control: private, no-store`.
