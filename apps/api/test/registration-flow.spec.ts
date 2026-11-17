// Fluxo HTTP completo (convite → cadastro → login → acesso) com controllers, guard, pipes, filtro e
// tenancy reais. Banco, auditoria e Supabase são dublês em memória: nenhuma conta remota, nenhum banco.
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AccountModule } from '../src/account/account.module';
import { AuditModule } from '../src/audit/audit.module';
import { AuditService } from '../src/audit/audit.service';
import { AuthModule } from '../src/auth/auth.module';
import { configureApp } from '../src/configure-app';
import { InvitationsModule } from '../src/invitations/invitations.module';
import { MSG } from '../src/invitations/registration.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SUPABASE_CONFIG } from '../src/supabase/supabase.config';
import { SupabaseAuthClient } from '../src/supabase/supabase-auth.client';
import { SupabaseModule } from '../src/supabase/supabase.module';
import { TenancyModule } from '../src/tenancy/tenancy.module';
import { TenancyService } from '../src/tenancy/tenancy.service';
import { FakeAudit, FakeAuthDb, FakeSupabaseAuth } from './fake-auth-db';

describe('Fluxo HTTP: convite → cadastro → login → acesso', () => {
  let app: INestApplication;
  let db: FakeAuthDb;
  let supabase: FakeSupabaseAuth;
  let audit: FakeAudit;
  const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeAll(async () => {
    db = new FakeAuthDb();
    supabase = new FakeSupabaseAuth();
    db.addOrganization({ id: ORG_A, name: 'Secretaria A' });
    db.addOrganization({ id: ORG_B, name: 'Secretaria B' });
    const hash = await bcrypt.hash('senha-coord', 4);
    const coordA = db.addUser({ email: 'coord.a@exemplo.test', passwordHash: hash, role: 'COORDINATION' });
    db.addMembership(coordA.id, ORG_A, 'COORDINATION');
    const coordB = db.addUser({ email: 'coord.b@exemplo.test', passwordHash: hash, role: 'COORDINATION' });
    db.addMembership(coordB.id, ORG_B, 'COORDINATION');

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TenancyModule, PrismaModule, SupabaseModule, AuditModule, AuthModule, InvitationsModule, AccountModule],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseAuthClient)
      .useValue(supabase)
      .overrideProvider(SUPABASE_CONFIG)
      .useValue({ enabled: false })
      .overrideProvider(AuditService)
      .useFactory({ factory: (tenancy: TenancyService) => (audit = new FakeAudit(tenancy)), inject: [TenancyService] })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, {});
    await app.init();
  });

  afterAll(() => app?.close());

  const api = () => request(app.getHttpServer());
  const login = async (email: string, password: string) => (await api().post('/auth/login').send({ email, password }).expect(200)).body;

  it('fluxo completo e isolamento entre organizações', async () => {
    const coord = await login('coord.a@exemplo.test', 'senha-coord');
    expect(coord.user).toMatchObject({ role: 'COORDINATION', organizationId: ORG_A });
    const auth = { authorization: `Bearer ${coord.accessToken}` };

    // Rotas de convite exigem login e perfil de coordenação.
    await api().get('/invitations').expect(401);

    // 1) Coordenação gera convite. Organização vem do contexto validado, não do corpo.
    const created = await api()
      .post('/invitations')
      .set(auth)
      .send({ email: 'Nova.Tecnica@Exemplo.test', role: 'TECHNICIAN', expiresInHours: 48 })
      .expect(201);
    expect(created.body).toMatchObject({ email: 'nova.tecnica@exemplo.test', role: 'TECHNICIAN' });
    expect(Object.keys(created.body).sort()).toEqual(['email', 'expiresAt', 'id', 'registrationUrl', 'role']);
    await api().post('/invitations').set(auth).send({ email: 'x@exemplo.test', role: 'TECHNICIAN', organizationId: ORG_B }).expect(400);
    const token = new URL(created.body.registrationUrl).hash.replace('#token=', '');

    const list = await api().get('/invitations').set(auth).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toMatch(/tokenHash|registrationUrl/);

    // Outra organização não vê nem revoga.
    const coordB = await login('coord.b@exemplo.test', 'senha-coord');
    const authB = { authorization: `Bearer ${coordB.accessToken}` };
    expect((await api().get('/invitations').set(authB).expect(200)).body.items).toEqual([]);
    await api().delete(`/invitations/${created.body.id}`).set(authB).expect(404);
    // Cabeçalho de organização sem membership é recusado.
    await api().get('/invitations').set(authB).set('X-Organization-Id', ORG_A).expect(403);

    // 2) Página pública valida o convite (token no corpo).
    const preview = await api().post('/auth/registration').send({ token }).expect(200);
    expect(preview.body).toMatchObject({ email: 'nova.tecnica@exemplo.test', organizationName: 'Secretaria A' });
    await api().post('/auth/registration').send({ token: 'x'.repeat(43) }).expect(404);
    await api().post('/auth/registration').send({}).expect(400);

    // Sem convite não há cadastro (nem URL direta, nem campos extras).
    await api().post('/auth/register').send({ name: 'Sem Convite', email: 'a@b.test', phone: '61999998888', password: 'senhaForte1' }).expect(400);
    await api()
      .post('/auth/register')
      .send({ token, name: 'Nova Técnica', email: 'nova.tecnica@exemplo.test', phone: '61999998888', password: 'senhaForte1', role: 'COORDINATION' })
      .expect(400);

    // 3) Cadastro. Sem sessão na resposta.
    const reg = await api()
      .post('/auth/register')
      .send({ token, name: 'Nova Técnica', email: 'nova.tecnica@exemplo.test', phone: '(61) 99999-8888', password: 'senhaForte1' })
      .expect(201);
    expect(reg.body).toEqual({ message: MSG.done });
    await api()
      .post('/auth/register')
      .send({ token, name: 'Nova Técnica', email: 'nova.tecnica@exemplo.test', phone: '61999998888', password: 'senhaForte1' })
      .expect(410);

    // 4) Login via Supabase (dublê) e acesso com perfil/organização do convite.
    await api().post('/auth/login').send({ email: 'nova.tecnica@exemplo.test', password: 'errada1234' }).expect(401);
    const tech = await login('nova.tecnica@exemplo.test', 'senhaForte1');
    expect(tech.user).toMatchObject({ role: 'TECHNICIAN', organizationId: ORG_A });
    const techAuth = { authorization: `Bearer ${tech.accessToken}` };
    const me = await api().get('/auth/me').set(techAuth).expect(200);
    expect(me.body).toMatchObject({ email: 'nova.tecnica@exemplo.test', role: 'TECHNICIAN', organizationId: ORG_A });
    const account = await api().get('/account').set(techAuth).expect(200);
    expect(account.body).toMatchObject({ role: 'TECHNICIAN', organizationId: ORG_A, phone: '61999998888' });

    // Técnico não gera convites.
    await api().post('/invitations').set(techAuth).send({ email: 'y@exemplo.test', role: 'COORDINATION' }).expect(403);
    await api().get('/invitations').set(techAuth).expect(403);
    // Outra organização: sem membership => 403, mesmo pedindo pelo cabeçalho.
    await api().get('/auth/me').set(techAuth).set('X-Organization-Id', ORG_B).expect(403);
    await api().get('/account').set(techAuth).set('X-Organization-Id', ORG_B).expect(403);

    // 5) Troca de senha da conta Supabase e novo login.
    await api().patch('/account/password').set(techAuth).send({ currentPassword: 'senhaForte1', newPassword: 'novaSenha22' }).expect(200);
    await api().post('/auth/login').send({ email: 'nova.tecnica@exemplo.test', password: 'senhaForte1' }).expect(401);
    await login('nova.tecnica@exemplo.test', 'novaSenha22');

    // Auditoria: cadastro registrado na organização do convite; nada de token/senha.
    expect(audit.entries.find((e) => e.action === 'USER_REGISTERED')).toMatchObject({ organizationId: ORG_A });
    expect(JSON.stringify(audit.entries)).not.toMatch(new RegExp(`${token}|senhaForte1|novaSenha22`));
  });

  it('cadastro fechado (flag desligada): 503 e nada é criado', async () => {
    const coord = await login('coord.a@exemplo.test', 'senha-coord');
    const created = await api()
      .post('/invitations')
      .set({ authorization: `Bearer ${coord.accessToken}` })
      .send({ email: 'fechado@exemplo.test', role: 'TECHNICIAN' })
      .expect(201);
    const token = new URL(created.body.registrationUrl).hash.replace('#token=', '');
    supabase.registrationEnabled = false;
    const before = db.users.length;
    const res = await api()
      .post('/auth/register')
      .send({ token, name: 'Pessoa Fechada', email: 'fechado@exemplo.test', phone: '61999998888', password: 'senhaForte1' })
      .expect(503);
    expect(res.body.message).toBe(MSG.closed);
    expect(db.users.length).toBe(before);
    supabase.registrationEnabled = true;
  });
});
