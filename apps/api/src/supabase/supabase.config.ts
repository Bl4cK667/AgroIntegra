// Configuração do Supabase, exclusiva do servidor.
// Fica DESLIGADA por padrão: sem SUPABASE_AUTH_ENABLED=true a API segue só com o login local.
// Nenhum valor daqui pode ir para respostas HTTP, logs ou para o frontend.
// ESCOPO: valida access tokens do Supabase Auth (identidade = User.authUserId), verifica senha de contas
// Supabase no login e, só com SUPABASE_REGISTRATION_ENABLED=true, cria contas via Admin API para convites.
// NÃO cobre refresh/logout/revogação de sessão Supabase, RLS nem Storage.

export interface SupabaseDisabledConfig {
  enabled: false;
}

export interface SupabaseEnabledConfig {
  enabled: true;
  url: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  // Criação de contas via Admin API (convites). Fail-closed: exige flag explícita + service role.
  registrationEnabled: boolean;
  // Segredos: acessados só por quem precisa; omitidos em toJSON/inspect.
  readonly secrets: SupabaseSecrets;
}

export type SupabaseConfig = SupabaseDisabledConfig | SupabaseEnabledConfig;

export const SUPABASE_CONFIG = Symbol('SUPABASE_CONFIG');

const REDACTED = '[redacted]';

// Guarda as chaves sem deixá-las vazar por JSON.stringify, console.log ou mensagens de erro.
export class SupabaseSecrets {
  readonly #jwtSecret?: string;
  readonly #serviceRoleKey?: string;
  readonly #publishableKey?: string;

  constructor(jwtSecret?: string, serviceRoleKey?: string, publishableKey?: string) {
    this.#jwtSecret = jwtSecret || undefined;
    this.#serviceRoleKey = serviceRoleKey || undefined;
    this.#publishableKey = publishableKey || undefined;
  }

  // Chave para endpoints públicos do Auth (ex.: grant de senha). Preferir a publishable; senão a service role.
  publicApiKey(): string {
    const key = this.#publishableKey ?? this.#serviceRoleKey;
    if (!key) throw new Error('Nenhuma chave de API do Supabase configurada.');
    return key;
  }

  get jwtSecret(): string | undefined {
    return this.#jwtSecret;
  }

  get hasServiceRoleKey(): boolean {
    return !!this.#serviceRoleKey;
  }

  // Só para clientes administrativos no servidor (ex.: Storage, Auth Admin). Nunca devolva ao cliente.
  serviceRoleKey(): string {
    if (!this.#serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
    return this.#serviceRoleKey;
  }

  toJSON() {
    return {
      jwtSecret: this.#jwtSecret ? REDACTED : undefined,
      serviceRoleKey: this.#serviceRoleKey ? REDACTED : undefined,
      publishableKey: this.#publishableKey ? REDACTED : undefined,
    };
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `SupabaseSecrets ${JSON.stringify(this.toJSON())}`;
  }
}

type Env = Record<string, string | undefined>;

const TRUE = new Set(['1', 'true', 'yes', 'on']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function fail(message: string): never {
  throw new Error(`Configuração do Supabase inválida: ${message}`);
}

function parseHttpUrl(name: string, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} não é uma URL válida.`);
  }
  // HTTP só é aceito para o Supabase local (supabase start).
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    fail(`${name} precisa usar https (http só em localhost).`);
  }
  return url;
}

const trimSlash = (s: string) => s.replace(/\/+$/, '');

// Impede que segredos do Supabase sejam publicados em variáveis que o Next.js envia ao navegador.
export function assertNoPublicSecrets(env: Env) {
  const secretValues = [env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_JWT_SECRET].filter((v): v is string => !!v);
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue;
    if (/SERVICE_ROLE|JWT_SECRET|SECRET_KEY/i.test(key) || (value && secretValues.includes(value))) {
      fail(`a variável ${key} expõe um segredo do Supabase ao navegador.`);
    }
  }
}

const isTrue = (v: string | undefined) => TRUE.has((v ?? '').trim().toLowerCase());

export function loadSupabaseConfig(env: Env = process.env): SupabaseConfig {
  assertNoPublicSecrets(env);
  const registrationEnabled = isTrue(env.SUPABASE_REGISTRATION_ENABLED);
  if (!isTrue(env.SUPABASE_AUTH_ENABLED)) {
    if (registrationEnabled) fail('SUPABASE_REGISTRATION_ENABLED=true exige SUPABASE_AUTH_ENABLED=true.');
    return { enabled: false };
  }

  const rawUrl = env.SUPABASE_URL?.trim();
  if (!rawUrl) fail('SUPABASE_URL é obrigatória quando SUPABASE_AUTH_ENABLED=true.');
  const url = trimSlash(parseHttpUrl('SUPABASE_URL', rawUrl).toString());

  const issuer = trimSlash(env.SUPABASE_JWT_ISSUER?.trim() || `${url}/auth/v1`);
  const jwksUrl = env.SUPABASE_JWKS_URL?.trim() || `${issuer}/.well-known/jwks.json`;
  parseHttpUrl('SUPABASE_JWKS_URL', jwksUrl);

  // Vínculo automático por e-mail/app_metadata foi descartado: a identidade é só User.authUserId.
  if (env.SUPABASE_USER_LINK !== undefined) fail('SUPABASE_USER_LINK não é suportada; o vínculo é só por User.authUserId.');

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (registrationEnabled && !serviceRoleKey) fail('SUPABASE_REGISTRATION_ENABLED=true exige SUPABASE_SERVICE_ROLE_KEY.');
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishableKey && serviceRoleKey && publishableKey === serviceRoleKey) {
    fail('SUPABASE_PUBLISHABLE_KEY não pode ser igual a SUPABASE_SERVICE_ROLE_KEY.');
  }

  const jwtSecret = env.SUPABASE_JWT_SECRET?.trim();
  if (jwtSecret && jwtSecret.length < 32) fail('SUPABASE_JWT_SECRET muito curta (mínimo 32 caracteres).');
  if (jwtSecret && env.JWT_SECRET && jwtSecret === env.JWT_SECRET) {
    fail('SUPABASE_JWT_SECRET não pode ser igual a JWT_SECRET (tokens locais e do Supabase ficariam intercambiáveis).');
  }

  return {
    enabled: true,
    url,
    issuer,
    audience: env.SUPABASE_JWT_AUDIENCE?.trim() || 'authenticated',
    jwksUrl,
    registrationEnabled,
    secrets: new SupabaseSecrets(jwtSecret, serviceRoleKey, publishableKey),
  };
}
