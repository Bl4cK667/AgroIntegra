import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { TestDatabase } from './test-database';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { resetData } from './fixtures';

describe('Login por perfil e auditoria', () => {
  let app: INestApplication;
  let prisma: TestDatabase;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], providers: [TestDatabase] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(TestDatabase);
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (email: string, password = DEMO_PASSWORD) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  it('admin local entra com a senha admin e perfil COORDINATION', async () => {
    const res = await login('admin@agrointegra.demo', 'admin').expect(200);
    expect(res.body.user).toMatchObject({ email: 'admin@agrointegra.demo', role: 'COORDINATION' });
  });

  it('coordenação entra e recebe o perfil COORDINATION', async () => {
    const res = await login('coordenacao@agrointegra.demo').expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: 'coordenacao@agrointegra.demo', role: 'COORDINATION' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('técnico entra e recebe o perfil TECHNICIAN', async () => {
    const res = await login('tecnico@agrointegra.demo').expect(200);
    expect(res.body.user.role).toBe('TECHNICIAN');
  });

  it('senha errada é recusada com mensagem genérica', async () => {
    const res = await login('tecnico@agrointegra.demo', 'errada').expect(401);
    expect(res.body.message).toBe('E-mail ou senha inválidos.');
  });

  it('e-mail inexistente é recusado com a mesma mensagem', async () => {
    const res = await login('ninguem@agrointegra.demo').expect(401);
    expect(res.body.message).toBe('E-mail ou senha inválidos.');
  });

  it('dados inválidos no login retornam 400', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'x' }).expect(400);
  });

  it('/auth/me exige token e devolve o usuário logado', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    const { body } = await login('tecnico@agrointegra.demo');
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ email: 'tecnico@agrointegra.demo', role: 'TECHNICIAN' });
  });

  it('token adulterado é recusado', async () => {
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
  });

  it('somente a coordenação vê a auditoria', async () => {
    const tech = await login('tecnico@agrointegra.demo');
    await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${tech.body.accessToken}`)
      .expect(403);

    const coord = await login('coordenacao@agrointegra.demo');
    const res = await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${coord.body.accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('cada login (certo ou errado) fica registrado na auditoria', async () => {
    await prisma.auditLog.deleteMany();
    await login('tecnico@agrointegra.demo').expect(200);
    await login('tecnico@agrointegra.demo', 'errada').expect(401);

    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['LOGIN', 'LOGIN_FAILED']);
    const tecnico = await prisma.user.findUniqueOrThrow({ where: { email: 'tecnico@agrointegra.demo' } });
    expect(logs[0]).toMatchObject({ userId: tecnico.id, entity: 'User', entityId: tecnico.id });
    expect(JSON.stringify(logs[1].details)).not.toContain('errada');
  });

  it('usuário desativado não entra', async () => {
    await prisma.user.update({ where: { email: 'tecnico@agrointegra.demo' }, data: { active: false } });
    await login('tecnico@agrointegra.demo').expect(401);
    await prisma.user.update({ where: { email: 'tecnico@agrointegra.demo' }, data: { active: true } });
  });
});
