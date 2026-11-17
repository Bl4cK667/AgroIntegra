import { Inject, Injectable, Logger } from '@nestjs/common';
import { SUPABASE_CONFIG, SupabaseConfig, SupabaseEnabledConfig } from './supabase.config';

// Cliente HTTP mínimo do Supabase Auth (GoTrue), exclusivo do servidor.
// - Nunca devolve corpo de resposta, URL com chave ou detalhes remotos em mensagens de erro.
// - Timeouts curtos; retry só para falhas transitórias de operações idempotentes.
// - Admin API (service role) só funciona com SUPABASE_REGISTRATION_ENABLED=true.

export type SupabaseAuthErrorKind =
  | 'disabled' // integração ou cadastro desligados
  | 'invalid_credentials'
  | 'email_exists'
  | 'not_found'
  | 'rejected' // 4xx não esperado (dados recusados pelo Supabase)
  | 'identity_mismatch' // conta remota não é a identidade local esperada
  | 'unavailable'; // rede, timeout, 5xx, 429

export class SupabaseAuthError extends Error {
  constructor(
    readonly kind: SupabaseAuthErrorKind,
    readonly status?: number,
  ) {
    super(`Supabase Auth: ${kind}${status ? ` (${status})` : ''}`);
    this.name = 'SupabaseAuthError';
  }
}

export interface SupabaseAuthUser {
  id: string;
  email: string | null;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

export const SUPABASE_FETCH = Symbol('SUPABASE_FETCH');
export const SUPABASE_AUTH_TIMEOUT_MS = Symbol('SUPABASE_AUTH_TIMEOUT_MS');

const DEFAULT_TIMEOUT_MS = 5000;
const RETRY_DELAYS_MS = [200, 600];

const isJwt = (key: string) => key.startsWith('eyJ');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorCode(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  for (const field of ['error_code', 'code', 'error']) if (typeof b[field] === 'string') return b[field] as string;
  return '';
}

function parseUser(body: unknown): SupabaseAuthUser {
  const raw = body && typeof body === 'object' && 'user' in body && (body as { user?: unknown }).user ? (body as { user: unknown }).user : body;
  const u = raw as { id?: unknown; email?: unknown } | null;
  if (!u || typeof u.id !== 'string' || !u.id) throw new SupabaseAuthError('rejected');
  return { id: u.id, email: typeof u.email === 'string' ? u.email.toLowerCase() : null };
}

@Injectable()
export class SupabaseAuthClient {
  private readonly logger = new Logger(SupabaseAuthClient.name);

  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    @Inject(SUPABASE_FETCH) private readonly fetchImpl: FetchLike,
    @Inject(SUPABASE_AUTH_TIMEOUT_MS) private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  get registrationEnabled(): boolean {
    return this.config.enabled && this.config.registrationEnabled;
  }

  // Confere e-mail/senha no Supabase (grant password). O token emitido é descartado: a API emite a própria sessão.
  async verifyPassword(email: string, password: string): Promise<SupabaseAuthUser> {
    return (await this.passwordGrant(email, password)).user;
  }

  // Troca de senha da própria conta: valida a senha atual (grant) e usa o token DO USUÁRIO em PUT /user.
  // Não usa service role. O token fica só em memória nesta chamada.
  // A identidade é conferida ANTES de alterar: se o e-mail no Supabase for de outra conta, nada muda.
  async changeOwnPassword(email: string, currentPassword: string, newPassword: string, expectedAuthUserId: string): Promise<SupabaseAuthUser> {
    const config = this.requireEnabled();
    const { user, accessToken } = await this.passwordGrant(email, currentPassword);
    if (user.id !== expectedAuthUserId) throw new SupabaseAuthError('identity_mismatch');
    const res = await this.request(config, 'PUT', '/user', { password: newPassword }, config.secrets.publicApiKey(), false, accessToken);
    if (res.status === 422 || res.status === 400) throw new SupabaseAuthError('rejected', res.status);
    await this.expectOk(res);
    return user;
  }

  private async passwordGrant(email: string, password: string): Promise<{ user: SupabaseAuthUser; accessToken: string }> {
    const config = this.requireEnabled();
    const res = await this.request(config, 'POST', '/token?grant_type=password', { email, password }, config.secrets.publicApiKey(), false);
    if (res.status === 400 || res.status === 401 || res.status === 422) throw new SupabaseAuthError('invalid_credentials', res.status);
    const body = await this.expectOk(res);
    const accessToken = (body as { access_token?: unknown })?.access_token;
    if (typeof accessToken !== 'string' || !accessToken) throw new SupabaseAuthError('rejected');
    return { user: parseUser(body), accessToken };
  }

  // Cria usuário confirmado (o convite, entregue pela administração ao e-mail dela, é a prova do e-mail).
  // `id` determinístico torna a operação idempotente em retries (ver RegistrationService).
  async createUser(input: { id: string; email: string; password: string; name: string }): Promise<SupabaseAuthUser> {
    const config = this.requireRegistration();
    const res = await this.request(
      config,
      'POST',
      '/admin/users',
      { id: input.id, email: input.email, password: input.password, email_confirm: true, user_metadata: { name: input.name } },
      config.secrets.serviceRoleKey(),
      true,
    );
    if (res.status === 422 || res.status === 409) {
      const code = errorCode(await res.json().catch(() => null));
      if (/exists|already|registered/i.test(code) || res.status === 409) throw new SupabaseAuthError('email_exists', res.status);
      throw new SupabaseAuthError('rejected', res.status);
    }
    return parseUser(await this.expectOk(res));
  }

  async getUser(id: string): Promise<SupabaseAuthUser | null> {
    const config = this.requireRegistration();
    const res = await this.request(config, 'GET', `/admin/users/${encodeURIComponent(id)}`, undefined, config.secrets.serviceRoleKey(), true);
    if (res.status === 404) return null;
    return parseUser(await this.expectOk(res));
  }

  // Admin: redefine senha e confirma e-mail. Usado só ao retomar um cadastro por convite interrompido.
  async updatePassword(id: string, password: string): Promise<void> {
    const config = this.requireRegistration();
    const body = { password, email_confirm: true };
    const res = await this.request(config, 'PUT', `/admin/users/${encodeURIComponent(id)}`, body, config.secrets.serviceRoleKey(), true);
    if (res.status === 404) throw new SupabaseAuthError('not_found', 404);
    if (res.status === 422) throw new SupabaseAuthError('rejected', 422);
    await this.expectOk(res);
  }

  // Remoção administrativa (404 = já não existe). NÃO é chamada pelo cadastro: contas órfãs são
  // reconciliadas manualmente (ver RegistrationService.ensureRemoteUser).
  async deleteUser(id: string): Promise<void> {
    const config = this.requireRegistration();
    const res = await this.request(config, 'DELETE', `/admin/users/${encodeURIComponent(id)}`, undefined, config.secrets.serviceRoleKey(), true);
    if (res.status === 404) return;
    await this.expectOk(res);
  }

  private requireEnabled(): SupabaseEnabledConfig {
    if (!this.config.enabled) throw new SupabaseAuthError('disabled');
    return this.config;
  }

  private requireRegistration(): SupabaseEnabledConfig {
    const config = this.requireEnabled();
    if (!config.registrationEnabled || !config.secrets.hasServiceRoleKey) throw new SupabaseAuthError('disabled');
    return config;
  }

  private async expectOk(res: { status: number; ok: boolean; json(): Promise<unknown> }): Promise<unknown> {
    if (res.ok) return res.json().catch(() => ({}));
    if (res.status === 429 || res.status >= 500) throw new SupabaseAuthError('unavailable', res.status);
    throw new SupabaseAuthError('rejected', res.status);
  }

  private async request(
    config: SupabaseEnabledConfig,
    method: string,
    path: string,
    body: unknown,
    apiKey: string,
    retry: boolean,
    userAccessToken?: string,
  ) {
    const headers: Record<string, string> = { apikey: apiKey, accept: 'application/json' };
    // Chaves novas (sb_secret_/sb_publishable_) não são JWT: vão só em apikey.
    if (userAccessToken) headers.authorization = `Bearer ${userAccessToken}`;
    else if (isJwt(apiKey)) headers.authorization = `Bearer ${apiKey}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const url = `${config.url}/auth/v1${path}`;
    const attempts = retry ? RETRY_DELAYS_MS.length + 1 : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const transient = res.status === 429 || res.status >= 500;
        if (!transient || attempt === attempts - 1) return res;
      } catch (err) {
        // Só a classe do erro: a mensagem pode conter a URL.
        this.logger.warn(`Supabase Auth ${method} ${path.split('?')[0].replace(/^\/admin\/users\/.+$/, '/admin/users/:id')} falhou (${err instanceof Error ? err.name : typeof err}).`);
        if (attempt === attempts - 1) throw new SupabaseAuthError('unavailable');
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
    throw new SupabaseAuthError('unavailable');
  }
}
