// Tipos mínimos do Express (o projeto não tem @types/express).
export interface HttpRequest {
  method: string;
  ip?: string;
  body?: { email?: unknown } | undefined;
}
export interface HttpResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  status(code: number): HttpResponse;
  json(body: unknown): unknown;
  writableFinished?: boolean;
  on(event: 'close', listener: () => void): unknown;
}
type NextFunction = (err?: unknown) => void;

type Env = Record<string, string | undefined>;

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

// WEB_ORIGIN aceita uma ou mais origens separadas por vírgula. "*" é recusado.
export function resolveCorsOrigins(env: Env = process.env): string[] {
  const raw = env.WEB_ORIGIN?.trim() || DEFAULT_WEB_ORIGIN;
  const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (!origins.length) return [DEFAULT_WEB_ORIGIN];
  return origins.map((origin) => {
    if (origin === '*') throw new Error('WEB_ORIGIN não pode ser "*": informe as origens do painel.');
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`WEB_ORIGIN inválida: ${origin}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`WEB_ORIGIN inválida: ${origin}`);
    return url.origin;
  });
}

// TRUST_PROXY: número de proxies à frente da API (ex.: 1 atrás de um load balancer). Sem valor, não confia.
export function resolveTrustProxy(env: Env = process.env): number | false {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) return false;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) throw new Error('TRUST_PROXY deve ser um inteiro >= 0.');
  return hops || false;
}

// Cabeçalhos básicos para uma API JSON (sem dependência extra).
export function securityHeaders(_req: HttpRequest, res: HttpResponse, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

export interface LoginRateLimitOptions {
  maxFailures: number; // por IP + e-mail
  maxFailuresPerIp: number; // por IP, somando todos os e-mails (impede contornar trocando o e-mail)
  windowMs: number;
  maxKeys?: number; // teto real de chaves em memória
  now?: () => number;
}

export function loginRateLimitOptions(env: Env = process.env): LoginRateLimitOptions {
  const int = (name: string, fallback: number, min: number) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min) throw new Error(`${name} deve ser um inteiro >= ${min}.`);
    return n;
  };
  return {
    maxFailures: int('AUTH_LOGIN_MAX_FAILURES', 10, 1),
    maxFailuresPerIp: int('AUTH_LOGIN_MAX_FAILURES_PER_IP', 50, 1),
    windowMs: int('AUTH_LOGIN_WINDOW_SECONDS', 15 * 60, 1) * 1000,
  };
}

export const TOO_MANY_ATTEMPTS = 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';

type Bucket = { count: number; resetAt: number };

// Janela fixa com teto de chaves: ao lotar, remove expiradas e depois as mais antigas (ordem de inserção do Map).
class BoundedCounter {
  private readonly map = new Map<string, Bucket>();
  constructor(private readonly maxKeys: number) {}

  get size() {
    return this.map.size;
  }

  get(key: string, t: number): Bucket | undefined {
    const b = this.map.get(key);
    if (b && b.resetAt <= t) {
      this.map.delete(key);
      return undefined;
    }
    return b;
  }

  increment(key: string, t: number, windowMs: number): Bucket {
    const current = this.get(key, t);
    if (current) {
      current.count += 1;
      return current;
    }
    if (this.map.size >= this.maxKeys) {
      for (const [k, v] of this.map) if (v.resetAt <= t) this.map.delete(k);
      for (const k of this.map.keys()) {
        if (this.map.size < this.maxKeys) break;
        this.map.delete(k);
      }
    }
    const b = { count: 1, resetAt: t + windowMs };
    this.map.set(key, b);
    return b;
  }

  refund(key: string, bucket: Bucket) {
    // Só devolve se ainda é o mesmo bucket (não expirou nem foi despejado).
    if (this.map.get(key) === bucket && bucket.count > 0) bucket.count -= 1;
  }
}

// Limita tentativas de login por IP + e-mail e por IP.
// A tentativa é contada ANTES de chegar ao controller (requisições paralelas não escapam do limite);
// só é devolvida se a resposta terminar com status diferente de 401 (login certo ou erro de validação).
// Conexões abortadas continuam contando. Memória do processo: em várias instâncias cada uma conta
// separadamente (trocar por store compartilhado ao escalar). Sem TRUST_PROXY atrás de proxy, todos
// compartilham o IP do proxy.
export function createLoginRateLimiter({ maxFailures, maxFailuresPerIp, windowMs, maxKeys = 50_000, now = Date.now }: LoginRateLimitOptions) {
  const byIpEmail = new BoundedCounter(maxKeys);
  const byIp = new BoundedCounter(maxKeys);

  const limiter = function loginRateLimit(req: HttpRequest, res: HttpResponse, next: NextFunction) {
    if (req.method !== 'POST') return next();
    const ip = req.ip ?? 'desconhecido';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    const pairKey = `${ip}|${email}`;
    const t = now();

    const pair = byIpEmail.get(pairKey, t);
    const perIp = byIp.get(ip, t);
    const blocked = [pair && pair.count >= maxFailures ? pair : null, perIp && perIp.count >= maxFailuresPerIp ? perIp : null].filter(
      (b): b is Bucket => !!b,
    );
    if (blocked.length) {
      const resetAt = Math.max(...blocked.map((b) => b.resetAt));
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - t) / 1000))));
      res.status(429).json({ statusCode: 429, message: TOO_MANY_ATTEMPTS });
      return;
    }

    const pairBucket = byIpEmail.increment(pairKey, t, windowMs);
    const ipBucket = byIp.increment(ip, t, windowMs);
    let settled = false;
    res.on('close', () => {
      if (settled) return;
      settled = true;
      if (res.writableFinished && res.statusCode !== 401) {
        byIpEmail.refund(pairKey, pairBucket);
        byIp.refund(ip, ipBucket);
      }
    });
    next();
  };
  return Object.assign(limiter, { stats: () => ({ pairs: byIpEmail.size, ips: byIp.size }) });
}

export interface RequestRateLimitOptions {
  maxRequests: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

export function registrationRateLimitOptions(env: Env = process.env): RequestRateLimitOptions {
  const int = (name: string, fallback: number, min: number) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min) throw new Error(`${name} deve ser um inteiro >= ${min}.`);
    return n;
  };
  return {
    maxRequests: int('AUTH_REGISTRATION_MAX_REQUESTS', 20, 1),
    windowMs: int('AUTH_REGISTRATION_WINDOW_SECONDS', 15 * 60, 1) * 1000,
  };
}

export const TOO_MANY_REQUESTS = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

// Limite por IP que conta TODA requisição antes do processamento (sucesso ou falha), para rotas
// públicas caras (bcrypt, Admin API do Supabase). Usado só em /auth/registration e /auth/register,
// com um único bucket compartilhado entre as duas. Memória do processo, teto real de chaves.
export function createRequestRateLimiter({ maxRequests, windowMs, maxKeys = 50_000, now = Date.now }: RequestRateLimitOptions) {
  const byIp = new BoundedCounter(maxKeys);
  const limiter = function requestRateLimit(req: HttpRequest, res: HttpResponse, next: NextFunction) {
    if (req.method === 'OPTIONS') return next();
    const ip = req.ip ?? 'desconhecido';
    const t = now();
    const current = byIp.get(ip, t);
    if (current && current.count >= maxRequests) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - t) / 1000))));
      res.status(429).json({ statusCode: 429, message: TOO_MANY_REQUESTS });
      return;
    }
    byIp.increment(ip, t, windowMs);
    next();
  };
  return Object.assign(limiter, { stats: () => ({ ips: byIp.size }) });
}
