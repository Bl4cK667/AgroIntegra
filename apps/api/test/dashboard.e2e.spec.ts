import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabase } from './test-database';
import { countFromDatabase, localDay } from './dashboard-count';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';

describe('Painel', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let token: string;
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const now = new Date();
  const today = localDay(now);
  const firstOfYear = `${now.getFullYear()}-01-01`;
  const lastYear = `${now.getFullYear() - 1}-12-31`;

  async function producer(name: string, seed: number, community: string) {
    const r = await api().post('/producers').set(auth()).send({ name, cpf: makeCpf(seed), community, consent: true });
    return r.body.id as string;
  }
  async function visit(producerId: string, visitedOn: string, requestId?: string) {
    await api()
      .post('/visits')
      .set(auth())
      .send({ producerId, visitedOn, requestId, diagnosis: 'Diagnóstico.', actionPlan: 'Plano.' })
      .expect(201);
  }
  async function req(producerId: string, priority: string, status?: string) {
    const r = await api().post('/requests').set(auth()).send({ producerId, subject: 'Assunto', priority }).expect(201);
    if (status) await api().patch(`/requests/${r.body.id}/status`).set(auth()).send({ status }).expect(200);
    return r.body.id as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    await resetData(prisma);
    token = await tokenFor(app, 'coordenacao@agrointegra.demo');
  });

  afterAll(() => app.close());

  it('exige login', async () => {
    await api().get('/dashboard').expect(401);
  });

  it('com o banco vazio, tudo é zero', async () => {
    const res = await api().get('/dashboard').set(auth()).expect(200);
    expect(res.body).toMatchObject({
      openRequests: 0,
      completedThisMonth: 0,
      visitsThisYear: 0,
      producersServed: 0,
      producersTotal: 0,
      visitsByMonth: Array(12).fill(0),
      visitsByCommunity: [],
    });
  });

  describe('com atendimentos registrados', () => {
    let body: Record<string, unknown> & { visitsByMonth: number[]; visitsByCommunity: { visits: number }[] };

    beforeAll(async () => {
      const ana = await producer('Ana Tavares Rocha', 801, 'Riacho Verde');
      const bento = await producer('Bento Ferraz Silva', 802, 'Riacho Verde');
      const clara = await producer('Clara Mendes Paiva', 803, 'Baixio');
      await producer('Davi Quintela Porto', 804, 'Baixio'); // cadastrado, sem visita

      // Visitas: 4 neste ano (uma em 1º de janeiro) e 1 no ano passado, que não conta.
      await visit(ana, today);
      await visit(ana, firstOfYear);
      await visit(bento, today);
      await visit(clara, lastYear);

      // Solicitações: 3 abertas (1 alta), 1 concluída agora, 1 concluída por visita e 1 concluída no mês passado.
      await req(ana, 'HIGH');
      await req(bento, 'MEDIUM', 'IN_REVIEW');
      await req(clara, 'LOW', 'SCHEDULED');
      await req(bento, 'HIGH', 'DONE');
      const byVisit = await req(clara, 'MEDIUM');
      await visit(clara, today, byVisit);
      const old = await req(ana, 'LOW', 'DONE');
      await prisma.serviceRequest.update({
        where: { id: old },
        data: { completedAt: new Date(now.getFullYear(), now.getMonth() - 1, 15, 10) },
      });

      body = (await api().get('/dashboard').set(auth()).expect(200)).body;
    });

    it('cada número bate com a contagem feita direto no banco', async () => {
      const expected = await countFromDatabase(prisma);
      expect(body).toMatchObject(expected);
    });

    it('confere os valores esperados do cenário', () => {
      expect(body).toMatchObject({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        openRequests: 3,
        openByStatus: { NEW: 1, IN_REVIEW: 1, SCHEDULED: 1 },
        highPriorityOpen: 1,
        completedThisMonth: 2,
        visitsThisYear: 4,
        producersServed: 3,
        producersTotal: 4,
      });
      expect(body.visitsByCommunity).toEqual([
        { community: 'Riacho Verde', visits: 3, producers: 2 },
        { community: 'Baixio', visits: 1, producers: 1 },
      ]);
    });

    it('a soma dos meses é igual às visitas do ano (erro do protótipo: 312 x 488)', () => {
      expect(body.visitsByMonth.reduce((a, b) => a + b, 0)).toBe(body.visitsThisYear);
    });

    it('a soma das comunidades é igual às visitas do ano', () => {
      expect(body.visitsByCommunity.reduce((a, c) => a + c.visits, 0)).toBe(body.visitsThisYear);
    });

    it('o painel acompanha o banco: nova visita muda os números na hora', async () => {
      const davi = await prisma.producer.findFirstOrThrow({ where: { name: 'Davi Quintela Porto' } });
      await visit(davi.id, today);
      const after = (await api().get('/dashboard').set(auth()).expect(200)).body;
      expect(after.visitsThisYear).toBe(5);
      expect(after.producersServed).toBe(4);
      expect(after).toMatchObject(await countFromDatabase(prisma));
    });
  });
});
