import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';
import { pdfText, squash } from './pdf-text';
import { TestDatabase } from './test-database';

const DEFAULT_ORG = '00000000-0000-4000-8000-000000000001';

const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

// Linhas do CSV sem o BOM; cada linha vira lista de células (os dados do teste não têm ";" nem aspas).
const csvRows = (text: string) =>
  text
    .replace(/^﻿/, '')
    .trim()
    .split('\r\n')
    .map((line) => line.split(';'));

describe('Exportação em massa de relatórios', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let coord: string;
  let tech: string;
  let tech2: string;
  let techId: string;
  let tech2Id: string;
  let programId: string;
  const ids: Record<string, string> = {};
  const cpf = { p1: makeCpf(901), p2: makeCpf(902), p3: makeCpf(903) };
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createUser(email: string, name: string, organizationId: string) {
    const user = await prisma.user.create({
      data: { name, email, role: 'TECHNICIAN', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4) },
    });
    await prisma.organizationMembership.create({ data: { userId: user.id, organizationId, role: 'TECHNICIAN' } });
    return user.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    await resetData(prisma);
    coord = await tokenFor(app, 'coordenacao@agrointegra.demo');
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');
    techId = (await prisma.user.findUniqueOrThrow({ where: { email: 'tecnico@agrointegra.demo' } })).id;
    tech2Id = await createUser('tecnico2.bulk@agrointegra.demo', 'Joana Prado Lemos', DEFAULT_ORG);
    tech2 = await tokenFor(app, 'tecnico2.bulk@agrointegra.demo');

    const producer = async (key: string, name: string, community: string, doc: string) => {
      const res = await api().post('/producers').set(as(tech)).send({ name, cpf: doc, community, consent: true }).expect(201);
      ids[key] = res.body.id;
    };
    await producer('p1', 'Benedita Sales Rocha', 'Açude Novo', cpf.p1);
    await producer('p2', 'Cícero Matos Viana', 'Baixio', cpf.p2);
    await producer('p3', 'Damião Freire Lopes', 'Açude Novo', cpf.p3);

    const property = async (key: string, owner: string, name: string, areaHa: number) => {
      const res = await api()
        .post(`/producers/${ids[owner]}/properties`)
        .set(as(tech))
        .send({ name, areaHa, locality: 'Sede', mainActivity: 'Bovinocultura' })
        .expect(201);
      ids[key] = res.body.id;
    };
    await property('a1', 'p1', 'Sítio Aroeira', 10.5);
    await property('a2', 'p1', 'Sítio Baraúna', 4);
    await property('b1', 'p2', '=1+1 Sítio Cajueiro', 7.25); // nome que o Excel leria como fórmula
    await property('c1', 'p3', 'Sítio Dendê', 2);

    const visit = (token: string, producer: string, visitedOn: string, propertyId?: string) =>
      api()
        .post('/visits')
        .set(as(token))
        .send({ producerId: ids[producer], propertyId, visitedOn, diagnosis: `Diagnóstico ${visitedOn}`, actionPlan: 'Plano de manejo do rebanho.' })
        .expect(201);
    await visit(tech, 'p1', '2026-03-10', ids.a1);
    await visit(tech, 'p1', '2026-05-02');
    await visit(tech2, 'p2', '2026-04-15', ids.b1);
    await visit(tech, 'p2', '2026-08-01');

    programId = (
      await prisma.program.create({
        data: {
          name: 'Sementes crioulas',
          description: 'Distribuição de sementes.',
          slots: 10,
          goalQuantity: 100,
          unit: 'kits',
          budgetCents: 100_000,
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
    ).id;
    await prisma.enrollment.create({ data: { programId, producerId: ids.p2, status: 'ENROLLED', enrolledOn: new Date('2026-02-01') } });
  });

  afterAll(() => app.close());

  const count = (token: string, type: string, query: Record<string, string> = {}) =>
    api().get(`/reports/bulk/${type}/count`).query(query).set(as(token)).expect(200).then((r) => r.body.total as number);

  it('exige login', async () => {
    await api().get('/reports/bulk/filters').expect(401);
    await api().get('/reports/bulk/producers').expect(401);
    await api().get('/reports/bulk/producers/count').expect(401);
  });

  it('valida tipo, formato e período', async () => {
    await api().get('/reports/bulk/fazendas').set(as(coord)).expect(400);
    await api().get('/reports/bulk/producers').query({ format: 'xlsx' }).set(as(coord)).expect(400);
    const half = await api().get('/reports/bulk/visits/count').query({ from: '2026-01-01' }).set(as(coord)).expect(400);
    expect(JSON.stringify(half.body)).toContain('início e o fim do período');
    await api().get('/reports/bulk/visits/count').query({ from: '2026-06-01', to: '2026-01-01' }).set(as(coord)).expect(400);
    await api().get('/reports/bulk/visits/count').query({ technicianId: 'abc' }).set(as(coord)).expect(400);
  });

  it('opções dos filtros: coordenação vê todos os técnicos; técnico vê só ele', async () => {
    const all = (await api().get('/reports/bulk/filters').set(as(coord)).expect(200)).body;
    expect(all.communities).toEqual(['Açude Novo', 'Baixio']);
    expect(all.technicians.map((t: { id: string }) => t.id).sort()).toEqual([techId, tech2Id].sort());
    expect(all.programs).toEqual([{ id: programId, name: 'Sementes crioulas' }]);
    expect(all.technicianLocked).toBe(false);

    const own = (await api().get('/reports/bulk/filters').set(as(tech)).expect(200)).body;
    expect(own.technicians.map((t: { id: string }) => t.id)).toEqual([techId]);
    expect(own.technicianLocked).toBe(true);
  });

  it('sem filtros, a contagem bate com o banco', async () => {
    const where = { organizationId: DEFAULT_ORG, deletedAt: null };
    expect(await count(coord, 'producers')).toBe(await prisma.producer.count({ where }));
    expect(await count(coord, 'properties')).toBe(await prisma.property.count({ where }));
    expect(await count(coord, 'visits')).toBe(await prisma.visit.count({ where }));
    expect(await count(coord, 'producers')).toBe(3);
  });

  it('período: produtores e propriedades com visita no período; visitas pela data', async () => {
    const period = { from: '2026-03-01', to: '2026-04-30' };
    expect(await count(coord, 'producers', period)).toBe(2); // p1 (10/03) e p2 (15/04)
    expect(await count(coord, 'properties', period)).toBe(2); // a1 e b1 (visitas ligadas à propriedade)
    expect(await count(coord, 'visits', period)).toBe(2);
    expect(await count(coord, 'visits', { from: '2026-05-02', to: '2026-05-02' })).toBe(1); // dia único, inclusive
  });

  it('comunidade, programa e técnico', async () => {
    expect(await count(coord, 'producers', { community: 'Açude Novo' })).toBe(2);
    expect(await count(coord, 'properties', { community: 'Açude Novo' })).toBe(3);
    expect(await count(coord, 'producers', { programId })).toBe(1);
    expect(await count(coord, 'visits', { programId })).toBe(2); // visitas a p2
    expect(await count(coord, 'producers', { technicianId: tech2Id })).toBe(1);
    expect(await count(coord, 'visits', { technicianId: tech2Id })).toBe(1);
  });

  it('técnico só exporta os próprios registros, mesmo pedindo os de outro', async () => {
    expect(await count(tech, 'visits')).toBe(3);
    expect(await count(tech, 'visits', { technicianId: tech2Id })).toBe(3);
    expect(await count(tech2, 'visits')).toBe(1);
    expect(await count(tech2, 'producers')).toBe(1);
    const csv = (await api().get('/reports/bulk/visits').set(as(tech2)).expect(200)).text;
    expect(csv).toContain('Joana Prado Lemos');
    expect(csv).not.toContain('Rafael Lins Moreira');
  });

  describe('planilha CSV', () => {
    let text: string;
    let res: request.Response;

    beforeAll(async () => {
      res = await api().get('/reports/bulk/producers').query({ format: 'csv' }).set(as(coord)).expect(200);
      text = res.text;
    });

    it('vem como anexo CSV com BOM e cabeçalho em português', () => {
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="relatorio-produtores-\d{4}-\d{2}-\d{2}\.csv"/);
      expect(text.charCodeAt(0)).toBe(0xfeff);
      expect(csvRows(text)[0]).toEqual([
        'Produtor',
        'CPF',
        'Comunidade',
        'Consentimento',
        'Propriedades',
        'Área declarada (ha)',
        'Visitas',
        'Última visita',
        'Solicitações abertas',
        'Programas',
      ]);
    });

    it('linha do produtor com CPF mascarado, área com vírgula e última visita', () => {
      const row = csvRows(text).find((r) => r[0] === 'Benedita Sales Rocha')!;
      expect(row[1]).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
      expect(row.slice(2)).toEqual(['Açude Novo', expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/), '2', '14,50', '2', '02/05/2026', '0', '']);
      const p2 = csvRows(text).find((r) => r[0] === 'Cícero Matos Viana')!;
      expect(p2[9]).toBe('Sementes crioulas (Inscrito)');
    });

    it('nunca traz o CPF completo nem o telefone', () => {
      for (const doc of Object.values(cpf)) expect(text).not.toContain(doc);
      expect(text).not.toMatch(/Telefone/);
    });

    it('nome que parece fórmula sai neutralizado', async () => {
      const props = (await api().get('/reports/bulk/properties').set(as(coord)).expect(200)).text;
      expect(props).toContain("'=1+1 Sítio Cajueiro");
      expect(props).not.toMatch(/(^|;)=1\+1/m);
    });

    it('fica registrado na auditoria com filtros e quantidade', async () => {
      await api().get('/reports/bulk/visits').query({ community: 'Baixio', format: 'csv' }).set(as(tech)).expect(200);
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'REPORT_EXPORTED', entity: 'Visit', userId: techId },
        orderBy: { createdAt: 'desc' },
      });
      expect(log.details).toEqual({
        type: 'visits',
        format: 'csv',
        rows: 1,
        filters: { from: null, to: null, community: 'Baixio', technicianId: techId, programId: null },
      });
    });
  });

  describe('PDF', () => {
    it('é um PDF válido com título, filtros, linhas e páginas numeradas', async () => {
      const res = await api()
        .get('/reports/bulk/visits')
        .query({ format: 'pdf', from: '2026-03-01', to: '2026-12-31', programId })
        .set(as(coord))
        .buffer(true)
        .parse(binary)
        .expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/relatorio-visitas-.*\.pdf/);
      const body = res.body as Buffer;
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      const text = squash((await pdfText(body)).text);
      expect(text).toContain(squash('Relatório de visitas técnicas'));
      expect(text).toContain(squash('Período: 01/03/2026 a 31/12/2026'));
      expect(text).toContain(squash('Programa: Sementes crioulas'));
      expect(text).toContain(squash('Total: 2 registros'));
      expect(text).toContain(squash('Diagnóstico 2026-04-15'));
      expect(text).toContain(squash('Diagnóstico 2026-08-01'));
      expect(text).not.toContain(squash('Diagnóstico 2026-03-10'));
      expect(text).toContain(squash('Página 1 de'));
    });
  });

  it('acima do limite, pede para restringir os filtros', async () => {
    await prisma.visit.createMany({
      data: Array.from({ length: 2001 }, () => ({
        organizationId: DEFAULT_ORG,
        producerId: ids.p3,
        technicianId: tech2Id,
        visitedOn: new Date('2025-01-01'),
        diagnosis: 'Carga de teste',
        actionPlan: 'Carga de teste',
      })),
    });
    try {
      const res = await api().get('/reports/bulk/visits').query({ format: 'pdf' }).set(as(coord)).expect(400);
      expect(JSON.stringify(res.body)).toContain('Restrinja os filtros');
      await api().get('/reports/bulk/visits').query({ format: 'csv' }).set(as(coord)).expect(200); // CSV aceita até 20.000
    } finally {
      await prisma.visit.deleteMany({ where: { diagnosis: 'Carga de teste' } });
    }
  });

  describe('isolamento por organização', () => {
    let orgB: string;
    let techB: string;

    beforeAll(async () => {
      orgB = (await prisma.organization.create({ data: { name: 'Secretaria de Teste B (relatórios)' } })).id;
      await createUser('tecnico.b.bulk@agrointegra.demo', 'Técnico B', orgB);
      techB = await tokenFor(app, 'tecnico.b.bulk@agrointegra.demo');
      const p = await api().post('/producers').set(as(techB)).send({ name: 'Produtor da Org B', cpf: makeCpf(950), community: 'Vila B', consent: true }).expect(201);
      await api().post('/visits').set(as(techB)).send({ producerId: p.body.id, visitedOn: '2026-04-01', diagnosis: 'Visita B', actionPlan: 'Plano B' }).expect(201);
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { organizationId: orgB } });
      await prisma.visit.deleteMany({ where: { organizationId: orgB } });
      await prisma.producer.deleteMany({ where: { organizationId: orgB } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: orgB } });
      await prisma.organization.delete({ where: { id: orgB } });
    });

    it('a coordenação de A não vê nada de B, e B não vê nada de A', async () => {
      expect(await count(coord, 'producers')).toBe(3);
      const csvA = (await api().get('/reports/bulk/visits').set(as(coord)).expect(200)).text;
      expect(csvA).not.toContain('Produtor da Org B');
      const filtersA = (await api().get('/reports/bulk/filters').set(as(coord)).expect(200)).body;
      expect(filtersA.communities).not.toContain('Vila B');

      expect(await count(techB, 'visits')).toBe(1);
      const csvB = (await api().get('/reports/bulk/producers').set(as(techB)).expect(200)).text;
      expect(csvB).toContain('Produtor da Org B');
      expect(csvB).not.toContain('Benedita Sales Rocha');
    });
  });
});
