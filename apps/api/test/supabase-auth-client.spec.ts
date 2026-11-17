// Testes unitários do cliente HTTP do Supabase Auth. fetch é dublê: nenhuma conta remota é criada.
import { Logger } from '@nestjs/common';
import { loadSupabaseConfig } from '../src/supabase/supabase.config';
import { FetchLike, SupabaseAuthClient, SupabaseAuthError } from '../src/supabase/supabase-auth.client';

const URL_BASE = 'https://projeto-teste.supabase.co';
const SERVICE_ROLE = 'sb_secret_fake_nao_real_123';
const PUBLISHABLE = 'sb_publishable_fake_123';

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

function client(responses: (Call extends never ? never : (call: Call) => { status: number; body?: unknown } | Error)[], env: Record<string, string> = {}) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const call = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const next = responses.shift();
    if (!next) throw new Error('chamada inesperada');
    const r = next(call);
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body ?? {} };
  };
  const config = loadSupabaseConfig({
    SUPABASE_AUTH_ENABLED: 'true',
    SUPABASE_URL: URL_BASE,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
    SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    SUPABASE_REGISTRATION_ENABLED: 'true',
    ...env,
  });
  return { c: new SupabaseAuthClient(config, fetchImpl, 50), calls };
}

const ok = (body: unknown) => () => ({ status: 200, body });
const user = { id: 'auth-1', email: 'Nova@Exemplo.test' };

describe('SupabaseAuthClient', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('createUser: Admin API com id determinístico, email_confirm e service role só em apikey', async () => {
    const { c, calls } = client([ok(user)]);
    await expect(c.createUser({ id: 'auth-1', email: 'nova@exemplo.test', password: 'senhaForte1', name: 'Nova Pessoa' })).resolves.toEqual({
      id: 'auth-1',
      email: 'nova@exemplo.test',
    });
    expect(calls[0]).toMatchObject({
      url: `${URL_BASE}/auth/v1/admin/users`,
      method: 'POST',
      body: { id: 'auth-1', email: 'nova@exemplo.test', password: 'senhaForte1', email_confirm: true, user_metadata: { name: 'Nova Pessoa' } },
    });
    expect(calls[0].headers.apikey).toBe(SERVICE_ROLE);
    expect(calls[0].headers.authorization).toBeUndefined(); // chave nova não é JWT
  });

  it('chave legada em formato JWT também vai em Authorization', async () => {
    const jwtKey = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.assinatura';
    const { c, calls } = client([ok(user)], { SUPABASE_SERVICE_ROLE_KEY: jwtKey });
    await c.createUser({ id: 'auth-1', email: 'nova@exemplo.test', password: 'senhaForte1', name: 'N P' });
    expect(calls[0].headers.authorization).toBe(`Bearer ${jwtKey}`);
  });

  it('e-mail existente => email_exists; 5xx transitório tem retry; erros não carregam corpo nem chaves', async () => {
    const { c } = client([() => ({ status: 422, body: { error_code: 'email_exists', msg: 'segredo do corpo' } })]);
    const err = await c.createUser({ id: 'a', email: 'x@y.test', password: 'p', name: 'n' }).catch((e) => e);
    expect(err).toBeInstanceOf(SupabaseAuthError);
    expect(err.kind).toBe('email_exists');
    expect(String(err.message)).not.toMatch(/segredo|sb_secret/);

    const retry = client([() => ({ status: 503 }), () => ({ status: 502 }), ok(user)]);
    await expect(retry.c.createUser({ id: 'a', email: 'x@y.test', password: 'p', name: 'n' })).resolves.toMatchObject({ id: 'auth-1' });
    expect(retry.calls).toHaveLength(3);

    const down = client([() => ({ status: 503 }), () => ({ status: 503 }), () => ({ status: 503 })]);
    await expect(down.c.createUser({ id: 'a', email: 'x@y.test', password: 'p', name: 'n' })).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('timeout/rede => unavailable, com log só da classe do erro', async () => {
    const boom = () => new TypeError(`fetch failed ${URL_BASE}?apikey=${SERVICE_ROLE}`);
    const { c } = client([boom, boom, boom]);
    await expect(c.deleteUser('auth-1')).rejects.toMatchObject({ kind: 'unavailable' });
    for (const call of warn.mock.calls) expect(String(call[0])).not.toMatch(/sb_secret|apikey|auth-1/);
  });

  it('grant de senha usa a chave publishable e não faz retry; 400 => invalid_credentials', async () => {
    const { c, calls } = client([() => ({ status: 400, body: { error_code: 'invalid_credentials' } })]);
    await expect(c.verifyPassword('x@y.test', 'errada')).rejects.toMatchObject({ kind: 'invalid_credentials' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${URL_BASE}/auth/v1/token?grant_type=password`);
    expect(calls[0].headers.apikey).toBe(PUBLISHABLE);
  });

  it('troca de senha própria: confere identidade ANTES do PUT /user com o token do usuário', async () => {
    const grant = ok({ access_token: 'token-do-usuario', user });
    const { c, calls } = client([grant, ok({})]);
    await c.changeOwnPassword('nova@exemplo.test', 'atual', 'novaSenha2', 'auth-1');
    expect(calls[1]).toMatchObject({ url: `${URL_BASE}/auth/v1/user`, method: 'PUT', body: { password: 'novaSenha2' } });
    expect(calls[1].headers.authorization).toBe('Bearer token-do-usuario');
    expect(calls[1].headers.apikey).toBe(PUBLISHABLE);

    const mismatch = client([grant]);
    await expect(mismatch.c.changeOwnPassword('nova@exemplo.test', 'atual', 'novaSenha2', 'auth-OUTRO')).rejects.toMatchObject({ kind: 'identity_mismatch' });
    expect(mismatch.calls).toHaveLength(1); // nenhum PUT
  });

  it('fail-closed: sem SUPABASE_REGISTRATION_ENABLED a Admin API não é chamada', async () => {
    const { c, calls } = client([], { SUPABASE_REGISTRATION_ENABLED: 'false' });
    expect(c.registrationEnabled).toBe(false);
    for (const op of [
      () => c.createUser({ id: 'a', email: 'x@y.test', password: 'p', name: 'n' }),
      () => c.getUser('a'),
      () => c.updatePassword('a', 'p'),
      () => c.deleteUser('a'),
    ]) {
      await expect(op()).rejects.toMatchObject({ kind: 'disabled' });
    }
    expect(calls).toHaveLength(0);

    const off = new SupabaseAuthClient({ enabled: false }, async () => {
      throw new Error('não deveria chamar');
    });
    await expect(off.verifyPassword('x@y.test', 'p')).rejects.toMatchObject({ kind: 'disabled' });
  });

  it('getUser 404 => null; deleteUser 404 => ok (compensação idempotente)', async () => {
    const { c } = client([() => ({ status: 404 }), () => ({ status: 404 })]);
    await expect(c.getUser('auth-x')).resolves.toBeNull();
    await expect(c.deleteUser('auth-x')).resolves.toBeUndefined();
  });
});
