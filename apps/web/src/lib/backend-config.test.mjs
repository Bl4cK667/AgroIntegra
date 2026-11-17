import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoForbiddenPublicSecrets, resolveBackendConfig } from './backend-config.ts';

function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

test('usa defaults seguros no modo legacy sem variáveis definidas', () => {
  const config = resolveBackendConfig({});
  assert.equal(config.apiUrl, 'http://localhost:3001');
  assert.equal(config.authMode, 'legacy');
  assert.equal(config.supabase.url, null);
  assert.equal(config.supabase.publishableKey, null);
});

test('aceita HTTPS em produção e remove barra final mantendo modo legacy', () => {
  const config = resolveBackendConfig({
    NODE_ENV: 'production',
    NEXT_PUBLIC_API_URL: 'https://api.agrointegra.gov.br///',
    NEXT_PUBLIC_AUTH_MODE: 'legacy',
    NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co/',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: 'anon', iss: 'supabase' }),
  });
  assert.equal(config.apiUrl, 'https://api.agrointegra.gov.br');
  assert.equal(config.authMode, 'legacy');
  assert.equal(config.supabase.url, 'https://xyz.supabase.co');
});

test('rejeita NEXT_PUBLIC_AUTH_MODE=supabase por ainda não estar implementado', () => {
  assert.throws(
    () =>
      resolveBackendConfig({
        NEXT_PUBLIC_AUTH_MODE: 'supabase',
        NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: 'anon' }),
      }),
    /ainda não está implementado/,
  );
});

test('rejeita HTTP não-local em produção', () => {
  assert.throws(
    () =>
      resolveBackendConfig({
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://api.agrointegra.gov.br',
      }),
    /HTTPS/,
  );
});

test('rejeita URL com credenciais, query string ou fragmento', () => {
  assert.throws(
    () => resolveBackendConfig({ NEXT_PUBLIC_API_URL: 'https://user:pass@api.agrointegra.gov.br' }),
    /usuário ou senha/,
  );
  assert.throws(
    () => resolveBackendConfig({ NEXT_PUBLIC_API_URL: 'https://api.agrointegra.gov.br?token=123' }),
    /query string/,
  );
  assert.throws(
    () => resolveBackendConfig({ NEXT_PUBLIC_API_URL: 'https://api.agrointegra.gov.br#frag' }),
    /fragmento/,
  );
});

test('rejeita NEXT_PUBLIC_* com nome arbitrário de segredo ou token service_role', () => {
  assert.throws(
    () =>
      assertNoForbiddenPublicSecrets({
        NEXT_PUBLIC_CUSTOM_SECRET_KEY: 'anything',
      }),
    /não pode existir no frontend/,
  );

  assert.throws(
    () =>
      resolveBackendConfig({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'anything',
      }),
    /não pode existir no frontend/,
  );

  assert.throws(
    () =>
      resolveBackendConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: 'service_role' }),
      }),
    /service_role/,
  );

  assert.throws(
    () =>
      resolveBackendConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_123456',
      }),
    /chave secreta/,
  );
});
