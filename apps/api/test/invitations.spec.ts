// Testes unitários de convites e cadastro fechado. Banco e Supabase são dublês em memória.
import { ConflictException, ForbiddenException, GoneException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthUser } from '../src/auth/current-user.decorator';
import { CreateInvitationDto, RegisterDto } from '../src/invitations/invitation.dto';
import { deriveAuthUserId, generateInvitationToken, hashInvitationToken, isWellFormedToken } from '../src/invitations/invitation-token';
import { InvitationsService } from '../src/invitations/invitations.service';
import { MSG, RegistrationService, STALE_CLAIM_MS } from '../src/invitations/registration.service';
import { SupabaseAuthError } from '../src/supabase/supabase-auth.client';
import { TenancyService } from '../src/tenancy/tenancy.service';
import { FakeAudit, FakeAuthDb, FakeSupabaseAuth } from './fake-auth-db';

/* eslint-disable @typescript-eslint/no-explicit-any */
const asAny = (x: unknown) => x as any;

describe('Token de convite', () => {
  it('32 bytes aleatórios em base64url; só o SHA-256 é guardado', () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashInvitationToken(a.token));
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).not.toContain(a.token);
    expect(isWellFormedToken(a.token)).toBe(true);
    expect(isWellFormedToken('curto')).toBe(false);
    expect(isWellFormedToken(`${a.token}=`)).toBe(false);
  });

  it('id remoto determinístico por convite, em formato UUID', () => {
    expect(deriveAuthUserId('inv-1')).toBe(deriveAuthUserId('inv-1'));
    expect(deriveAuthUserId('inv-1')).not.toBe(deriveAuthUserId('inv-2'));
    expect(deriveAuthUserId('inv-1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('Validação dos dados de cadastro', () => {
  const base = { token: generateInvitationToken().token, name: 'Maria da Silva', email: ' Maria@Exemplo.test ', phone: '(61) 99999-8888', password: 'senhaForte1' };
  const errorsOf = async (over: Record<string, unknown>) => {
    const dto = plainToInstance(RegisterDto, { ...base, ...over });
    return { dto, errors: (await validate(dto)).map((e) => e.property) };
  };

  it('normaliza e-mail e telefone e aceita dados válidos', async () => {
    const { dto, errors } = await errorsOf({});
    expect(errors).toEqual([]);
    expect(dto.email).toBe('maria@exemplo.test');
    expect(dto.phone).toBe('61999998888');
  });

  it.each([
    ['nome sem sobrenome', { name: 'Maria' }, 'name'],
    ['telefone sem DDD', { phone: '99999-8888' }, 'phone'],
    ['senha curta', { password: 'abc12' }, 'password'],
    ['senha sem número', { password: 'somenteletras' }, 'password'],
    ['senha acima de 72', { password: `a1${'x'.repeat(71)}` }, 'password'],
    ['token malformado', { token: 'abc' }, 'token'],
    ['e-mail inválido', { email: 'maria' }, 'email'],
  ])('recusa %s', async (_, over, field) => {
    expect((await errorsOf(over)).errors).toContain(field);
  });

  it('convite: validade entre 1 e 168 horas e perfil do enum', async () => {
    const bad = plainToInstance(CreateInvitationDto, { email: 'a@b.test', role: 'ADMIN', expiresInHours: 500 });
    expect((await validate(bad)).map((e) => e.property).sort()).toEqual(['expiresInHours', 'role']);
  });
});

function setup() {
  const db = new FakeAuthDb();
  const tenancy = new TenancyService();
  const audit = new FakeAudit(tenancy);
  const supabase = new FakeSupabaseAuth();
  const org = db.addOrganization({ name: 'Secretaria de Agricultura' });
  const other = db.addOrganization({ name: 'Outra Secretaria' });
  const admin = db.addUser({ email: 'coord@exemplo.test', role: 'COORDINATION' });
  db.addMembership(admin.id, org.id, 'COORDINATION');
  const actor: AuthUser = { id: admin.id, name: 'Coord', email: admin.email as string, role: 'COORDINATION', organizationId: org.id, navStyle: 'topbar', theme: null };
  const invitations = new InvitationsService(asAny(db), tenancy, asAny(audit));
  const registration = new RegistrationService(asAny(db), asAny(supabase), tenancy, asAny(audit));
  const inOrg = <T>(orgId: string, fn: () => Promise<T>) => tenancy.run({ organizationId: orgId, userId: admin.id }, fn);
  return { db, tenancy, audit, supabase, org, other, admin, actor, invitations, registration, inOrg };
}

const tokenFromUrl = (url: string) => new URL(url).hash.replace('#token=', '');

describe('InvitationsService (coordenação)', () => {
  it('cria convite com token só no link, hash no banco e auditoria na organização', async () => {
    const s = setup();
    const res = await s.inOrg(s.org.id, () => s.invitations.create(s.actor, { email: ' Nova@Exemplo.test ', role: 'TECHNICIAN', expiresInHours: 24 }));
    expect(res).toMatchObject({ email: 'nova@exemplo.test', role: 'TECHNICIAN' });
    expect(res.registrationUrl).toMatch(/^http:\/\/localhost:3000\/cadastro#token=[A-Za-z0-9_-]{43}$/);
    const token = tokenFromUrl(res.registrationUrl);
    const stored = s.db.invitations[0];
    expect(stored.tokenHash).toBe(hashInvitationToken(token));
    expect(JSON.stringify(s.db.invitations)).not.toContain(token);
    expect(stored).toMatchObject({ organizationId: s.org.id, createdById: s.admin.id });
    expect(s.audit.entries.at(-1)).toMatchObject({ action: 'INVITATION_CREATED', organizationId: s.org.id });
    expect(JSON.stringify(s.audit.entries)).not.toContain(token);
  });

  it('sem contexto de organização falha 403 (nunca usa organização do cliente)', async () => {
    const s = setup();
    await expect(s.tenancy.run({}, () => s.invitations.create(s.actor, { email: 'x@exemplo.test', role: 'TECHNICIAN' }))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(s.tenancy.run({}, () => s.invitations.list())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('novo convite para o mesmo e-mail revoga o pendente anterior; e-mail com conta existente é recusado', async () => {
    const s = setup();
    const first = await s.inOrg(s.org.id, () => s.invitations.create(s.actor, { email: 'nova@exemplo.test', role: 'TECHNICIAN' }));
    await s.inOrg(s.org.id, () => s.invitations.create(s.actor, { email: 'nova@exemplo.test', role: 'COORDINATION' }));
    expect(s.db.invitations.find((i) => i.id === first.id)!.revokedAt).toBeInstanceOf(Date);
    await expect(s.inOrg(s.org.id, () => s.invitations.create(s.actor, { email: 'coord@exemplo.test', role: 'TECHNICIAN' }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('lista e revoga só convites da própria organização, sem expor tokenHash', async () => {
    const s = setup();
    const mine = await s.inOrg(s.org.id, () => s.invitations.create(s.actor, { email: 'a@exemplo.test', role: 'TECHNICIAN' }));
    const foreign = s.db.addInvitation({ organizationId: s.other.id, email: 'b@exemplo.test', tokenHash: 'outro' });

    const { items } = await s.inOrg(s.org.id, () => s.invitations.list());
    expect(items.map((i) => i.id)).toEqual([mine.id]);
    expect(Object.keys(items[0]).sort()).toEqual(['createdAt', 'email', 'expiresAt', 'id', 'revokedAt', 'role', 'usedAt']);

    await expect(s.inOrg(s.org.id, () => s.invitations.revoke(s.actor, foreign.id))).rejects.toBeInstanceOf(NotFoundException);
    expect(foreign.revokedAt).toBeNull();
    await expect(s.inOrg(s.org.id, () => s.invitations.revoke(s.actor, mine.id))).resolves.toMatchObject({ id: mine.id });
    await expect(s.inOrg(s.org.id, () => s.invitations.revoke(s.actor, mine.id))).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('RegistrationService (cadastro por convite)', () => {
  async function invite(s: ReturnType<typeof setup>, email = 'nova@exemplo.test', role: 'TECHNICIAN' | 'COORDINATION' = 'TECHNICIAN') {
    const res = await s.inOrg(s.org.id, () => s.invitations.create(s.actor, { email, role }));
    return { token: tokenFromUrl(res.registrationUrl), id: res.id };
  }
  const form = (token: string, over: Record<string, string> = {}) => ({
    token,
    name: 'Nova Pessoa',
    email: 'nova@exemplo.test',
    phone: '61999998888',
    password: 'senhaForte1',
    ...over,
  });

  it('pré-visualiza o convite sem reservá-lo', async () => {
    const s = setup();
    const { token } = await invite(s);
    await expect(s.registration.inspect(token)).resolves.toMatchObject({ email: 'nova@exemplo.test', organizationName: 'Secretaria de Agricultura' });
    expect(s.db.invitations[0].usedAt).toBeNull();
    await expect(s.registration.inspect(generateInvitationToken().token)).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.registration.inspect('nao-e-token')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cadastro completo: conta Supabase confirmada, User com authUserId, membership com org/perfil do convite, sem sessão', async () => {
    const s = setup();
    const { token, id } = await invite(s, 'nova@exemplo.test', 'COORDINATION');
    const res = await s.registration.register(form(token));
    expect(res).toEqual({ message: MSG.done });
    expect(JSON.stringify(res)).not.toMatch(/token|access/i);

    const authUserId = deriveAuthUserId(id);
    expect(s.supabase.accounts.get(authUserId)).toMatchObject({ email: 'nova@exemplo.test', password: 'senhaForte1' });
    const user = s.db.users.find((u) => u.email === 'nova@exemplo.test')!;
    expect(user).toMatchObject({ authUserId, role: 'COORDINATION', phone: '61999998888', active: true });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    expect(s.db.memberships.find((m) => m.userId === user.id)).toMatchObject({ organizationId: s.org.id, role: 'COORDINATION', active: true });
    expect(s.db.invitations[0].usedAt).toBeInstanceOf(Date);
    expect(s.audit.entries.at(-1)).toMatchObject({ action: 'USER_REGISTERED', organizationId: s.org.id, userId: user.id });

    // Uso único.
    await expect(s.registration.register(form(token))).rejects.toBeInstanceOf(GoneException);
    await expect(s.registration.inspect(token)).rejects.toBeInstanceOf(GoneException);
  });

  it('cadastro fechado por padrão: sem SUPABASE_REGISTRATION_ENABLED nada é criado', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.supabase.registrationEnabled = false;
    await expect(s.registration.register(form(token))).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(s.supabase.calls).toEqual([]);
    expect(s.db.users).toHaveLength(1);
    expect(s.db.invitations[0].usedAt).toBeNull();
  });

  it('e-mail, perfil e organização vêm do convite: e-mail diferente é recusado', async () => {
    const s = setup();
    const { token } = await invite(s);
    await expect(s.registration.register(form(token, { email: 'outra@exemplo.test' }))).rejects.toThrow(MSG.emailMismatch);
    expect(s.supabase.calls).toEqual([]);
  });

  it('convite expirado, revogado ou de organização inativa não cadastra', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.db.invitations[0].expiresAt = new Date(Date.now() - 1000);
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.expired);
    s.db.invitations[0].expiresAt = new Date(Date.now() + 3_600_000);
    s.org.active = false;
    await expect(s.registration.register(form(token))).rejects.toBeInstanceOf(GoneException);
    s.org.active = true;
    s.db.invitations[0].revokedAt = new Date();
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.revoked);
    expect(s.supabase.calls).toEqual([]);
  });

  it('concorrência: duas submissões simultâneas do mesmo convite criam uma única conta', async () => {
    const s = setup();
    const { token } = await invite(s);
    const results = await Promise.allSettled([s.registration.register(form(token)), s.registration.register(form(token)), s.registration.register(form(token))]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
      expect(r.reason).toBeInstanceOf(ConflictException);
    }
    expect(s.db.users.filter((u) => u.email === 'nova@exemplo.test')).toHaveLength(1);
    expect(s.supabase.accounts.size).toBe(1);
  });

  it('falha remota libera o convite para nova tentativa, sem dados locais', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.supabase.failCreate = new SupabaseAuthError('unavailable', 503);
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.unavailable);
    expect(s.db.invitations[0].usedAt).toBeNull();
    expect(s.db.users).toHaveLength(1);

    s.supabase.failCreate = new SupabaseAuthError('rejected', 422);
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.rejected);

    s.supabase.failCreate = null;
    await expect(s.registration.register(form(token))).resolves.toEqual({ message: MSG.done });
  });

  it('falha local depois da conta remota: NÃO apaga a conta remota, só libera a reserva; retry recupera o mesmo id', async () => {
    const s = setup();
    const { token, id } = await invite(s);
    s.db.failNextUserCreate = new Error('conexão perdida');
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.unavailable);
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
    expect(s.supabase.accounts.size).toBe(1); // órfã sem User/membership: não acessa nada
    expect(s.db.invitations[0].usedAt).toBeNull();
    expect(s.db.memberships).toHaveLength(1);
    await expect(s.registration.register(form(token, { password: 'outraSenha2' }))).resolves.toEqual({ message: MSG.done });
    expect(s.supabase.accounts.size).toBe(1);
    expect(s.supabase.accounts.get(deriveAuthUserId(id))!.password).toBe('outraSenha2');
  });

  it('resposta remota perdida (timeout após criar): retry retoma a MESMA conta pelo id determinístico', async () => {
    const s = setup();
    const { token, id } = await invite(s);
    s.supabase.loseCreateResponse = true;
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.unavailable);
    expect(s.supabase.accounts.size).toBe(1); // órfã remota temporária

    await expect(s.registration.register(form(token, { password: 'outraSenha2' }))).resolves.toEqual({ message: MSG.done });
    const authUserId = deriveAuthUserId(id);
    expect(s.supabase.accounts.size).toBe(1);
    expect(s.supabase.accounts.get(authUserId)!.password).toBe('outraSenha2');
    expect(s.db.users.find((u) => u.email === 'nova@exemplo.test')!.authUserId).toBe(authUserId);
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
  });

  it('e-mail já usado por OUTRA conta no Supabase: não assume a conta, libera convite e responde 409', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.supabase.accounts.set('conta-alheia', { id: 'conta-alheia', email: 'nova@exemplo.test', password: 'dela' });
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.remoteConflict);
    expect(s.supabase.accounts.get('conta-alheia')!.password).toBe('dela');
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
    expect(s.db.invitations[0].usedAt).toBeNull();
    expect(s.db.users.some((u) => u.authUserId === 'conta-alheia')).toBe(false);
  });

  it('revogação durante o cadastro: transação local aborta; conta remota fica órfã (sem vínculo) para reconciliação', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.db.onTransaction = () => {
      s.db.invitations[0].revokedAt = new Date();
      s.db.onTransaction = null;
    };
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.revoked);
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
    expect(s.db.users).toHaveLength(1);
    expect(s.db.users.some((u) => u.authUserId)).toBe(false);
  });

  it('reserva recente bloqueia; reserva abandonada (sem usuário) pode ser retomada dentro da validade', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.db.invitations[0].usedAt = new Date(Date.now() - 1000);
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.inProgress);
    s.db.invitations[0].usedAt = new Date(Date.now() - STALE_CLAIM_MS - 1000);
    await expect(s.registration.register(form(token))).resolves.toEqual({ message: MSG.done });
  });

  it('e-mail que já tem conta local não cadastra de novo', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.db.addUser({ email: 'nova@exemplo.test' });
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.accountExists);
    expect(s.supabase.calls).toEqual([]);
  });

  it('admin revoga convite reservado (cadastro em andamento): finalização aborta sem apagar conta remota', async () => {
    const s = setup();
    const { token, id } = await invite(s);
    const original = s.supabase.createUser.bind(s.supabase);
    s.supabase.createUser = async (input) => {
      const created = await original(input);
      // Revogação pela coordenação com o convite já reservado (usedAt preenchido), antes da transação local.
      expect(s.db.invitations[0].usedAt).toBeInstanceOf(Date);
      await s.inOrg(s.org.id, () => s.invitations.revoke(s.actor, id));
      return created;
    };
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.revoked);
    expect(s.db.invitations[0].revokedAt).toBeInstanceOf(Date);
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
    expect(s.db.users.some((u) => u.email === 'nova@exemplo.test')).toBe(false);
  });

  it('revogação direta de convite reservado sem usuário é aceita; de convite concluído, recusada', async () => {
    const s = setup();
    const a = await invite(s, 'a@exemplo.test');
    s.db.invitations.find((i) => i.id === a.id)!.usedAt = new Date();
    await expect(s.inOrg(s.org.id, () => s.invitations.revoke(s.actor, a.id))).resolves.toMatchObject({ id: a.id });

    const b = await invite(s, 'b@exemplo.test');
    await s.registration.register(form(b.token, { email: 'b@exemplo.test' }));
    await expect(s.inOrg(s.org.id, () => s.invitations.revoke(s.actor, b.id))).rejects.toThrow('Este convite já foi utilizado.');
  });

  it('organização desativada ou convite expirado durante o cadastro: falha na finalização, só libera a reserva', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.db.onTransaction = () => {
      s.org.active = false;
      s.db.onTransaction = null;
    };
    await expect(s.registration.register(form(token))).rejects.toBeInstanceOf(GoneException);
    expect(s.db.invitations[0].usedAt).toBeNull();

    s.org.active = true;
    s.db.onTransaction = () => {
      s.db.invitations[0].expiresAt = new Date(Date.now() - 1);
      s.db.onTransaction = null;
    };
    await expect(s.registration.register(form(token))).rejects.toBeInstanceOf(GoneException);
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
    expect(s.db.users.some((u) => u.email === 'nova@exemplo.test')).toBe(false);
  });

  it('Supabase devolve conta com id diferente do determinístico: recusa sem apagar a conta alheia', async () => {
    const s = setup();
    const { token } = await invite(s);
    s.supabase.createUser = async (input) => {
      s.supabase.accounts.set('id-inesperado', { id: 'id-inesperado', email: input.email, password: input.password });
      return { id: 'id-inesperado', email: input.email };
    };
    await expect(s.registration.register(form(token))).rejects.toThrow(MSG.remoteConflict);
    expect(s.supabase.accounts.has('id-inesperado')).toBe(true);
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
    expect(s.db.users.some((u) => u.email === 'nova@exemplo.test')).toBe(false);
    expect(s.db.invitations[0].usedAt).toBeNull();
  });

  it('corrida com reserva retomada: tentativa antiga (A) não desfaz nem altera a finalização nova (B)', async () => {
    const s = setup();
    const { token, id } = await invite(s);
    const authUserId = deriveAuthUserId(id);
    const original = s.supabase.createUser.bind(s.supabase);
    let resultB: Promise<unknown> | null = null;
    s.supabase.createUser = async (input) => {
      const created = await original(input);
      if (!resultB) {
        // A cria a conta remota e "pausa" > STALE_CLAIM_MS; B retoma a reserva abandonada e conclui.
        const later = new Date(Date.now() + STALE_CLAIM_MS + 60_000);
        resultB = s.registration.register(form(token, { password: 'senhaDaB22' }), later);
        await resultB;
      }
      return created;
    };

    // A volta e falha: lease perdido (CAS) => não cria User, não libera a reserva de B, não apaga nem altera a conta.
    await expect(s.registration.register(form(token, { password: 'senhaDaA11' }))).rejects.toThrow(MSG.used);
    await expect(resultB).resolves.toEqual({ message: MSG.done });

    const users = s.db.users.filter((u) => u.email === 'nova@exemplo.test');
    expect(users).toHaveLength(1);
    expect(users[0].authUserId).toBe(authUserId);
    expect(s.db.memberships.filter((m) => m.userId === users[0].id)).toHaveLength(1);
    expect(s.supabase.accounts.get(authUserId)!.password).toBe('senhaDaB22');
    expect(s.supabase.calls.some((c) => c.startsWith('delete:'))).toBe(false);
    expect(s.db.invitations[0].usedAt).toBeInstanceOf(Date); // reserva/conclusão de B intacta
  });

  it('tentativa antiga que chega ao caminho de adoção depois de outra retomar não sobrescreve a senha', async () => {
    const s = setup();
    const { token, id } = await invite(s);
    const authUserId = deriveAuthUserId(id);
    // Conta remota já existe (tentativa anterior perdida).
    s.supabase.accounts.set(authUserId, { id: authUserId, email: 'nova@exemplo.test', password: 'antiga' });
    const originalGet = s.supabase.getUser.bind(s.supabase);
    let resultB: Promise<unknown> | null = null;
    s.supabase.getUser = async (uid) => {
      const r = await originalGet(uid);
      if (!resultB) {
        const later = new Date(Date.now() + STALE_CLAIM_MS + 60_000);
        resultB = s.registration.register(form(token, { password: 'senhaDaB22' }), later);
        await resultB;
      }
      return r;
    };
    await expect(s.registration.register(form(token, { password: 'senhaDaA11' }))).rejects.toBeInstanceOf(ConflictException);
    await expect(resultB).resolves.toEqual({ message: MSG.done });
    expect(s.supabase.accounts.get(authUserId)!.password).toBe('senhaDaB22');
    expect(s.db.users.filter((u) => u.authUserId === authUserId)).toHaveLength(1);
  });
});
