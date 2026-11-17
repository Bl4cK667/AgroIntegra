import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEMO_PRODUCER, seedDemo } from '../prisma/seed-demo';
import { isValidCpf } from '../src/common/cpf';
import { TestDatabase } from './test-database';
import { countFromDatabase } from './dashboard-count';
import { createTestApp, resetData, tokenFor } from './fixtures';

const dayOf = (d: Date) => d.toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Fase 6: a carga da demonstração precisa ser coerente, porque é o que a secretaria vai ver.
describe('Dados da demonstração', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
  });

  afterAll(async () => {
    await resetData(prisma);
    await app.close();
  });

  async function checkConsistency(now: Date) {
    const today = localDay(now);
    const [producers, properties, visits, requests, programs, enrollments, deliveries] = await Promise.all([
      prisma.producer.findMany(),
      prisma.property.findMany(),
      prisma.visit.findMany({ include: { request: true } }),
      prisma.serviceRequest.findMany(),
      prisma.program.findMany(),
      prisma.enrollment.findMany(),
      prisma.delivery.findMany(),
    ]);

    // Produtores: CPF válido e único; telefone fictício (DDD 00).
    expect(producers.length).toBeGreaterThan(100);
    expect(producers.every((p) => isValidCpf(p.cpf))).toBe(true);
    expect(new Set(producers.map((p) => p.cpf)).size).toBe(producers.length);
    expect(producers.every((p) => p.phone === null || p.phone.startsWith('(00)'))).toBe(true);
    expect(producers.every((p) => p.createdAt <= now)).toBe(true);
    expect(producers.every((p) => p.consentAt === null || p.consentAt >= p.createdAt)).toBe(true);

    // Propriedades e visitas pertencem ao produtor certo; nada no futuro.
    const ownerOf = new Map(properties.map((p) => [p.id, p.producerId]));
    expect(producers.every((p) => properties.some((x) => x.producerId === p.id))).toBe(true);
    for (const v of visits) {
      expect(dayOf(v.visitedOn) <= today).toBe(true);
      expect(v.createdAt <= now).toBe(true);
      if (v.propertyId) expect(ownerOf.get(v.propertyId)).toBe(v.producerId);
      if (v.returnOn) expect(v.returnOn > v.visitedOn).toBe(true);
      if (v.request) {
        expect(v.request.producerId).toBe(v.producerId);
        expect(v.request.status).toBe('DONE');
      }
    }

    // Solicitações: regras do quadro.
    for (const r of requests) {
      expect(r.createdAt <= now).toBe(true);
      if (r.propertyId) expect(ownerOf.get(r.propertyId)).toBe(r.producerId);
      if (r.status === 'DONE') {
        expect(r.completedAt).not.toBeNull();
        expect(r.completedAt! >= r.createdAt).toBe(true);
        expect(r.completedAt! <= now).toBe(true);
      } else {
        expect(r.completedAt).toBeNull();
      }
      if (r.status === 'NEW' || r.status === 'IN_REVIEW') expect(r.scheduledFor).toBeNull();
      if (r.status === 'SCHEDULED') expect(dayOf(r.scheduledFor!) > today).toBe(true);
    }
    const doneWithVisit = new Set(visits.filter((v) => v.requestId).map((v) => v.requestId));
    expect(requests.filter((r) => r.status === 'DONE').every((r) => doneWithVisit.has(r.id))).toBe(true);

    // Programas: aprovados cabem nas vagas; entregas só para aprovados, dentro da vigência,
    // sem passar da meta nem do orçamento.
    for (const p of programs) {
      const own = enrollments.filter((e) => e.programId === p.id);
      const approved = new Set(own.filter((e) => e.status === 'APPROVED').map((e) => e.producerId));
      expect(approved.size).toBeLessThanOrEqual(p.slots);
      expect(own.every((e) => dayOf(e.enrolledOn) <= today)).toBe(true);
      const dels = deliveries.filter((d) => d.programId === p.id);
      for (const d of dels) {
        expect(approved.has(d.producerId)).toBe(true);
        expect(d.deliveredOn >= p.startsOn && d.deliveredOn <= p.endsOn).toBe(true);
        expect(dayOf(d.deliveredOn) <= today).toBe(true);
        expect(d.quantity).toBeGreaterThan(0);
      }
      expect(dels.reduce((s, d) => s + d.quantity, 0)).toBeLessThanOrEqual(p.goalQuantity);
      expect(dels.reduce((s, d) => s + d.valueCents, 0)).toBeLessThanOrEqual(p.budgetCents);
    }

    return { producers, requests, visits };
  }

  it('gera dados coerentes, com visitas no mês atual e a produtora do roteiro pronta', async () => {
    const now = new Date();
    await seedDemo(prisma, now);
    const { producers, requests } = await checkConsistency(now);

    const counts = await countFromDatabase(prisma);
    expect(counts.visitsByMonth[now.getMonth()]).toBeGreaterThan(0);
    expect(counts.openByStatus.NEW).toBeGreaterThan(0);
    expect(counts.openByStatus.IN_REVIEW).toBeGreaterThan(0);
    expect(counts.openByStatus.SCHEDULED).toBeGreaterThan(0);
    expect(counts.producersServed).toBeLessThan(counts.producersTotal);

    // A produtora do roteiro existe, tem consentimento e uma solicitação urgente na coluna Nova.
    const maria = producers.find((p) => p.name === DEMO_PRODUCER.name)!;
    expect(maria).toBeDefined();
    expect(maria.consentAt).not.toBeNull();
    const urgent = requests.find((r) => r.producerId === maria.id && r.subject === DEMO_PRODUCER.requestSubject)!;
    expect(urgent.status).toBe('NEW');
    expect(urgent.priority).toBe('HIGH');

    // O painel da API mostra os mesmos números da contagem independente.
    const token = await tokenFor(app, 'coordenacao@agrointegra.demo');
    const dash = await api().get('/dashboard').set('Authorization', `Bearer ${token}`).expect(200);
    expect(dash.body).toMatchObject(counts);

    // A busca encontra a produtora sem acento.
    const found = await api()
      .get('/producers')
      .query({ q: 'maria gracas' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(found.body.items.map((p: { name: string }) => p.name)).toContain(DEMO_PRODUCER.name);
  }, 60_000);

  it('é reproduzível: a mesma data gera os mesmos dados', async () => {
    const now = new Date(2026, 6, 15, 10, 0);
    const snapshot = async () => {
      await seedDemo(prisma, now);
      const [producers, visits] = await Promise.all([
        prisma.producer.findMany({ orderBy: { id: 'asc' }, select: { name: true, cpf: true, community: true } }),
        prisma.visit.findMany({ orderBy: { id: 'asc' }, select: { producerId: true, visitedOn: true, diagnosis: true } }),
      ]);
      return { producers, visits };
    };
    expect(await snapshot()).toEqual(await snapshot());
  }, 60_000);

  it('continua coerente quando a carga é feita no começo do ano', async () => {
    const now = new Date(2027, 0, 5, 9, 30);
    await seedDemo(prisma, now);
    const { visits } = await checkConsistency(now);
    expect(visits.some((v) => dayOf(v.visitedOn).startsWith('2027-01'))).toBe(true);
  }, 60_000);
});
