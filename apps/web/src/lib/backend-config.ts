// Configuração pública de backend para o frontend (@agrointegra/web).
//
// Regras de segurança:
// - Apenas variáveis NEXT_PUBLIC_* públicas podem ser lidas no navegador.
// - Nunca exponha SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET ou segredos de servidor aqui.
// - Em produção (NODE_ENV === 'production'), URLs não-locais exigem HTTPS.
// - URLs não podem conter credenciais (user:pass@), query string ou fragmento (#).
// - O frontend opera exclusivamente no modo "legacy" (autenticação via API NestJS).

export type AuthMode = 'legacy';

export interface BackendConfig {
  apiUrl: string;
  authMode: AuthMode;
  supabase: {
    url: string | null;
    publishableKey: string | null;
  };
}

export type BackendEnv = Record<string, string | undefined>;

const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const FORBIDDEN_PUBLIC_NAME_RE =
  /SERVICE_ROLE|JWT_SECRET|SECRET_KEY|DATABASE_URL|ADMIN_TOKEN|PRIVATE_KEY/i;

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

export function validateEndpointUrl(
  name: string,
  rawValue: string,
  options: { allowHttpInDev?: boolean; nodeEnv?: string } = {},
): string {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(`Configuração inválida: ${name} não é uma URL válida.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`Configuração insegura: ${name} não pode conter usuário ou senha na URL.`);
  }
  if (parsed.search) {
    throw new Error(`Configuração insegura: ${name} não pode conter query string.`);
  }
  if (parsed.hash) {
    throw new Error(`Configuração insegura: ${name} não pode conter fragmento (#).`);
  }

  const isHttps = parsed.protocol === 'https:';
  const isLocalHttp = parsed.protocol === 'http:' && isLocalHost(parsed.hostname);
  const isProd = (options.nodeEnv ?? process.env.NODE_ENV) === 'production';
  const allowAnyHttp = options.allowHttpInDev && !isProd;

  if (!isHttps && !isLocalHttp && !allowAnyHttp) {
    throw new Error(`Configuração insegura: ${name} deve usar HTTPS (HTTP é permitido apenas para localhost).`);
  }

  return trimTrailingSlashes(parsed.toString());
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Impede que chaves administrativas (ex.: service_role) ou nomes de segredos
 * sejam expostos em variáveis NEXT_PUBLIC_* no navegador.
 */
export function assertNoForbiddenPublicSecrets(env: BackendEnv): void {
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue;
    if (FORBIDDEN_PUBLIC_NAME_RE.test(key)) {
      throw new Error(`Configuração insegura: a variável pública ${key} não pode existir no frontend.`);
    }
    const trimmed = value?.trim();
    if (!trimmed) continue;

    if (/^sb_secret_/i.test(trimmed)) {
      throw new Error(`Configuração insegura: ${key} contém uma chave secreta do Supabase.`);
    }

    const jwtPayload = decodeJwtPayload(trimmed);
    if (jwtPayload && jwtPayload.role === 'service_role') {
      throw new Error(`Configuração insegura: ${key} contém um token service_role, proibido no navegador.`);
    }
  }
}

export function resolveBackendConfig(
  env: BackendEnv = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): BackendConfig {
  assertNoForbiddenPublicSecrets(env);

  const nodeEnv = env.NODE_ENV;
  const rawApiUrl = env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_LOCAL_API_URL;
  const apiUrl = validateEndpointUrl('NEXT_PUBLIC_API_URL', rawApiUrl, { nodeEnv });

  const rawAuthMode = (env.NEXT_PUBLIC_AUTH_MODE?.trim() || 'legacy').toLowerCase();
  if (rawAuthMode === 'supabase') {
    throw new Error(
      'Modo "supabase" ainda não está implementado no frontend; mantenha NEXT_PUBLIC_AUTH_MODE=legacy (login via API NestJS).',
    );
  }
  if (rawAuthMode !== 'legacy') {
    throw new Error('Configuração inválida: NEXT_PUBLIC_AUTH_MODE deve ser "legacy".');
  }

  const rawSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseUrl = rawSupabaseUrl
    ? validateEndpointUrl('NEXT_PUBLIC_SUPABASE_URL', rawSupabaseUrl, { nodeEnv })
    : null;

  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    null;

  return {
    apiUrl,
    authMode: 'legacy',
    supabase: {
      url: supabaseUrl,
      publishableKey,
    },
  };
}

let cachedConfig: BackendConfig | null = null;

export function getBackendConfig(): BackendConfig {
  if (!cachedConfig) {
    cachedConfig = resolveBackendConfig();
  }
  return cachedConfig;
}
