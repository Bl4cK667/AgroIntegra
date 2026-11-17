// Testes unitários do login (Supabase x legado) e da troca de senha. Dublês em memória, sem rede.
import { BadRequestException, ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AccountService } from '../src/account/account.service';
import { AuthService, LOGIN_UNAVAILABLE } from '../src/auth/auth.service';
import { MembershipsService, NO_ACTIVE_ORGANIZATION } from '../src/auth/memberships.service';
import { SupabaseAuthError } from '../src/supabase/supabase-auth.client';
import { TenancyService } from '../src/tenancy/tenancy.service';
import { FakeAudit, FakeAuthDb, FakeSupabaseAuth } from './fake-auth-db';

/* eslint-disable @typescript-eslint/no-explicit-any */
const asAny = (x: unknown) => x as any;
const SECRET = 'segredo-local-dos-testes-de-login';

async function world() {
  const db = new FakeAuthDb();
  const tenancy = new TenancyService();
  const audit = new FakeAudit(tenancy);
  const supabase = new FakeSupabaseAuth();
  const jwt = new JwtService({ secret: SECRET });
  const org = db.addOrganization({ name: 'Org A' });
  const legacy = db.addUser({ email: 'legado@exemplo.test', passwordHash: await bcrypt.hash('senha-legada', 4), role: 'COORDINATION' });
  db.addMembership(legacy.id, org.id, 'COORDINATION');
  const remote = db.addUser({ email: 'supa@exemplo.test', passwordHash: await bcrypt.hash('hash-aleatorio-inutilizavel', 4), authUserId: 'auth-1' });
  db.addMembership(remote.id, org.id, 'TECHNICIAN');
  supabase.accounts.set('auth-1', { id: 'auth-1', email: 'supa@exemplo.test', password: 'senhaSupa1' });
  const memberships = new MembershipsService(asAny(db));
  const auth = new AuthService(asAny(db), jwt, asAny(audit), memberships, asAny(supabase), tenancy);
  const account = new AccountService(asAny(db), asAny(audit), asAny(supabase));
  return { db, tenancy, audit, supabase, jwt, org, legacy, remote, auth, account };
}

describe('AuthService.login', () => {
  it('legado (sem authUserId) continua com bcrypt e mesmo contrato', async () => {
    const w = await world();
    const res = await w.auth.login(' Legado@Exemplo.test ', 'senha-legada');
    expect(res.accessToken).toEqual(expect.any(String));
    expect(res.user).toMatchObject({ id: w.legacy.id, email: 'legado@exemplo.test', role: 'COORDINATION', organizationId: w.org.id, navStyle: 'topbar' });
    expect(res.user.organizations).toEqual([{ id: w.org.id, name: 'Org A', role: 'COORDINATION' }]);
    expect(JSON.stringify(res)).not.toMatch(/passwordHash|authUserId/);
    expect(await w.jwt.verifyAsync(res.accessToken)).toMatchObject({ sub: w.legacy.id });
    expect(w.supabase.calls).toEqual([]);
  });

  it('conta com authUserId: senha conferida no Supabase; bcrypt local nunca é aceito', async () => {
    const w = await world();
    const res = await w.auth.login('supa@exemplo.test', 'senhaSupa1');
    expect(res.user).toMatchObject({ id: w.remote.id, role: 'TECHNICIAN', organizationId: w.org.id });
    expect(JSON.stringify(res)).not.toContain('senhaSupa1');
    await expect(w.auth.login('supa@exemplo.test', 'hash-aleatorio-inutilizavel')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('identidade Supabase diferente do authUserId local é recusada', async () => {
    const w = await world();
    w.supabase.accounts.clear();
    w.supabase.accounts.set('auth-OUTRO', { id: 'auth-OUTRO', email: 'supa@exemplo.test', password: 'senhaSupa1' });
    await expect(w.auth.login('supa@exemplo.test', 'senhaSupa1')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('Supabase desligado: conta Supabase não entra (sem fallback para bcrypt); indisponível => 503', async () => {
    const w = await world();
    w.supabase.enabled = false;
    await expect(w.auth.login('supa@exemplo.test', 'senhaSupa1')).rejects.toBeInstanceOf(UnauthorizedException);
    w.supabase.enabled = true;
    w.supabase.verifyPassword = async () => {
      throw new SupabaseAuthError('unavailable');
    };
    await expect(w.auth.login('supa@exemplo.test', 'senhaSupa1')).rejects.toThrow(LOGIN_UNAVAILABLE);
    await expect(w.auth.login('supa@exemplo.test', 'senhaSupa1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('auditoria: falha sem organização (trilha de segurança), sucesso no contexto da membership', async () => {
    const w = await world();
    await expect(w.auth.login('ninguem@exemplo.test', 'x')).rejects.toThrow('E-mail ou senha inválidos.');
    await expect(w.auth.login('legado@exemplo.test', 'errada')).rejects.toThrow('E-mail ou senha inválidos.');
    await w.auth.login('legado@exemplo.test', 'senha-legada');
    expect(w.audit.entries.map((e) => [e.action, e.organizationId])).toEqual([
      ['LOGIN_FAILED', null],
      ['LOGIN_FAILED', null],
      ['LOGIN', w.org.id],
    ]);
    expect(JSON.stringify(w.audit.entries)).not.toMatch(/senha-legada|errada/);
    expect(w.tenancy.current()).toBeUndefined();
  });

  it('sem membership ativa: 403 e nenhuma membership é criada automaticamente', async () => {
    const w = await world();
    w.db.memberships.forEach((m) => (m.active = false));
    await expect(w.auth.login('legado@exemplo.test', 'senha-legada')).rejects.toThrow(NO_ACTIVE_ORGANIZATION);
    await expect(w.auth.login('legado@exemplo.test', 'senha-legada')).rejects.toBeInstanceOf(ForbiddenException);
    expect(w.db.memberships.filter((m) => m.active)).toHaveLength(0);
  });

  it('várias organizações: organizationId nulo e lista para o painel escolher', async () => {
    const w = await world();
    const orgB = w.db.addOrganization({ name: 'Org B' });
    w.db.addMembership(w.legacy.id, orgB.id, 'TECHNICIAN');
    const res = await w.auth.login('legado@exemplo.test', 'senha-legada');
    expect(res.user.organizationId).toBeNull();
    expect(res.user.organizations.map((o) => o.id)).toEqual([w.org.id, orgB.id]);
  });

  it('usuário inativo não entra', async () => {
    const w = await world();
    w.legacy.active = false;
    await expect(w.auth.login('legado@exemplo.test', 'senha-legada')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AccountService.changePassword', () => {
  it('conta Supabase: troca via token do usuário, nunca bcrypt; senha atual errada => 400', async () => {
    const w = await world();
    const hashBefore = w.remote.passwordHash;
    await expect(w.account.changePassword(w.remote.id, { currentPassword: 'errada', newPassword: 'novaSenha2' })).rejects.toThrow('A senha atual está incorreta.');
    await expect(w.account.changePassword(w.remote.id, { currentPassword: 'senhaSupa1', newPassword: 'curta' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(w.account.changePassword(w.remote.id, { currentPassword: 'senhaSupa1', newPassword: 'novaSenha2' })).resolves.toEqual({ ok: true });
    expect(w.supabase.accounts.get('auth-1')!.password).toBe('novaSenha2');
    expect(w.remote.passwordHash).toBe(hashBefore);
    // Senha local "inutilizável" não serve como senha atual.
    await expect(w.account.changePassword(w.remote.id, { currentPassword: 'hash-aleatorio-inutilizavel', newPassword: 'outra3senha' })).rejects.toThrow(
      'A senha atual está incorreta.',
    );
  });

  it('conta Supabase com integração desligada ou identidade divergente: falha fechado sem alterar', async () => {
    const w = await world();
    w.supabase.enabled = false;
    await expect(w.account.changePassword(w.remote.id, { currentPassword: 'senhaSupa1', newPassword: 'novaSenha2' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    w.supabase.enabled = true;
    w.remote.authUserId = 'auth-divergente';
    await expect(w.account.changePassword(w.remote.id, { currentPassword: 'senhaSupa1', newPassword: 'novaSenha2' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(w.supabase.accounts.get('auth-1')!.password).toBe('senhaSupa1');
  });

  it('conta legada continua com bcrypt, sem chamar o Supabase', async () => {
    const w = await world();
    await expect(w.account.changePassword(w.legacy.id, { currentPassword: 'senha-legada', newPassword: 'nova-legada' })).resolves.toEqual({ ok: true });
    expect(await bcrypt.compare('nova-legada', w.legacy.passwordHash as string)).toBe(true);
    expect(w.supabase.calls).toEqual([]);
  });
});
