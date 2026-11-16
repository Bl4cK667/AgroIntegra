import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('Solicitações', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tech: string;
  let producerId: string;
  let propertyId: string;
  let otherProducerId: string;

  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${tech}` });
  const newRequest = (extra: Record<string, unknown> = {}) =>
    api()
      .post('/requests')
      .set(auth())
      .send({ producerId, subject: 'Orientação sobre silagem', priority: 'MEDIUM', ...extra });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetData(prisma);
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');
    const p = await api()
      .post('/producers')
      .set(auth())
      .send({ name: 'Joana Bezerra Lima', cpf: makeCpf(700), community: 'Lagoa Seca', consent: true });
    producerId = p.body.id;
    const prop = await api()
      .post(`/producers/${producerId}/properties`)
      .set(auth())
      .send({ name: 'Sítio Lagoa Seca', areaHa: 8, locality: 'Lagoa Seca' });
    propertyId = prop.body.id;
    const o = await api()
      .post('/producers')
      .set(auth())
      .send({ name: 'Outro Produtor', cpf: makeCpf(701), community: 'Baixio' });
    otherProducerId = o.body.id;
  });

  afterAll(() => app.close());

  it('exige login', async () => {
    await api().get('/requests').expect(401);
    await api().post('/requests').send({}).expect(401);
  });

  it('cria como Nova, com quem cadastrou, e registra na auditoria', async () => {
    const res = await newRequest({ propertyId, description: 'Quer começar a fazer silagem de milho.', priority: 'HIGH' }).expect(201);
    expect(res.body).toMatchObject({
      status: 'NEW',
      priority: 'HIGH',
      producer: { id: producerId, name: 'Joana Bezerra Lima', community: 'Lagoa Seca' },
      property: { id: propertyId, name: 'Sítio Lagoa Seca' },
      createdBy: { name: 'Rafael Lins Moreira' },
      completedAt: null,
      scheduledFor: null,
    });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'REQUEST_CREATED', entityId: res.body.id } });
    expect(log.details).toMatchObject({ producerId, priority: 'HIGH' });
  });

  it('valida assunto, prioridade e propriedade', async () => {
    await newRequest({ subject: '   ' }).expect(400);
    await newRequest({ priority: 'URGENTE' }).expect(400);
    const other = await api()
      .post(`/producers/${otherProducerId}/properties`)
      .set(auth())
      .send({ name: 'Sítio Alheio', areaHa: 2, locality: 'Baixio' });
    await newRequest({ propertyId: other.body.id }).expect(400);
  });

  it('lista com a prioridade alta primeiro', async () => {
    await newRequest({ subject: 'Baixa', priority: 'LOW' }).expect(201);
    await newRequest({ subject: 'Média', priority: 'MEDIUM' }).expect(201);
    const res = await api().get('/requests').set(auth()).expect(200);
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    const ranks = res.body.items.map((r: { priority: keyof typeof order }) => order[r.priority]);
    expect(ranks).toEqual([...ranks].sort());
  });

  describe('troca de coluna', () => {
    let id: string;

    beforeAll(async () => {
      id = (await newRequest({ subject: 'Para mover' })).body.id;
    });

    it('agenda com data e registra a troca na auditoria', async () => {
      await api().patch(`/requests/${id}/status`).set(auth()).send({ status: 'IN_REVIEW' }).expect(200);
      const res = await api()
        .patch(`/requests/${id}/status`)
        .set(auth())
        .send({ status: 'SCHEDULED', scheduledFor: isoDay(5) })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'SCHEDULED', scheduledFor: isoDay(5) });
      const logs = await prisma.auditLog.findMany({ where: { action: 'REQUEST_MOVED', entityId: id }, orderBy: { createdAt: 'asc' } });
      expect(logs.map((l) => l.details)).toEqual([
        expect.objectContaining({ from: 'NEW', to: 'IN_REVIEW' }),
        expect.objectContaining({ from: 'IN_REVIEW', to: 'SCHEDULED', scheduledFor: isoDay(5) }),
      ]);
    });

    it('concluir marca a data; reabrir limpa', async () => {
      const done = await api().patch(`/requests/${id}/status`).set(auth()).send({ status: 'DONE' }).expect(200);
      expect(done.body.completedAt).not.toBeNull();
      const back = await api().patch(`/requests/${id}/status`).set(auth()).send({ status: 'NEW' }).expect(200);
      expect(back.body).toMatchObject({ status: 'NEW', completedAt: null, scheduledFor: null });
    });

    it('recusa situação inválida e data fora do agendamento', async () => {
      await api().patch(`/requests/${id}/status`).set(auth()).send({ status: 'ARQUIVADA' }).expect(400);
      await api().patch(`/requests/${id}/status`).set(auth()).send({ status: 'IN_REVIEW', scheduledFor: isoDay(2) }).expect(400);
      await api().patch(`/requests/${id}/status`).set(auth()).send({ status: 'SCHEDULED', scheduledFor: '2026-02-30' }).expect(400);
    });

    it('troca a prioridade com auditoria', async () => {
      const res = await api().patch(`/requests/${id}/priority`).set(auth()).send({ priority: 'HIGH' }).expect(200);
      expect(res.body.priority).toBe('HIGH');
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'REQUEST_PRIORITY', entityId: id } });
      expect(log.details).toMatchObject({ from: 'MEDIUM', to: 'HIGH' });
    });
  });

  describe('visita que atende a solicitação', () => {
    const visit = (requestId: string, extra: Record<string, unknown> = {}) =>
      api()
        .post('/visits')
        .set(auth())
        .send({ producerId, requestId, visitedOn: isoDay(0), diagnosis: 'Milho no ponto.', actionPlan: 'Ensilar.', ...extra });

    it('salvar a visita conclui a solicitação', async () => {
      const r = (await newRequest({ subject: 'Silagem' })).body;
      const v = await visit(r.id).expect(201);
      expect(v.body.request).toEqual({ id: r.id, subject: 'Silagem' });
      const after = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: r.id } });
      expect(after.status).toBe('DONE');
      expect(after.completedAt).not.toBeNull();
      const list = await api().get(`/requests?producerId=${producerId}`).set(auth()).expect(200);
      expect(list.body.items.find((x: { id: string }) => x.id === r.id).visitCount).toBe(1);
    });

    it('recusa solicitação de outro produtor ou já concluída', async () => {
      const other = await api()
        .post('/requests')
        .set(auth())
        .send({ producerId: otherProducerId, subject: 'Dele', priority: 'LOW' });
      await visit(other.body.id).expect(400);

      const r = (await newRequest({ subject: 'Já feita' })).body;
      await api().patch(`/requests/${r.id}/status`).set(auth()).send({ status: 'DONE' }).expect(200);
      await visit(r.id).expect(400);
    });

    it('se a visita for recusada, a solicitação continua aberta', async () => {
      const r = (await newRequest({ subject: 'Continua aberta' })).body;
      await visit(r.id, { diagnosis: '' }).expect(400);
      await visit(r.id, { photos: ['data:image/png;base64,bm9wZQ=='] }).expect(400);
      const after = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: r.id } });
      expect(after.status).toBe('NEW');
    });

    it('filtro de abertas deixa de fora as concluídas', async () => {
      const res = await api().get(`/requests?producerId=${producerId}&open=true`).set(auth()).expect(200);
      expect(res.body.items.every((r: { status: string }) => r.status !== 'DONE')).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });
  });
});
