#!/usr/bin/env node
/**
 * SMOKE TEST de un despliegue (staging o producción). Comprueba SOLO lo que se puede verificar sin iniciar sesión y sin pagar: páginas públicas,
 * salud, robots/sitemap, cabeceras de seguridad, protección de rutas privadas e invitación pública (si se indica una). NO ejecuta pagos y NO crea
 * datos. El recorrido con sesión (crear evento, editor, publicar, RSVP, QR, pago de prueba, consola) es MANUAL: ver docs/SMOKE_TESTS.md.
 *
 *   SMOKE_BASE_URL=https://staging.ejemplo.com node scripts/smoke.mjs
 *   SMOKE_BASE_URL=... SMOKE_INVITE_SLUG=<slug publicado> [SMOKE_GUEST_TOKEN=<token>] node scripts/smoke.mjs
 *   SMOKE_EXPECT_STAGING=1 (o una URL con «staging») → además exige noindex global y robots.txt que bloquea todo.
 *   SMOKE_EXPECT_PRODUCTION=1 → además exige https, CSP APLICÁNDOSE (nunca Report-Only), HSTS, marketing indexable
 *     (robots.txt NO bloquea todo, sitemap con entradas, home sin noindex) y /templates y /pricing accesibles. Sin inicio de
 *     sesión automatizado (D-37, punto 29): el recorrido con sesión sigue siendo manual (docs/SMOKE_TESTS.md).
 * `SMOKE_BASE_URL` es obligatorio (no hay valor por defecto: el script nunca apunta solo a localhost ni a producción).
 *
 * Sale con código 1 si algo falla. No imprime secretos ni el token completo.
 */
const base = (process.env.SMOKE_BASE_URL ?? "").replace(/\/+$/, "");
if (!base) {
  console.error("Define SMOKE_BASE_URL (p. ej. https://staging.ejemplo.com).");
  process.exit(2);
}
const slug = process.env.SMOKE_INVITE_SLUG;
const token = process.env.SMOKE_GUEST_TOKEN;

let failures = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function get(path, options = {}) {
  const response = await fetch(`${base}${path}`, { redirect: "manual", ...options });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

const header = (response, name) => response.headers.get(name) ?? "";

// Formas de credenciales/ids que jamás deben aparecer en HTML público (claves de Stripe, secreto de webhook, ids de pago/sesión, ids de usuario de Clerk, claves S3).
const LEAK_PATTERN = new RegExp(
  [...["sk", "rk"].map((prefix) => `${prefix}_(test|live)_`), "whsec" + "_", "pi_[A-Za-z0-9]{8,}", "cs_(test|live)_", "user_[A-Za-z0-9]{20,}", "S3_SECRET", "AKIA[0-9A-Z]{12}"].join("|"),
);

console.log(`Smoke test contra ${base}\n`);

// ───────── Páginas públicas ─────────
for (const path of ["/", "/templates", "/pricing", "/privacy", "/terms", "/sign-in"]) {
  const response = await get(path);
  // `/pricing` pasa por `clerkMiddleware` (sus CTA dependen de la sesión): con una instancia de Clerk de PRUEBA la primera visita sin cookies puede
  // devolver el «handshake» de Clerk (redirección a su Frontend API). Es un comportamiento normal de Clerk, no un fallo de la página.
  const clerkHandshake = path === "/pricing" && response.status >= 300 && response.status < 400 && /clerk|handshake/i.test(header(response, "location"));
  check(`GET ${path} responde 200`, response.status === 200 || clerkHandshake, `estado ${response.status}${clerkHandshake ? " (handshake de Clerk)" : ""}`);
}
const privacy = await get("/privacy");
if (/DRAFT/.test(privacy.text)) console.log("  ⚠ /privacy sigue marcada como DRAFT: reemplázala por el texto legal aprobado antes del lanzamiento.");

// ───────── Salud ─────────
const health = await get("/api/health");
check("/api/health → { status: ok }", health.status === 200 && /"status":"ok"/.test(health.text));
const ready = await get("/api/health/ready");
check("/api/health/ready → ready (configuración completa y base de datos responde)", ready.status === 200 && /"status":"ready"/.test(ready.text), `estado ${ready.status}`);
check("la salud no expone datos internos", !/postgres(ql)?:|DATABASE_URL|sk_|whsec|localhost|S3_|CLERK|STRIPE/i.test(health.text + ready.text));

// ───────── robots y sitemap ─────────
const robots = await get("/robots.txt");
const stagingMode = process.env.SMOKE_EXPECT_STAGING === "1" || /staging/i.test(base);
check(stagingMode ? "robots.txt bloquea todo el sitio (staging)" : "robots.txt bloquea /i/, /dashboard, /admin, /preview y /api/", stagingMode ? /Disallow:\s*\/\s*$/m.test(robots.text) : ["/i/", "/dashboard", "/admin", "/preview", "/api/"].every((path) => robots.text.includes(`Disallow: ${path}`)));
const sitemap = await get("/sitemap.xml");
check("sitemap.xml existe y NO lista invitaciones ni rutas privadas", sitemap.status === 200 && !/\/i\/|\/dashboard|\/admin|\/preview|guest=/.test(sitemap.text));

// ───────── Cabeceras de seguridad ─────────
const home = await get("/");
check("CSP presente (Content-Security-Policy o Report-Only)", Boolean(header(home, "content-security-policy") || header(home, "content-security-policy-report-only")));
check("X-Content-Type-Options: nosniff", header(home, "x-content-type-options") === "nosniff");
check("X-Frame-Options presente", Boolean(header(home, "x-frame-options")));
check("Referrer-Policy presente", Boolean(header(home, "referrer-policy")));
check("no se anuncia X-Powered-By", header(home, "x-powered-by") === "");
if (base.startsWith("https://")) check("HSTS presente en HTTPS", Boolean(header(home, "strict-transport-security")));

// ───────── Staging: TODO noindex ─────────
// `SMOKE_EXPECT_STAGING=1` (o una URL con «staging») exige que el sitio entero sea noindex y que robots.txt lo bloquee (APP_ENV=staging, docs/STAGING.md).
if (stagingMode) {
  check("STAGING: la home responde X-Robots-Tag noindex", /noindex/i.test(header(home, "x-robots-tag")));
  check("STAGING: robots.txt bloquea todo el sitio (Disallow: /)", /Disallow:\s*\/\s*$/m.test(robots.text) && !/Allow:/.test(robots.text));
  check("STAGING: sitemap vacío", !/<loc>/.test(sitemap.text));
}

// ───────── Producción: https, CSP estricta, indexación correcta ─────────
const productionMode = process.env.SMOKE_EXPECT_PRODUCTION === "1";
if (productionMode) {
  check("PRODUCCIÓN: la URL base es https", base.startsWith("https://"));
  check("PRODUCCIÓN: CSP se está APLICANDO (nunca Report-Only)", Boolean(header(home, "content-security-policy")) && !header(home, "content-security-policy-report-only"));
  check("PRODUCCIÓN: HSTS presente", Boolean(header(home, "strict-transport-security")));
  check("PRODUCCIÓN: la home es indexable (sin X-Robots-Tag noindex)", !/noindex/i.test(header(home, "x-robots-tag")));
  check("PRODUCCIÓN: robots.txt NO bloquea el sitio entero (el marketing debe indexarse)", !/Disallow:\s*\/\s*$/m.test(robots.text));
  for (const path of ["/i/", "/dashboard", "/admin", "/preview", "/api/"]) check(`PRODUCCIÓN: robots.txt sigue bloqueando ${path}`, robots.text.includes(`Disallow: ${path}`));
  check("PRODUCCIÓN: sitemap.xml lista páginas de marketing (no vacío)", /<loc>/.test(sitemap.text));
  const templatesPage = await get("/templates");
  check("PRODUCCIÓN: /templates responde 200 y es indexable", templatesPage.status === 200 && !/noindex/i.test(header(templatesPage, "x-robots-tag")));
  const pricingPage = await get("/pricing");
  check("PRODUCCIÓN: /pricing responde 200", pricingPage.status === 200);
  check("PRODUCCIÓN: el HTML público no expone secretos ni ids del proveedor", !LEAK_PATTERN.test(home.text + templatesPage.text + pricingPage.text));
}

// ───────── Rutas privadas ─────────
for (const path of ["/dashboard/events", "/admin", "/preview/x"]) {
  const response = await get(path);
  const location = header(response, "location");
  check(`GET ${path} sin sesión NO devuelve contenido (redirige al acceso o 404)`, (response.status >= 300 && response.status < 400 && /sign-in/.test(location)) || response.status === 404, `estado ${response.status}`);
}
const webhook = await get("/api/webhooks/stripe", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
check("el webhook de Stripe rechaza una petición SIN firma (400/503), nunca la procesa", webhook.status === 400 || webhook.status === 503, `estado ${webhook.status}`);

// ───────── Invitación pública ─────────
const missing = await get("/i/esta-invitacion-no-existe-zzz");
check("una invitación inexistente responde 404", missing.status === 404, `estado ${missing.status}`);
if (slug) {
  const invitation = await get(`/i/${slug}`);
  check(`/i/${slug} responde 200 (o muestra «ya no está disponible» si expiró)`, invitation.status === 200, `estado ${invitation.status}`);
  check("la invitación es noindex y sin Referer", /noindex/i.test(header(invitation, "x-robots-tag")) && header(invitation, "referrer-policy") === "no-referrer");
  check("la invitación no se guarda en cachés compartidas", /no-store/.test(header(invitation, "cache-control")));
  // Auditoría de la respuesta pública: no debe filtrar secretos, ids de Clerk, tokens de invitados ni datos de Stripe.
  check("el HTML público no contiene secretos, ids de Clerk ni datos de Stripe", !LEAK_PATTERN.test(invitation.text));
  check("el HTML público no incluye `inviteToken` ni correos/teléfonos de invitados", !/inviteToken|"email"\s*:|"phone"\s*:/i.test(invitation.text));
  const calendar = await get(`/i/${slug}/calendar.ics`);
  check("calendar.ics: 200 text/calendar (o 404 si expiró)", (calendar.status === 200 && /text\/calendar/.test(header(calendar, "content-type"))) || calendar.status === 404, `estado ${calendar.status}`);
  if (token) {
    const personal = await get(`/i/${slug}?guest=${encodeURIComponent(token)}`);
    check(`enlace personalizado (…${token.slice(-4)}) responde 200 y no se cachea`, personal.status === 200 && /no-store/.test(header(personal, "cache-control")));
  }
} else {
  console.log("\n(Sin SMOKE_INVITE_SLUG: se omiten las comprobaciones de invitación pública.)");
}

console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas.`);
console.log("\nRecorrido MANUAL con sesión (docs/SMOKE_TESTS.md): registro → crear evento → editor → subir imagen → publicar → invitado → RSVP → QR → .ics → pago de prueba → consola.");
process.exit(failures === 0 ? 0 : 1);
