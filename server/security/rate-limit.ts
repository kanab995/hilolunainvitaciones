import { createHash } from "node:crypto";
import { logger } from "@/server/observability/logger";

/**
 * LÍMITE DE TASA (preproducción). Abstracción `RateLimiter` con dos implementaciones:
 *  - `RestRateLimiter`: contadores de ventana fija en un Redis con API REST compatible con Upstash (`INCR` + `EXPIRE NX` en un solo
 *    `pipeline`). Compartido entre instancias: es la única opción válida en producción con varias instancias.
 *  - `NoopRateLimiter`: deja pasar todo. Solo para desarrollo/pruebas. NO existe un limitador en memoria a propósito: un `Map` por proceso
 *    no protege nada con varias instancias (o serverless) y daría una falsa sensación de seguridad.
 * El proveedor se elige con `RATE_LIMIT_REST_URL` + `RATE_LIMIT_REST_TOKEN` (docs/DEPLOYMENT.md). En producción sin proveedor el arranque
 * advierte claramente (`server/config/env.ts`) y `RATE_LIMIT_REQUIRED=true` lo convierte en error.
 * Política ante un fallo del proveedor: FAIL-OPEN (se permite y se registra un aviso): una caída del proveedor no debe impedir que un
 * invitado confirme su asistencia. El webhook de Stripe NO usa este limitador (nunca se limita a Stripe).
 * Las claves nunca contienen datos en claro: la identidad (IP, id de usuario, token) se reduce con SHA-256.
 */
export interface RateLimitRule {
  /** Nombre estable de la regla (parte de la clave). */
  name: string;
  /** Máximo de intentos por ventana. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  readonly kind: "rest" | "noop";
  check(rule: RateLimitRule, identity: string): Promise<RateLimitDecision>;
}

/** Reglas de los endpoints públicos sensibles. */
export const RATE_LIMIT_RULES = {
  /** Envío de RSVP: por dirección de cliente y, además, por invitado (token). */
  rsvpByClient: { name: "rsvp-client", limit: 20, windowSeconds: 600 },
  rsvpByGuest: { name: "rsvp-guest", limit: 10, windowSeconds: 600 },
  /** Consulta de la invitación con `?guest=<token>` (adivinar tokens): por dirección de cliente. */
  guestLookup: { name: "guest-lookup", limit: 60, windowSeconds: 60 },
  /** Emisión de URL de subida de imágenes: por usuario. */
  uploadAuthorize: { name: "upload-authorize", limit: 30, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitRule>;

export const rateLimitMessage = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

/** Identidad reducida: hash truncado (no reversible en la práctica y de longitud fija). */
export const hashIdentity = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 24);

export class NoopRateLimiter implements RateLimiter {
  readonly kind = "noop" as const;
  async check(rule: RateLimitRule, _identity?: string): Promise<RateLimitDecision> {
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}

export interface RestRateLimiterOptions {
  url: string;
  token: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class RestRateLimiter implements RateLimiter {
  readonly kind = "rest" as const;
  private readonly doFetch: typeof fetch;

  constructor(private readonly options: RestRateLimiterOptions) {
    this.doFetch = options.fetch ?? fetch;
  }

  async check(rule: RateLimitRule, identity: string): Promise<RateLimitDecision> {
    const key = `hiloluna:rl:${rule.name}:${hashIdentity(identity)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 1500);
    try {
      const response = await this.doFetch(`${this.options.url.replace(/\/+$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(rule.windowSeconds), "NX"], ["TTL", key]]),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw Object.assign(new Error("rate limit provider"), { code: `http_${response.status}` });
      const results = (await response.json()) as Array<{ result?: unknown; error?: unknown }>;
      const count = Number(results[0]?.result);
      const ttl = Number(results[2]?.result);
      if (!Number.isFinite(count)) throw Object.assign(new Error("rate limit provider"), { code: "bad_response" });
      const allowed = count <= rule.limit;
      return { allowed, remaining: Math.max(0, rule.limit - count), retryAfterSeconds: allowed ? 0 : Number.isFinite(ttl) && ttl > 0 ? ttl : rule.windowSeconds };
    } catch (error) {
      // Fail-open: se registra (sin la clave ni la identidad) y se deja pasar.
      logger.warn("rate_limit.provider_error", { rule: rule.name, error: (error as { code?: string; name?: string })?.code ?? (error as Error)?.name ?? "desconocido" });
      return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}

type Env = Readonly<Record<string, string | undefined>>;

/** Elige el proveedor por entorno. */
export function createRateLimiter(env: Env = process.env): RateLimiter {
  const url = env.RATE_LIMIT_REST_URL?.trim();
  const token = env.RATE_LIMIT_REST_TOKEN?.trim();
  return url && token ? new RestRateLimiter({ url, token }) : new NoopRateLimiter();
}

let cached: RateLimiter | undefined;
export function getRateLimiter(): RateLimiter {
  cached ??= createRateLimiter();
  return cached;
}

/**
 * ¿Queda bloqueado el intento? `true` = HAY QUE RECHAZARLO. Comprueba varias identidades de una misma regla (p. ej. cliente e invitado) y
 * se detiene en la primera que excede el límite.
 */
export async function isRateLimited(checks: ReadonlyArray<{ rule: RateLimitRule; identity: string }>, limiter: RateLimiter = getRateLimiter()): Promise<boolean> {
  for (const { rule, identity } of checks) {
    if (!(await limiter.check(rule, identity)).allowed) return true;
  }
  return false;
}
