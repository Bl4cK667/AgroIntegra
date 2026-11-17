import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabase } from './test-database';
import { day, money } from '../src/reports/report.pdf';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';
import { pdfText, squash } from './pdf-text';

// Recebe a resposta binária do PDF como Buffer.
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('Relatório do produtor (tela e PDF)', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let token: string;
  let producerId: string;
  const cpf = makeCpf(321);
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const period = { from: '2026-03-01', to: '2026-06-30' };
  const qs = `from=${period.from}&to=${period.to}`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    await resetData(prisma);
    token = await tokenFor(app, 'tecnico@agrointegra.demo');

    const p = await api()
      .post('/producers')
      .set(auth())
      .send({ name: 'Rosângela Araújo Pinheiro', cpf, community: 'Açude Novo', phone: '(00) 98888-0000', consent: true });
    producerId = p.body.id;
    await api()
      .post(`/producers/${producerId}/properties`)
      .set(auth())
      .send({ name: 'Sítio Três Irmãs', areaHa: 14.5, locality: 'Açude Novo', mainActivity: 'Caprinocultura' });

    const visit = (visitedOn: string, diagnosis: string) =>
      api()
        .post('/visits')
        .set(auth())
        .send({ producerId, visitedOn, diagnosis, actionPlan: 'Vermifugação do rebanho e troca da cerca.', returnOn: '2026-07-15' })
        .expect(201);
    await visit('2026-03-12', 'Verminose no rebanho de cabras.');
    await visit('2026-06-30', 'Cerca do aprisco danificada.'); // último dia do período: entra
    await visit('2026-07-01', 'Fora do período.'); // não entra

    const program = await prisma.program.create({
      data: {
        name: 'Palma forrageira',
        description: 'Raquetes de palma para reserva de forragem.',
        slots: 50,
        goalQuantity: 5000,
        unit: 'raquetes',
        budgetCents: 5_000_000,
        startsOn: new Date('2026-02-01'),
        endsOn: new Date('2026-11-30'),
      },
    });
    await prisma.enrollment.create({
      data: { programId: program.id, producerId, status: 'APPROVED', enrolledOn: new Date('2026-02-10') },
    });
    await prisma.delivery.createMany({
      data: [
        { programId: program.id, producerId, deliveredOn: new Date('2026-04-20'), quantity: 300, valueCents: 123_456 },
        { programId: program.id, producerId, deliveredOn: new Date('2026-08-05'), quantity: 200, valueCents: 99_000 },
      ],
    });
  });

  afterAll(() => app.close());

  it('exige login', async () => {
    await api().get(`/reports/producer/${producerId}?${qs}`).expect(401);
    await api().get(`/reports/producer/${producerId}/pdf?${qs}`).expect(401);
  });

  it('valida o período', async () => {
    await api().get(`/reports/producer/${producerId}`).set(auth()).expect(400);
    await api().get(`/reports/producer/${producerId}?from=2026-06-30&to=2026-03-01`).set(auth()).expect(400);
    await api().get(`/reports/producer/${producerId}?from=2026-02-30&to=2026-03-01`).set(auth()).expect(400);
  });

  it('a prévia traz só o que está dentro do período, com CPF mascarado', async () => {
    const res = await api().get(`/reports/producer/${producerId}?${qs}`).set(auth()).expect(200);
    expect(res.body.producer.cpf).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    expect(JSON.stringify(res.body)).not.toContain(cpf);
    expect(res.body.totals).toEqual({
      visits: 2,
      requestsOpened: 0,
      requestsCompleted: 0,
      deliveries: 1,
      deliveredValueCents: 123_456,
    });
    expect(res.body.visits.map((v: { visitedOn: string }) => v.visitedOn)).toEqual(['2026-03-12', '2026-06-30']);
    expect(res.body.programs).toEqual([{ name: 'Palma forrageira', status: 'APPROVED', enrolledOn: '2026-02-10' }]);
  });

  describe('PDF', () => {
    let body: Buffer;
    let text: string;
    let screen: Record<string, any>;

    beforeAll(async () => {
      const res = await api().get(`/reports/producer/${producerId}/pdf?${qs}`).set(auth()).buffer(true).parse(binary).expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('relatorio-rosangela-araujo-pinheiro-2026-03-01-a-2026-06-30.pdf');
      body = res.body;
      text = squash((await pdfText(body)).text);
      screen = (await api().get(`/reports/producer/${producerId}?${qs}`).set(auth())).body;
    });

    it('é um PDF válido que abre', () => {
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(text.length).toBeGreaterThan(200);
    });

    it('os valores do PDF batem com os da tela', () => {
      const has = (s: string) => expect(text).toContain(squash(s));
      has(screen.producer.name);
      has(screen.producer.cpf);
      has(screen.producer.community);
      has(`Período: ${day(screen.period.from)} a ${day(screen.period.to)}`);
      has(`Visitas técnicas (${screen.totals.visits})`);
      has(`Solicitações abertas no período (${screen.totals.requestsOpened})`);
      has(`${screen.totals.deliveries} (${money(screen.totals.deliveredValueCents)})`);
      for (const v of screen.visits) {
        has(day(v.visitedOn));
        has(v.diagnosis);
      }
      for (const d of screen.deliveries) has(`${d.quantity} ${d.unit}`);
      has('14,50 ha');
      has('R$ 1.234,56');
    });

    it('não traz o CPF completo nem o que está fora do período', () => {
      expect(text).not.toContain(cpf);
      expect(text).not.toContain(squash('Fora do período'));
      expect(text).not.toContain('05/08/2026');
    });

    it('tem rodapé com quem gerou e número de página', () => {
      expect(text).toContain(squash('por Rafael Lins Moreira'));
      expect(text).toContain(squash('Página 1 de'));
    });

    it('gerar o PDF fica registrado na auditoria', async () => {
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'REPORT_GENERATED', entityId: producerId } });
      expect(log.details).toEqual({ from: period.from, to: period.to });
    });
  });

  it('muitas visitas quebram em várias páginas, todas numeradas', async () => {
    for (let i = 1; i <= 14; i++) {
      await api()
        .post('/visits')
        .set(auth())
        .send({
          producerId,
          visitedOn: `2026-05-${String(i).padStart(2, '0')}`,
          diagnosis: 'Acompanhamento do rebanho. '.repeat(8),
          actionPlan: 'Manter manejo sanitário e registrar pesagens. '.repeat(5),
        })
        .expect(201);
    }
    const res = await api().get(`/reports/producer/${producerId}/pdf?${qs}`).set(auth()).buffer(true).parse(binary).expect(200);
    const { text: raw, pages } = await pdfText(res.body);
    expect(pages).toBeGreaterThan(1);
    expect(squash(raw)).toContain(squash(`Página ${pages} de ${pages}`));
    expect(squash(raw)).toContain(squash('Visitas técnicas (16)'));
  });
});
