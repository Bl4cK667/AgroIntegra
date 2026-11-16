import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Regra da fase 4: todo número do painel confere com uma contagem feita direto no banco.
// As contagens de referência abaixo leem as linhas cruas e filtram em JavaScript,
// por um caminho diferente do usado pela API.
async function countFromDatabase(prisma: PrismaService) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const [requests, visits, producers] = await Promise.all([
    prisma.serviceRequest.findMany(),
    prisma.visit.findMany({ include: { producer: true } }),
    prisma.producer.findMany(),
  ]);
  const visitYear = (v: { visitedOn: Date }) => Number(v.visitedOn.toISOString().slice(0, 4));
  const visitMonth = (v: { visitedOn: Date }) => Number(v.visitedOn.toISOString().slice(5, 7));
  const thisYear = visits.filter((v) => visitYear(v) === year);
  const open = requests.filter((r) => r.status !== 'DONE');

  const communities = new Map<string, { visits: number; producers: Set<string> }>();
  for (const v of thisYear) {
    const c = communities.get(v.producer.community) ?? { visits: 0, producers: new Set() };
    c.visits++;
    c.producers.add(v.producerId);
    communities.set(v.producer.community, c);
  }

  return {
    openRequests: open.length,
    openByStatus: {
      NEW: open.filter((r) => r.status === 'NEW').length,
      IN_REVIEW: open.filter((r) => r.status === 'IN_REVIEW').length,
      SCHEDULED: open.filter((r) => r.status === 'SCHEDULED').length,
    },
    highPriorityOpen: open.filter((r) => r.priority === 'HIGH').length,
    completedThisMonth: requests.filter(
      (r) => r.status === 'DONE' && r.completedAt && r.completedAt.getFullYear() === year && r.completedAt.getMonth() === month,
    ).length,
    visitsThisYear: thisYear.length,
    producersServed: new Set(thisYear.map((v) => v.producerId)).size,
    producersTotal: producers.length,
    visitsByMonth: Array.from({ length: 12 }, (_, i) => thisYear.filter((v) => visitMonth(v) === i + 1).length),
    visitsByCommunity: [...communities.entries()]
      .map(([community, c]) => ({ community, visits: c.visits, producers: c.producers.size }))
      .sort((a, b) => b.visits - a.visits || a.community.localeCompare(b.community)),
  };
}

describe('Painel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    prisma = app.get(PrismaService);
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
