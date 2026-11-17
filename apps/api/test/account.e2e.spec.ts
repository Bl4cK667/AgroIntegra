import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { TestDatabase } from './test-database';
import { createTestApp, resetData, tokenFor } from './fixtures';

// PNG 1x1 válido em base64 para testar upload e leitura de foto de perfil.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Conta e perfil (e2e)', () => {
  let app: INestApplication;
  let prisma: TestDatabase;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
  });

  beforeEach(async () => {
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige autenticação nos endpoints de conta', async () => {
    await request(app.getHttpServer()).get('/account').expect(401);
    await request(app.getHttpServer()).patch('/account').send({ name: 'Teste' }).expect(401);
    await request(app.getHttpServer()).get('/account/avatar').expect(401);
    await request(app.getHttpServer()).put('/account/avatar').send({ image: TINY_PNG }).expect(401);
    await request(app.getHttpServer()).delete('/account/avatar').expect(401);
    await request(app.getHttpServer())
      .patch('/account/password')
      .send({ currentPassword: DEMO_PASSWORD, newPassword: 'nova-senha' })
      .expect(401);
  });

  it('retorna os dados da conta sem expor senha nem bytes do avatar', async () => {
    const token = await tokenFor(app, 'coordenacao@agrointegra.demo');
    const res = await request(app.getHttpServer())
      .get('/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      email: 'coordenacao@agrointegra.demo',
      role: 'COORDINATION',
      phone: null,
      jobTitle: null,
      hasAvatar: false,
    });
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.avatar).toBeUndefined();
  });

  it('atualiza dados pessoais, permite limpar telefone/cargo e registra auditoria', async () => {
    const token = await tokenFor(app, 'tecnico@agrointegra.demo');

    const updated = await request(app.getHttpServer())
      .patch('/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Carlos Extensionista', phone: '(31) 99999-1234', jobTitle: 'Engenheiro Agrônomo' })
      .expect(200);

    expect(updated.body).toMatchObject({
      name: 'Carlos Extensionista',
      phone: '(31) 99999-1234',
      jobTitle: 'Engenheiro Agrônomo',
    });

    const cleared = await request(app.getHttpServer())
      .patch('/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '', jobTitle: '   ' })
      .expect(200);

    expect(cleared.body.phone).toBeNull();
    expect(cleared.body.jobTitle).toBeNull();

    await request(app.getHttpServer())
      .patch('/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' })
      .expect(400);

    const log = await prisma.auditLog.findFirst({ where: { action: 'ACCOUNT_UPDATED' } });
    expect(log).not.toBeNull();
  });

  it('salva o estilo de navegação: Topbar por padrão e mantém a escolha entre sessões', async () => {
    const token = await tokenFor(app, 'tecnico@agrointegra.demo');
    const auth = { Authorization: `Bearer ${token}` };

    const me = await request(app.getHttpServer()).get('/auth/me').set(auth).expect(200);
    expect(me.body.navStyle).toBe('topbar');

    const updated = await request(app.getHttpServer()).patch('/account').set(auth).send({ navStyle: 'sidebar' }).expect(200);
    expect(updated.body.navStyle).toBe('sidebar');

    await request(app.getHttpServer()).patch('/account').set(auth).send({ navStyle: 'flutuante' }).expect(400);

    // Novo login (sair e entrar de novo) devolve a preferência salva.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'tecnico@agrointegra.demo', password: DEMO_PASSWORD })
      .expect(200);
    expect(login.body.user.navStyle).toBe('sidebar');
    const again = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(again.body.navStyle).toBe('sidebar');

    // Preferência é por usuário: a coordenação continua na Topbar.
    const other = await tokenFor(app, 'coordenacao@agrointegra.demo');
    const otherMe = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${other}`).expect(200);
    expect(otherMe.body.navStyle).toBe('topbar');
  });

  it('salva o tema na conta: sem escolha começa nulo e a escolha vale em novo login e outro dispositivo', async () => {
    const token = await tokenFor(app, 'tecnico@agrointegra.demo');
    const auth = { Authorization: `Bearer ${token}` };

    const me = await request(app.getHttpServer()).get('/auth/me').set(auth).expect(200);
    expect(me.body.theme).toBeNull();

    const updated = await request(app.getHttpServer()).patch('/account').set(auth).send({ theme: 'ocean-blue' }).expect(200);
    expect(updated.body.theme).toBe('ocean-blue');

    await request(app.getHttpServer()).patch('/account').set(auth).send({ theme: 'neon-pink' }).expect(400);
    await request(app.getHttpServer()).patch('/account').set(auth).send({ theme: 'light' }).expect(400);

    // Outro dispositivo = novo login: a preferência vem da conta.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'tecnico@agrointegra.demo', password: DEMO_PASSWORD })
      .expect(200);
    expect(login.body.user.theme).toBe('ocean-blue');
    const again = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(again.body.theme).toBe('ocean-blue');

    // Trocar o tema não mexe na navegação, e vice-versa.
    expect(again.body.navStyle).toBe('topbar');
    const nav = await request(app.getHttpServer()).patch('/account').set(auth).send({ navStyle: 'sidebar' }).expect(200);
    expect(nav.body.theme).toBe('ocean-blue');

    const other = await tokenFor(app, 'coordenacao@agrointegra.demo');
    const otherMe = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${other}`).expect(200);
    expect(otherMe.body.theme).toBeNull();
  });

  it('envia, exibe e remove a foto de perfil validando o tipo do arquivo', async () => {
    const token = await tokenFor(app, 'coordenacao@agrointegra.demo');

    await request(app.getHttpServer())
      .get('/account/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await request(app.getHttpServer())
      .put('/account/avatar')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:text/plain;base64,SGVsbG8=' })
      .expect(400);

    const uploaded = await request(app.getHttpServer())
      .put('/account/avatar')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: TINY_PNG })
      .expect(200);

    expect(uploaded.body.hasAvatar).toBe(true);
    expect(uploaded.body.avatarUpdatedAt).toBeTruthy();

    const fetched = await request(app.getHttpServer())
      .get('/account/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fetched.headers['content-type']).toContain('image/png');
    expect(Buffer.isBuffer(fetched.body) && fetched.body.length).toBeGreaterThan(0);

    const removed = await request(app.getHttpServer())
      .delete('/account/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(removed.body.hasAvatar).toBe(false);

    await request(app.getHttpServer())
      .get('/account/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('altera a senha conferindo a senha atual e permite entrar com a nova', async () => {
    const token = await tokenFor(app, 'tecnico@agrointegra.demo');

    await request(app.getHttpServer())
      .patch('/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'errada', newPassword: 'nova-senha-123' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEMO_PASSWORD, newPassword: '123' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEMO_PASSWORD, newPassword: 'nova-senha-123' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'tecnico@agrointegra.demo', password: DEMO_PASSWORD })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'tecnico@agrointegra.demo', password: 'nova-senha-123' })
      .expect(200);
  });
});
