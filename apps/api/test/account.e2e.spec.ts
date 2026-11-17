import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetData, tokenFor } from './fixtures';

// PNG 1x1 válido em base64 para testar upload e leitura de foto de perfil.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Conta e perfil (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
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
