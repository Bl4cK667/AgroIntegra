import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createPublicKey } from 'node:crypto';

// JWK público (formato do endpoint /.well-known/jwks.json do Supabase).
export type PublicJwk = { kty?: string; kid?: string; alg?: string; [field: string]: unknown };
import { SUPABASE_CONFIG, SupabaseConfig, SupabaseEnabledConfig } from './supabase.config';

// Claims do access token do Supabase Auth que a API usa.
export interface SupabaseClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  role?: string;
  email?: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  session_id?: string;
  aal?: string;
}

export class SupabaseTokenError extends Error {}

export type JwksFetcher = (url: string) => Promise<{ keys: PublicJwk[] }>;

export const JWKS_FETCHER = Symbol('JWKS_FETCHER');

export const defaultJwksFetcher: JwksFetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(3000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`JWKS respondeu ${res.status}`);
  return res.json() as Promise<Awaited<ReturnType<JwksFetcher>>>;
};

const ASYMMETRIC = ['ES256', 'RS256'] as const;
const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_MIN_REFRESH_MS = 30 * 1000;

function decodeSegment(token: string, index: 0 | 1): Record<string, unknown> | null {
  const part = token.split('.')[index];
  if (!part) return null;
  try {
    const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

// Valida access tokens emitidos pelo Supabase Auth (JWKS ES256/RS256 ou segredo HS256 legado).
@Injectable()
export class SupabaseJwtVerifier {
  private readonly logger = new Logger(SupabaseJwtVerifier.name);
  // Instância própria, sem segredo padrão: nunca cai no JWT_SECRET local.
  private readonly jwt = new JwtService({});
  private keys = new Map<string, string>();
  private fetchedAt = 0;
  private inflight?: Promise<void>;

  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    @Inject(JWKS_FETCHER) private readonly fetchJwks: JwksFetcher,
  ) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  // Decisão de roteamento apenas (sem confiar no conteúdo): o token diz vir do emissor Supabase?
  isSupabaseToken(token: string): boolean {
    if (!this.config.enabled) return false;
    return decodeSegment(token, 1)?.iss === this.config.issuer;
  }

  async verify(token: string): Promise<SupabaseClaims> {
    if (!this.config.enabled) throw new SupabaseTokenError('Supabase desativado.');
    const config = this.config;
    const header = decodeSegment(token, 0);
    const alg = typeof header?.alg === 'string' ? header.alg : '';
    const kid = typeof header?.kid === 'string' ? header.kid : undefined;

    const common = { issuer: config.issuer, audience: config.audience, clockTolerance: 5 };
    let claims: SupabaseClaims;
    try {
      if (alg === 'HS256') {
        const secret = config.secrets.jwtSecret;
        if (!secret) throw new SupabaseTokenError('HS256 não habilitado.');
        claims = await this.jwt.verifyAsync<SupabaseClaims>(token, { ...common, secret, algorithms: ['HS256'] });
      } else if ((ASYMMETRIC as readonly string[]).includes(alg)) {
        const publicKey = await this.publicKey(config, kid);
        claims = await this.jwt.verifyAsync<SupabaseClaims>(token, { ...common, publicKey, algorithms: [alg as (typeof ASYMMETRIC)[number]] });
      } else {
        throw new SupabaseTokenError('Algoritmo não permitido.');
      }
    } catch (err) {
      if (err instanceof SupabaseTokenError) throw err;
      throw new SupabaseTokenError('Token do Supabase inválido.');
    }

    if (typeof claims.sub !== 'string' || !claims.sub) throw new SupabaseTokenError('Token sem sub.');
    if (claims.role !== 'authenticated') throw new SupabaseTokenError('Papel do token não permitido.');
    if (claims.is_anonymous === true) throw new SupabaseTokenError('Sessão anônima não permitida.');
    if (typeof claims.exp !== 'number') throw new SupabaseTokenError('Token sem expiração.');
    return claims;
  }

  private async publicKey(config: SupabaseEnabledConfig, kid?: string): Promise<string> {
    if (!kid) throw new SupabaseTokenError('Token sem kid.');
    const stale = Date.now() - this.fetchedAt > JWKS_TTL_MS;
    const canRefresh = Date.now() - this.fetchedAt > JWKS_MIN_REFRESH_MS;
    if (stale || (!this.keys.has(kid) && canRefresh)) await this.refresh(config);
    const key = this.keys.get(kid);
    if (!key) throw new SupabaseTokenError('Chave de assinatura desconhecida.');
    return key;
  }

  private refresh(config: SupabaseEnabledConfig): Promise<void> {
    this.inflight ??= (async () => {
      try {
        const { keys } = await this.fetchJwks(config.jwksUrl);
        const next = new Map<string, string>();
        for (const jwk of keys ?? []) {
          if (!jwk.kid || (jwk.alg && !(ASYMMETRIC as readonly string[]).includes(jwk.alg))) continue;
          // Só chaves públicas; um JWK com "d" (parte privada) é ignorado.
          if ('d' in jwk) continue;
          next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' }).toString());
        }
        this.keys = next;
        this.fetchedAt = Date.now();
      } catch (err) {
        // Mantém as chaves anteriores. Loga só a classe do erro (a mensagem pode conter URL ou corpo da resposta).
        this.logger.warn(`Falha ao atualizar JWKS do Supabase (${err instanceof Error ? err.name : typeof err}).`);
        this.fetchedAt = Math.max(this.fetchedAt, Date.now() - JWKS_TTL_MS + JWKS_MIN_REFRESH_MS);
      } finally {
        this.inflight = undefined;
      }
    })();
    return this.inflight;
  }
}
