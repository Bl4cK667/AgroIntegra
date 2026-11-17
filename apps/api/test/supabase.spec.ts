// Testes unitários da camada Supabase (opt-in). Não usam banco nem rede.
import { ExecutionContext, ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import { inspect } from 'node:util';
import { AuthGuard } from '../src/auth/auth.guard';
import { ROLES } from '../src/auth/roles.decorator';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadSupabaseConfig, SupabaseConfig } from '../src/supabase/supabase.config';
import { SupabaseIdentityService } from '../src/supabase/supabase-identity.service';
import { MembershipsService, NO_ACTIVE_ORGANIZATION, ORGANIZATION_FORBIDDEN, ORGANIZATION_REQUIRED } from '../src/auth/memberships.service';
import { TenancyService } from '../src/tenancy/tenancy.service';
import { FakeAuthDb } from './fake-auth-db';
import { JwksFetcher, SupabaseJwtVerifier, SupabaseTokenError } from '../src/supabase/supabase-jwt.verifier';

const SUPABASE_URL = 'https://projeto-teste.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const HS_SECRET = 'supabase-legacy-secret-com-mais-de-32-caracteres';
const SERVICE_ROLE = 'service-role-fake-nao-real';
const LOCAL_SECRET = 'segredo-local-dos-testes-unitarios';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const KID = 'kid-teste';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig' };
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const enabledEnv = (extra: Record<string, string> = {}) => ({
  SUPABASE_AUTH_ENABLED: 'true',
  SUPABASE_URL,
  SUPABASE_JWT_SECRET: HS_SECRET,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
  ...extra,
});

const signer = new JwtService({});
const baseClaims = (over: Record<string, unknown> = {}) => ({
  sub: 'supabase-uid-1',
  role: 'authenticated',
  email: 'tecnico@agrointegra.demo',
  ...over,
});
const es256 = (claims = baseClaims(), opts: Record<string, unknown> = {}) =>
  signer.signAsync(claims, { privateKey: privatePem, algorithm: 'ES256', keyid: KID, issuer: ISSUER, audience: 'authenticated', expiresIn: '5m', ...opts });
const hs256 = (claims = baseClaims(), secret = HS_SECRET) =>
  signer.signAsync(claims, { secret, algorithm: 'HS256', issuer: ISSUER, audience: 'authenticated', expiresIn: '5m' });

function makeVerifier(config: SupabaseConfig) {
  const fetcher = jest.fn<ReturnType<JwksFetcher>, Parameters<JwksFetcher>>(async () => ({ keys: [jwk] }));
  return { verifier: new SupabaseJwtVerifier(config, fetcher), fetcher };
}

describe('Configuração do Supabase', () => {
  it('fica desligada por padrão, mesmo com URL definida', () => {
    expect(loadSupabaseConfig({})).toEqual({ enabled: false });
    expect(loadSupabaseConfig({ SUPABASE_URL })).toEqual({ enabled: false });
    expect(loadSupabaseConfig({ SUPABASE_AUTH_ENABLED: 'false', SUPABASE_URL })).toEqual({ enabled: false });
  });

  it('quando ligada, deriva issuer, audience e JWKS da URL', () => {
    const config = loadSupabaseConfig(enabledEnv({ SUPABASE_URL: `${SUPABASE_URL}/` }));
    expect(config).toMatchObject({
      enabled: true,
      url: SUPABASE_URL,
      issuer: ISSUER,
      audience: 'authenticated',
      jwksUrl: `${ISSUER}/.well-known/jwks.json`,
    });
  });

  it('exige SUPABASE_URL e https (http só em localhost)', () => {
    expect(() => loadSupabaseConfig({ SUPABASE_AUTH_ENABLED: 'true' })).toThrow(/SUPABASE_URL/);
    expect(() => loadSupabaseConfig(enabledEnv({ SUPABASE_URL: 'http://exemplo.com' }))).toThrow(/https/);
    expect(loadSupabaseConfig(enabledEnv({ SUPABASE_URL: 'http://127.0.0.1:54321' })).enabled).toBe(true);
  });

  it('recusa SUPABASE_USER_LINK (vínculo por e-mail removido), segredo curto e segredo igual ao JWT local', () => {
    expect(() => loadSupabaseConfig(enabledEnv({ SUPABASE_USER_LINK: 'email' }))).toThrow(/SUPABASE_USER_LINK/);
    expect(() => loadSupabaseConfig(enabledEnv({ SUPABASE_USER_LINK: 'app_metadata' }))).toThrow(/SUPABASE_USER_LINK/);
    expect(() => loadSupabaseConfig(enabledEnv({ SUPABASE_JWT_SECRET: 'curto' }))).toThrow(/curta/);
    expect(() => loadSupabaseConfig(enabledEnv({ JWT_SECRET: HS_SECRET }))).toThrow(/JWT_SECRET/);
  });

  it('cadastro remoto é fail-closed: flag própria, exige auth ligada e service role', () => {
    expect(loadSupabaseConfig(enabledEnv())).toMatchObject({ enabled: true, registrationEnabled: false });
    expect(loadSupabaseConfig(enabledEnv({ SUPABASE_REGISTRATION_ENABLED: 'true' }))).toMatchObject({ registrationEnabled: true });
    expect(() => loadSupabaseConfig({ SUPABASE_REGISTRATION_ENABLED: 'true' })).toThrow(/SUPABASE_AUTH_ENABLED/);
    expect(() => loadSupabaseConfig(enabledEnv({ SUPABASE_REGISTRATION_ENABLED: 'true', SUPABASE_SERVICE_ROLE_KEY: '' }))).toThrow(/SERVICE_ROLE/);
    expect(() => loadSupabaseConfig(enabledEnv({ SUPABASE_PUBLISHABLE_KEY: SERVICE_ROLE }))).toThrow(/PUBLISHABLE/);
  });

  it('impede segredos em variáveis NEXT_PUBLIC_*, mesmo com o Supabase desligado', () => {
    expect(() => loadSupabaseConfig({ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'x' })).toThrow(/NEXT_PUBLIC_/);
    expect(() => loadSupabaseConfig(enabledEnv({ NEXT_PUBLIC_QUALQUER: SERVICE_ROLE }))).toThrow(/NEXT_PUBLIC_QUALQUER/);
    expect(loadSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toEqual({ enabled: false });
  });

  it('não vaza segredos em JSON, inspect ou mensagens de erro', () => {
    const config = loadSupabaseConfig(enabledEnv());
    const dumps = [JSON.stringify(config), inspect(config, { depth: 5 }), String(config)];
    for (const dump of dumps) {
      expect(dump).not.toContain(SERVICE_ROLE);
      expect(dump).not.toContain(HS_SECRET);
    }
    if (!config.enabled) throw new Error('esperado ligado');
    expect(config.secrets.serviceRoleKey()).toBe(SERVICE_ROLE);
    const semChave = loadSupabaseConfig(enabledEnv({ SUPABASE_SERVICE_ROLE_KEY: '' }));
    if (!semChave.enabled) throw new Error('esperado ligado');
    expect(() => semChave.secrets.serviceRoleKey()).toThrow(/não configurada/);
  });
});

describe('Verificação do token do Supabase', () => {
  const config = loadSupabaseConfig(enabledEnv());

  it('desligado: não reconhece nem aceita tokens e não acessa a rede', async () => {
    const { verifier, fetcher } = makeVerifier({ enabled: false });
    const token = await es256();
    expect(verifier.isSupabaseToken(token)).toBe(false);
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(SupabaseTokenError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('aceita ES256 assinado por chave do JWKS e reaproveita o cache', async () => {
    const { verifier, fetcher } = makeVerifier(config);
    const token = await es256();
    expect(verifier.isSupabaseToken(token)).toBe(true);
    await expect(verifier.verify(token)).resolves.toMatchObject({ sub: 'supabase-uid-1', email: 'tecnico@agrointegra.demo' });
    await verifier.verify(token);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aceita HS256 legado apenas com SUPABASE_JWT_SECRET', async () => {
    const { verifier } = makeVerifier(config);
    await expect(verifier.verify(await hs256())).resolves.toMatchObject({ sub: 'supabase-uid-1' });
    const { verifier: semSegredo } = makeVerifier(loadSupabaseConfig(enabledEnv({ SUPABASE_JWT_SECRET: '' })));
    await expect(semSegredo.verify(await hs256())).rejects.toBeInstanceOf(SupabaseTokenError);
  });

  it.each([
    ['assinatura HS256 com outro segredo', () => hs256(baseClaims(), 'outro-segredo-qualquer-com-32-caracteres!!')],
    ['emissor diferente', () => es256(baseClaims(), { issuer: 'https://outro.supabase.co/auth/v1' })],
    ['audiência diferente', () => es256(baseClaims(), { audience: 'service_role' })],
    ['token expirado', () => es256(baseClaims(), { expiresIn: -60 })],
    ['kid desconhecido', () => es256(baseClaims(), { keyid: 'outro-kid' })],
    ['papel anon', () => es256(baseClaims({ role: 'anon' }))],
    ['papel service_role', () => es256(baseClaims({ role: 'service_role' }))],
    ['sessão anônima', () => es256(baseClaims({ is_anonymous: true }))],
  ])('recusa %s', async (_, make) => {
    const { verifier } = makeVerifier(config);
    await expect(verifier.verify(await make())).rejects.toBeInstanceOf(SupabaseTokenError);
  });

  it('recusa alg "none" e token malformado', async () => {
    const { verifier } = makeVerifier(config);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...baseClaims(), iss: ISSUER, aud: 'authenticated', exp: 9999999999 })}.`;
    await expect(verifier.verify(none)).rejects.toBeInstanceOf(SupabaseTokenError);
    await expect(verifier.verify('nao.e.jwt')).rejects.toBeInstanceOf(SupabaseTokenError);
    expect(verifier.isSupabaseToken('lixo')).toBe(false);
  });

  it('ignora JWK com parte privada e sobrevive a falha do JWKS', async () => {
    const privJwk = { ...privateKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256' };
    const v1 = new SupabaseJwtVerifier(config, async () => ({ keys: [privJwk] }));
    await expect(v1.verify(await es256())).rejects.toBeInstanceOf(SupabaseTokenError);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const v2 = new SupabaseJwtVerifier(config, async () => {
      throw new Error(`falhou ${ISSUER}/.well-known/jwks.json?apikey=${SERVICE_ROLE}`);
    });
    await expect(v2.verify(await es256())).rejects.toBeInstanceOf(SupabaseTokenError);
    expect(warn).toHaveBeenCalled();
    for (const call of warn.mock.calls) {
      expect(String(call[0])).not.toContain(SERVICE_ROLE);
      expect(String(call[0])).not.toContain('jwks.json');
    }
    warn.mockRestore();
  });
});

describe('Vínculo Supabase → usuário local (authUserId)', () => {
  const claims = (over: Record<string, unknown> = {}) =>
    ({ ...baseClaims(over), iss: ISSUER, aud: 'authenticated', exp: 0 }) as Parameters<SupabaseIdentityService['resolveLocalUserId']>[0];

  it('liga somente por sub === User.authUserId; e-mail e metadata nunca vinculam', async () => {
    const db = new FakeAuthDb();
    const linked = db.addUser({ email: 'tecnico@agrointegra.demo', authUserId: 'supabase-uid-1' });
    const legacy = db.addUser({ email: 'legado@agrointegra.demo' });
    const svc = new SupabaseIdentityService(loadSupabaseConfig(enabledEnv()), db as unknown as PrismaService);
    await expect(svc.resolveLocalUserId(claims())).resolves.toBe(linked.id);
    // Mesmo e-mail de um usuário legado, outro sub, app_metadata/user_metadata "apontando" para ele: recusado.
    await expect(
      svc.resolveLocalUserId(
        claims({ sub: 'outro-sub', email: legacy.email, app_metadata: { agrointegra_user_id: legacy.id }, user_metadata: { agrointegra_user_id: legacy.id } }),
      ),
    ).rejects.toBeInstanceOf(SupabaseTokenError);
    await expect(new SupabaseIdentityService({ enabled: false }, db as unknown as PrismaService).resolveLocalUserId(claims())).rejects.toBeInstanceOf(
      SupabaseTokenError,
    );
  });
});

describe('AuthGuard: identidade + membership + tenancy', () => {
  const localJwt = new JwtService({ secret: LOCAL_SECRET });

  function world() {
    const db = new FakeAuthDb();
    const org = db.addOrganization({ id: '11111111-1111-4111-8111-111111111111', name: 'Org A' });
    const orgB = db.addOrganization({ id: '22222222-2222-4222-8222-222222222222', name: 'Org B' });
    const tecnico = db.addUser({ email: 'tecnico@agrointegra.demo', role: 'COORDINATION', authUserId: 'supabase-uid-1' });
    db.addMembership(tecnico.id, org.id, 'TECHNICIAN');
    return { db, org, orgB, tecnico };
  }

  function makeGuard(db: FakeAuthDb, config: SupabaseConfig, roles?: string[]) {
    const reflector = { getAllAndOverride: jest.fn((key: string) => (key === ROLES ? roles : undefined)) } as unknown as Reflector;
    const prisma = db as unknown as PrismaService;
    const { verifier } = makeVerifier(config);
    const tenancy = new TenancyService();
    const guard = new AuthGuard(reflector, localJwt, prisma, verifier, new SupabaseIdentityService(config, prisma), new MembershipsService(prisma), tenancy);
    return { guard, tenancy };
  }

  function ctx(token?: string, headers: Record<string, string> = {}) {
    const req: { headers: Record<string, string>; user?: unknown } = { headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) } };
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { context, req };
  }

  // Executa o guard dentro de um contexto de requisição (como o middleware de tenancy faz).
  async function activate(g: ReturnType<typeof makeGuard>, token?: string, headers?: Record<string, string>) {
    const { context, req } = ctx(token, headers);
    return g.tenancy.run({}, async () => {
      const ok = await g.guard.canActivate(context);
      return { ok, req, tenancy: g.tenancy.current() };
    });
  }

  const enabled = loadSupabaseConfig(enabledEnv());

  it('token local: perfil e organização vêm da membership (não de User.role) e preenchem o tenancy', async () => {
    const w = world();
    const token = await localJwt.signAsync({ sub: w.tecnico.id, role: 'COORDINATION' });
    for (const config of [{ enabled: false } as const, enabled]) {
      const r = await activate(makeGuard(w.db, config), token);
      expect(r.req.user).toMatchObject({ id: w.tecnico.id, role: 'TECHNICIAN', organizationId: w.org.id });
      expect(r.tenancy).toEqual({ organizationId: w.org.id, userId: w.tecnico.id, role: 'TECHNICIAN' });
    }
  });

  it('token Supabase: só com integração ligada, resolvido por authUserId', async () => {
    const w = world();
    const token = await es256();
    await expect(activate(makeGuard(w.db, { enabled: false }), token)).rejects.toBeInstanceOf(UnauthorizedException);
    const r = await activate(makeGuard(w.db, enabled), token);
    expect(r.req.user).toMatchObject({ id: w.tecnico.id, organizationId: w.org.id });
    const unlinked = await es256(baseClaims({ sub: 'sem-vinculo' }));
    await expect(activate(makeGuard(w.db, enabled), unlinked)).rejects.toThrow('Sessão inválida ou expirada.');
  });

  it('@Roles usa o perfil da membership: claim de role no token ou User.role não concedem acesso', async () => {
    const w = world();
    const supa = await es256(baseClaims({ app_metadata: { role: 'COORDINATION' }, user_metadata: { role: 'COORDINATION' } }));
    await expect(activate(makeGuard(w.db, enabled, ['COORDINATION']), supa)).rejects.toBeInstanceOf(ForbiddenException);
    const local = await localJwt.signAsync({ sub: w.tecnico.id, role: 'COORDINATION' });
    await expect(activate(makeGuard(w.db, enabled, ['COORDINATION']), local)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('X-Organization-Id: precisa de membership ativa em organização ativa', async () => {
    const w = world();
    const token = await localJwt.signAsync({ sub: w.tecnico.id });
    await expect(activate(makeGuard(w.db, enabled), token, { 'x-organization-id': w.orgB.id })).rejects.toThrow(ORGANIZATION_FORBIDDEN);
    await expect(activate(makeGuard(w.db, enabled), token, { 'x-organization-id': "' OR 1=1 --" })).rejects.toThrow(ORGANIZATION_FORBIDDEN);

    w.db.addMembership(w.tecnico.id, w.orgB.id, 'COORDINATION');
    await expect(activate(makeGuard(w.db, enabled), token)).rejects.toThrow(ORGANIZATION_REQUIRED);
    const r = await activate(makeGuard(w.db, enabled, ['COORDINATION']), token, { 'x-organization-id': w.orgB.id.toUpperCase() });
    expect(r.req.user).toMatchObject({ organizationId: w.orgB.id, role: 'COORDINATION' });

    w.orgB.active = false;
    await expect(activate(makeGuard(w.db, enabled), token, { 'x-organization-id': w.orgB.id })).rejects.toThrow(ORGANIZATION_FORBIDDEN);
  });

  it('sem membership ativa: 403, e o tenancy não é preenchido', async () => {
    const w = world();
    w.db.memberships[0].active = false;
    const token = await localJwt.signAsync({ sub: w.tecnico.id });
    const g = makeGuard(w.db, enabled);
    const seen: unknown[] = [];
    await expect(
      g.tenancy.run({}, async () => {
        try {
          await g.guard.canActivate(ctx(token).context);
        } finally {
          seen.push(g.tenancy.current());
        }
      }),
    ).rejects.toThrow(NO_ACTIVE_ORGANIZATION);
    expect(seen).toEqual([{}]);
  });

  it('usuário inativo é barrado; erros de token têm mensagem única', async () => {
    const w = world();
    w.tecnico.active = false;
    await expect(activate(makeGuard(w.db, enabled), await es256())).rejects.toThrow('Sessão inválida ou expirada.');
    const forged = await hs256(baseClaims(), 'outro-segredo-qualquer-com-32-caracteres!!');
    const alien = await new JwtService({ secret: 'outro-segredo' }).signAsync({ sub: w.tecnico.id });
    for (const token of [forged, alien, 'lixo']) {
      await expect(activate(makeGuard(w.db, enabled), token)).rejects.toThrow('Sessão inválida ou expirada.');
    }
    await expect(activate(makeGuard(w.db, enabled))).rejects.toThrow('Faça login para continuar.');
  });
});
