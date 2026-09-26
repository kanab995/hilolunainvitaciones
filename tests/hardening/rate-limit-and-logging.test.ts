import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createRateLimiter, hashIdentity, isRateLimited, NoopRateLimiter, RATE_LIMIT_RULES, RestRateLimiter, type RateLimiter } from "@/server/security/rate-limit";
import { pickClientAddress } from "@/server/security/client-identity";
import { describeError, logger, redact, redactString, setLogSink, REDACTED } from "@/server/observability/logger";
import { generateInviteToken, INVITE_TOKEN_PATTERN } from "@/server/services/invite-token";
import { validatePublicRsvp, readPublicRsvpFormData, RSVP_FORM_LIMITS, RSVP_LIMITS, submitPublicRsvpFor, type PublicRsvpDeps, type RsvpTarget } from "@/server/services/public-rsvp";
import { createImageUpload } from "@/server/services/media-service";
import { makeWorld } from "../helpers/media-world";

const ROOT = process.cwd();
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"; // 32 caracteres, como los de invitación

/** Todos los .ts/.tsx bajo las carpetas dadas, sin comentarios de línea/bloque. */
function sources(dirs: string[]): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (path: string) => {
    if (statSync(path).isDirectory()) for (const entry of readdirSync(path)) walk(join(path, entry));
    else if (/\.(ts|tsx)$/.test(path)) found.set(relative(ROOT, path).split(sep).join("/"), readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
  };
  for (const dir of dirs) walk(join(ROOT, dir));
  return found;
}

describe("(8/9) abstracción de límite de tasa", () => {
  it("sin proveedor → Noop (desarrollo); con URL y token → REST; nunca un Map en memoria", () => {
    expect(createRateLimiter({}).kind).toBe("noop");
    expect(createRateLimiter({ RATE_LIMIT_REST_URL: "https://x.example" }).kind).toBe("noop");
    expect(createRateLimiter({ RATE_LIMIT_REST_URL: "https://x.example", RATE_LIMIT_REST_TOKEN: "t" }).kind).toBe("rest");
    const code = readFileSync(join(ROOT, "server/security/rate-limit.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/new Map\(|new Set\(|globalThis/);
  });

  it("Noop deja pasar todo", async () => {
    expect(await new NoopRateLimiter().check(RATE_LIMIT_RULES.rsvpByClient, "x")).toMatchObject({ allowed: true });
  });

  const providerResponse = (count: number, ttl = 300) => new Response(JSON.stringify([{ result: count }, { result: 1 }, { result: ttl }]), { status: 200 });

  it("REST: INCR + EXPIRE NX en un pipeline autenticado; permite hasta el límite y bloquea por encima con retryAfter", async () => {
    const fetchMock = vi.fn(async () => providerResponse(3));
    const limiter = new RestRateLimiter({ url: "https://limits.example.com/", token: "TOKEN_SECRETO", fetch: fetchMock as unknown as typeof fetch });
    const rule = { name: "prueba", limit: 5, windowSeconds: 60 };
    expect(await limiter.check(rule, "cliente-1")).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    fetchMock.mockResolvedValueOnce(providerResponse(6, 42));
    expect(await limiter.check(rule, "cliente-1")).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 42 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://limits.example.com/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN_SECRETO");
    const commands = JSON.parse(init.body as string) as string[][];
    expect(commands.map((command) => command[0])).toEqual(["INCR", "EXPIRE", "TTL"]);
    expect(commands[1]).toContain("NX");
  });

  it("la clave del contador NUNCA lleva la identidad en claro (IP, id de usuario o token): solo su hash", async () => {
    const fetchMock = vi.fn(async () => providerResponse(1));
    const limiter = new RestRateLimiter({ url: "https://limits.example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });
    await limiter.check(RATE_LIMIT_RULES.rsvpByGuest, TOKEN);
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
    expect(body).not.toContain(TOKEN);
    expect(body).toContain(hashIdentity(TOKEN));
    expect(hashIdentity(TOKEN)).toHaveLength(24);
  });

  it("FAIL-OPEN: si el proveedor falla o tarda, el intento se permite (y se registra un aviso sin la identidad)", async () => {
    const lines: string[] = [];
    const restore = setLogSink({ info: () => undefined, warn: (line) => lines.push(line), error: (line) => lines.push(line) });
    vi.stubEnv("LOG_LEVEL", "info");
    const failing = new RestRateLimiter({ url: "https://limits.example.com", token: "t", fetch: (async () => { throw new Error("red caída: 203.0.113.9"); }) as unknown as typeof fetch });
    expect(await failing.check(RATE_LIMIT_RULES.guestLookup, "203.0.113.9")).toMatchObject({ allowed: true });
    const http500 = new RestRateLimiter({ url: "https://limits.example.com", token: "t", fetch: (async () => new Response("", { status: 500 })) as unknown as typeof fetch });
    expect(await http500.check(RATE_LIMIT_RULES.guestLookup, "x")).toMatchObject({ allowed: true });
    restore();
    vi.unstubAllEnvs();
    expect(lines.join("")).toContain("rate_limit.provider_error");
    expect(lines.join("")).not.toContain("203.0.113.9");
  });

  it("isRateLimited comprueba todas las identidades y se detiene en la primera excedida", async () => {
    const check = vi.fn(async (_rule: unknown, identity: string) => ({ allowed: identity !== "malo", remaining: 0, retryAfterSeconds: 1 }));
    const limiter: RateLimiter = { kind: "rest", check };
    expect(await isRateLimited([{ rule: RATE_LIMIT_RULES.rsvpByClient, identity: "ok" }, { rule: RATE_LIMIT_RULES.rsvpByGuest, identity: "ok2" }], limiter)).toBe(false);
    check.mockClear();
    expect(await isRateLimited([{ rule: RATE_LIMIT_RULES.rsvpByClient, identity: "malo" }, { rule: RATE_LIMIT_RULES.rsvpByGuest, identity: "ok" }], limiter)).toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("la dirección del cliente sale de las cabeceras del proxy (Cloudflare, X-Forwarded-For, X-Real-IP) y, sin ninguna, todos comparten cubo", () => {
    const get = (values: Record<string, string>) => (name: string) => values[name] ?? null;
    expect(pickClientAddress(get({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(pickClientAddress(get({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }))).toBe("2.2.2.2");
    expect(pickClientAddress(get({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(pickClientAddress(get({}))).toBe("unknown");
  });
});

describe("(8) el límite se aplica donde corresponde y NO en el webhook", () => {
  it("(RSVP) un intento bloqueado responde rate_limited ANTES de tocar la base de datos", async () => {
    const resolveTarget = vi.fn();
    const deps: PublicRsvpDeps = { resolveTarget, save: vi.fn(), now: () => Date.now(), isUnavailable: () => false, isRateLimited: async () => true };
    const result = await submitPublicRsvpFor({ slug: "boda", token: TOKEN, raw: { status: "ATTENDING", attendeeCount: 1, message: "", answers: {} } }, deps);
    expect(result).toMatchObject({ ok: false, code: "rate_limited", message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
    expect(resolveTarget).not.toHaveBeenCalled();
  });

  it("(subidas) la emisión de URLs firmadas se limita por usuario y no crea registro ni URL al excederse", async () => {
    const world = makeWorld();
    const isRateLimitedFn = vi.fn(async (userId: string) => userId === "usr_A");
    const outcome = await createImageUpload("evt_A", { filename: "a.jpg", mimeType: "image/jpeg", sizeBytes: 1000 }, { ...world.deps, isRateLimited: isRateLimitedFn });
    expect(outcome.result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(world.repo.assets.size).toBe(0);
    expect(world.storage.targets).toHaveLength(0);
    expect(isRateLimitedFn).toHaveBeenCalledWith("usr_A");
  });

  it("(consulta por token) la página lo limita por cliente antes de buscar al invitado; el webhook de Stripe NO usa este limitador", () => {
    const all = sources(["app", "server", "lib", "components"]);
    expect(all.get("app/(invitation)/i/[slug]/page.tsx")).toMatch(/RATE_LIMIT_RULES\.guestLookup/);
    for (const [file, code] of all) {
      if (/webhook|billing\//i.test(file)) expect(code, file).not.toMatch(/rate-limit|isRateLimited|RATE_LIMIT_RULES/);
    }
    expect(RATE_LIMIT_RULES.uploadAuthorize.limit).toBeGreaterThan(0);
  });

  it("los envíos de RSVP se limitan por cliente y por invitado (token solo como hash)", () => {
    const code = sources(["server/services"]).get("server/services/public-rsvp-runtime.ts") ?? "";
    expect(code).toMatch(/rsvpByClient/);
    expect(code).toMatch(/rsvpByGuest/);
  });
});

describe("(10) RSVP: payload acotado y sin campos arbitrarios", () => {
  const target: RsvpTarget = { eventId: "e", guestId: "g", maxCompanions: 1, rsvp: { enabled: true, allowMaybe: false, maxCompanions: 1 } as never, questions: [] };

  it("se leen solo slug, guest, status, attendeeCount, message y answer:<id>; cualquier otro campo se ignora", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ slug: "boda", guest: TOKEN, status: "ATTENDING", attendeeCount: "2", message: "hola", "answer:q1": "sí", role: "ADMIN", ownerId: "usr_X", "__proto__": "x" })) form.set(key, value);
    const read = readPublicRsvpFormData(form);
    expect(Object.keys(read.raw).sort()).toEqual(["answers", "attendeeCount", "message", "status"]);
    expect(read.raw.answers).toEqual({ q1: "sí" });
    expect(JSON.stringify(read)).not.toMatch(/ADMIN|usr_X/);
  });

  it("valores enormes se recortan al leer y el mensaje excedido se rechaza en la validación", () => {
    const form = new FormData();
    form.set("status", "ATTENDING");
    form.set("message", "x".repeat(50_000));
    const read = readPublicRsvpFormData(form);
    expect(String(read.raw.message).length).toBe(RSVP_FORM_LIMITS.maxValueLength);
    const validation = validatePublicRsvp(target, read.raw, Date.now());
    expect(validation).toMatchObject({ ok: false, fieldErrors: { message: expect.stringContaining(String(RSVP_LIMITS.message)) } });
  });

  it("un formulario con miles de campos se corta y demasiadas respuestas se rechazan", () => {
    const form = new FormData();
    form.set("status", "ATTENDING");
    for (let index = 0; index < 5000; index += 1) form.set(`answer:q${index}`, "x");
    const read = readPublicRsvpFormData(form);
    expect(Object.keys(read.raw.answers as object).length).toBeLessThanOrEqual(RSVP_FORM_LIMITS.maxEntries);
    expect(validatePublicRsvp(target, { ...read.raw, answers: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`q${i}`, "x"])) }, Date.now())).toMatchObject({ ok: false });
  });
});

describe("(20) registro con redacción", () => {
  it("por NOMBRE de campo: tokens, secretos, correos, teléfonos, mensajes y respuestas nunca se registran", () => {
    const redacted = redact({ inviteToken: TOKEN, guestEmail: "ana@example.com", phone: "5512345678", message: "hola", answers: { q: "x" }, secretKey: "abc", Authorization: "Bearer xyz", rawBody: "{}", ok: "visible", nested: { password: "p", count: 3 } }) as Record<string, unknown>;
    for (const key of ["inviteToken", "guestEmail", "phone", "message", "answers", "secretKey", "Authorization", "rawBody"]) expect(redacted[key], key).toBe(REDACTED);
    expect(redacted.ok).toBe("visible");
    expect(redacted.nested).toEqual({ password: REDACTED, count: 3 });
  });

  it("por FORMA del valor: claves de Stripe/Clerk, whsec, URLs con credenciales, correos y tokens de 32+ caracteres aunque el campo sea inocente", () => {
    const text = redactString(`clave sk_live_ABCDEFGHIJKLMN y sk_test_ZZZZZZZZZZ, whsec_QWERTYUIOP12, postgresql://usuario:CLAVE@host/db, ana@example.com, ?guest=${TOKEN}, token ${TOKEN}`);
    for (const secret of ["sk_live_ABCDEFGHIJKLMN", "sk_test_ZZZZZZZZZZ", "whsec_QWERTYUIOP12", "CLAVE@host", "ana@example.com", TOKEN]) expect(text).not.toContain(secret);
  });

  it("los errores se reducen a nombre/código/tipo: el mensaje (que puede traer claves o consultas) nunca sale", () => {
    const error = Object.assign(new Error("connection string postgresql://u:SECRETA@h/db falló para sk_live_ABCDEFGHIJKLMN"), { code: "P1001", type: "StripeAPIError" });
    expect(describeError(error)).toEqual({ name: "Error", code: "P1001", type: "StripeAPIError" });
    expect(JSON.stringify(describeError(error))).not.toContain("SECRETA");
  });

  it("el registro escribe JSON de una línea por evento, respeta LOG_LEVEL y redacta los campos", () => {
    const lines: Array<[string, string]> = [];
    const restore = setLogSink({ info: (line) => lines.push(["info", line]), warn: (line) => lines.push(["warn", line]), error: (line) => lines.push(["error", line]) });
    vi.stubEnv("LOG_LEVEL", "warn");
    logger.info("no.sale");
    logger.warn("cosa.rara", { token: TOKEN, session: "cs_••••1234", n: 2 });
    logger.error("cosa.grave", Object.assign(new Error("secreto sk_live_ABCDEFGHIJKLMN"), { code: "X1" }));
    restore();
    vi.unstubAllEnvs();
    expect(lines.map(([level]) => level)).toEqual(["warn", "error"]);
    const [warn, error] = lines.map(([, line]) => JSON.parse(line) as Record<string, unknown>);
    expect(warn).toMatchObject({ level: "warn", event: "cosa.rara", token: REDACTED, session: "cs_••••1234", n: 2 });
    expect(error).toMatchObject({ level: "error", event: "cosa.grave", error: { name: "Error", code: "X1" } });
    expect(lines.map(([, line]) => line).join("")).not.toMatch(/sk_live|ABCDEFGHIJKLMN|AbCdEfGhIj/);
  });

  it("(21) el servidor no escribe en la consola fuera del registro: sin console.* directo en server/, app/, lib/ ni components/", () => {
    for (const [file, code] of sources(["server", "app", "lib", "components"])) {
      if (file === "server/observability/logger.ts") continue;
      expect(code, file).not.toMatch(/console\.(log|info|warn|error|debug)\(/);
    }
  });
});

describe("(7) token de invitado", () => {
  it("192 bits de entropía (24 bytes aleatorios) en base64url de 32 caracteres, distinto en cada llamada y sin relación con el id", () => {
    const tokens = new Set(Array.from({ length: 5000 }, () => generateInviteToken()));
    expect(tokens.size).toBe(5000);
    for (const token of [...tokens].slice(0, 200)) {
      expect(token).toHaveLength(32);
      expect(token).toMatch(INVITE_TOKEN_PATTERN);
      expect(token).not.toMatch(/^guest_|cuid|c[a-z0-9]{24}/);
    }
    expect(readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")).toMatch(/inviteToken\s+String\s+@unique/);
  });

  it("ningún código registra el token: la página, el RSVP y el repositorio público no lo pasan a console ni al registro", () => {
    for (const file of ["app/(invitation)/i/[slug]/page.tsx", "server/services/public-rsvp.ts", "server/repositories/public-invitations.ts", "server/services/public-rsvp-runtime.ts"]) {
      const code = sources([file.split("/").slice(0, -1).join("/")]).get(file) ?? "";
      for (const line of code.split("\n").filter((entry) => /logger\.|console\./.test(entry))) expect(line, file).not.toMatch(/token|guest=|inviteToken/i);
    }
  });

  it("la consola de administración no lo carga ni lo muestra (ni completo ni parcial)", () => {
    for (const [file, code] of sources(["server/admin", "app/(site)/admin", "components/admin"])) expect(code, file).not.toMatch(/inviteToken/);
  });
});
