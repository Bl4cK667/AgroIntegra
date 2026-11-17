import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabase } from './test-database';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('Notificações', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let tech: string;
  let coord: string;
  let admin: string;
  let producerId: string;

  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const inbox = (token: string) => api().get('/notifications').set(as(token));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    await resetData(prisma);
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');
    coord = await tokenFor(app, 'coordenacao@agrointegra.demo');
    const res = await api().post('/auth/login').send({ email: 'admin@agrointegra.demo', password: 'admin' });
    admin = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
  });

  it('exige login', async () => {
    await api().get('/notifications').expect(401);
  });

  it('novo produtor avisa a coordenação, não quem cadastrou', async () => {
    const p = await api()
      .post('/producers')
      .set(as(tech))
      .send({ name: 'Rita Moura Leal', cpf: makeCpf(900), community: 'Serra do Cedro', consent: true })
      .expect(201);
    producerId = p.body.id;

    const c = await inbox(coord).expect(200);
    expect(c.body.unread).toBe(1);
    expect(c.body.items[0]).toMatchObject({ type: 'PRODUCER_CREATED', href: `/produtores/${producerId}`, readAt: null });
    expect(c.body.items[0].body).toContain('Rita Moura Leal');
    expect(c.body.items[0].userId).toBeUndefined();

    const t = await inbox(tech).expect(200);
    expect(t.body.unread).toBe(0);
  });

  it('pedido urgente avisa toda a equipe menos o autor; agendar e concluir avisam o autor', async () => {
    const r = await api()
      .post('/requests')
      .set(as(tech))
      .send({ producerId, subject: 'Lagarta no milho', priority: 'HIGH' })
      .expect(201);

    for (const token of [coord, admin]) {
      const res = await inbox(token).expect(200);
      expect(res.body.items[0]).toMatchObject({ type: 'REQUEST_URGENT', title: 'Pedido urgente chegou' });
    }
    expect((await inbox(tech)).body.unread).toBe(0);

    await api()
      .patch(`/requests/${r.body.id}/status`)
      .set(as(coord))
      .send({ status: 'SCHEDULED', scheduledFor: isoDay(3) })
      .expect(200);
    const afterSchedule = await inbox(tech).expect(200);
    expect(afterSchedule.body.items[0]).toMatchObject({ type: 'REQUEST_SCHEDULED', title: 'Visita agendada' });

    // Visita que atende o pedido: avisa o autor do pedido e a coordenação.
    const v = await api()
      .post('/visits')
      .set(as(coord))
      .send({ producerId, requestId: r.body.id, visitedOn: isoDay(0), diagnosis: 'Infestação inicial.', actionPlan: 'Controle biológico.' })
      .expect(201);
    const t = await inbox(tech).expect(200);
    expect(t.body.items[0]).toMatchObject({ type: 'REQUEST_DONE', href: `/visitas/${v.body.id}` });
    // Quem registrou a visita não recebe aviso da própria ação.
    expect((await inbox(coord)).body.items.find((n: { type: string }) => n.type === 'VISIT_CREATED')).toBeUndefined();
    expect((await inbox(admin)).body.items[0]).toMatchObject({ type: 'VISIT_CREATED' });
  });

  it('subir a prioridade para alta avisa a equipe; mudar para outra não', async () => {
    const r = await api().post('/requests').set(as(coord)).send({ producerId, subject: 'Poda', priority: 'LOW' }).expect(201);
    await prisma.notification.deleteMany();
    await api().patch(`/requests/${r.body.id}/priority`).set(as(coord)).send({ priority: 'MEDIUM' }).expect(200);
    expect((await inbox(tech)).body.unread).toBe(0);
    await api().patch(`/requests/${r.body.id}/priority`).set(as(coord)).send({ priority: 'HIGH' }).expect(200);
    expect((await inbox(tech)).body.items[0]).toMatchObject({ type: 'REQUEST_URGENT' });
  });

  it('marca como lida, conta as não lidas e marca todas', async () => {
    await api().post('/requests').set(as(tech)).send({ producerId, subject: 'Pedido A', priority: 'MEDIUM' });
    await api().post('/requests').set(as(tech)).send({ producerId, subject: 'Pedido B', priority: 'MEDIUM' });

    const list = await inbox(coord).expect(200);
    expect(list.body.unread).toBe(2);
    const read = await api().patch(`/notifications/${list.body.items[0].id}/read`).set(as(coord)).expect(200);
    expect(read.body.unread).toBe(1);
    expect((await api().get('/notifications/unread-count').set(as(coord))).body.unread).toBe(1);
    expect((await api().get('/notifications?unread=true').set(as(coord))).body.items).toHaveLength(1);

    await api().patch('/notifications/read-all').set(as(coord)).expect(200);
    const after = await inbox(coord);
    expect(after.body.unread).toBe(0);
    // Lidas continuam no histórico.
    expect(after.body.items).toHaveLength(2);
    expect(after.body.items.every((n: { readAt: string | null }) => n.readAt)).toBe(true);
  });

  it('não deixa ler ou marcar notificação de outra pessoa', async () => {
    await api().post('/requests').set(as(tech)).send({ producerId, subject: 'Pedido C', priority: 'MEDIUM' });
    const mine = (await inbox(coord)).body.items[0];
    await api().patch(`/notifications/${mine.id}/read`).set(as(tech)).expect(404);
    expect((await inbox(coord)).body.unread).toBe(1);
  });

  it('pagina o histórico com before', async () => {
    const coordUser = await prisma.user.findUniqueOrThrow({ where: { email: 'coordenacao@agrointegra.demo' } });
    const base = Date.now();
    await prisma.notification.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: coordUser.id,
        type: 'TEST',
        title: `Aviso ${i}`,
        body: 'Teste de paginação',
        createdAt: new Date(base - i * 60_000),
      })),
    });
    const first = await inbox(coord).expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.hasMore).toBe(true);
    const last = first.body.items[19].createdAt;
    const second = await api().get(`/notifications?before=${encodeURIComponent(last)}`).set(as(coord)).expect(200);
    expect(second.body.items).toHaveLength(5);
    expect(second.body.hasMore).toBe(false);
  });
});
