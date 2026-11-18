import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';
import { TestDatabase } from './test-database';

// Sem a margem de segurança do pull: aqui as gravações terminam antes de cada pull.
process.env.SYNC_PULL_LAG_MS = '0';

const ORG_A = '00000000-0000-4000-8000-000000000001';
type Pos = [number, number];
const ring = (lng: number, lat: number, size: number): Pos[] => [[lng, lat], [lng + size, lat], [lng + size, lat - size], [lng, lat - size], [lng, lat]];
const polygon = (lng: number, lat: number, size: number) => ({ type: 'Polygon', coordinates: [ring(lng, lat, size)] });
// Canaã dos Carajás (PA), município do piloto.
const PLOT = polygon(-49.88, -6.5, 0.001);
const PLOT_BIGGER = polygon(-49.88, -6.5, 0.002);

const iso = (d: Date) => d.toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

interface Op {
  entity: 'producer' | 'property' | 'visit' | 'feature';
  op: 'upsert' | 'delete';
  id: string;
  updatedAt: string;
  baseUpdatedAt?: string;
  data?: Record<string, unknown>;
}

describe('Sync offline: /sync/push e /sync/pull', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let tech: string;
  let tech2: string;
  let coord: string;

  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const push = (token: string, operations: Op[]) => api().post('/sync/push').set(as(token)).send({ operations });

  // Pull completo, página por página, juntando tudo (e conferindo que nada vem repetido).
  async function pullAll(token: string, since = '', limit = 500) {
    const all: Record<string, { id: string; [k: string]: unknown }[]> = { producers: [], properties: [], requests: [], visits: [], features: [] };
    let cursor = since;
    for (let page = 0; page < 100; page++) {
      const res = await api().get('/sync/pull').query({ since: cursor, limit }).set(as(token)).expect(200);
      for (const k of Object.keys(all)) all[k].push(...res.body.changes[k]);
      cursor = res.body.cursor;
      if (!res.body.hasMore) return { all, cursor };
    }
    throw new Error('O pull não terminou');
  }

  async function auditCount(action: string, entityId: string) {
    return prisma.auditLog.count({ where: { action, entityId } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    await resetData(prisma);
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');
    coord = await tokenFor(app, 'coordenacao@agrointegra.demo');
    const second = await prisma.user.create({
      data: { name: 'Técnica Sync', email: 'tecnico.sync2@agrointegra.demo', role: 'TECHNICIAN', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4) },
    });
    await prisma.organizationMembership.create({ data: { userId: second.id, organizationId: ORG_A, role: 'TECHNICIAN' } });
    tech2 = await tokenFor(app, 'tecnico.sync2@agrointegra.demo');
  });

  afterAll(() => app.close());

  it('exige login', async () => {
    await api().post('/sync/push').send({ operations: [] }).expect(401);
    await api().get('/sync/pull').expect(401);
  });

  describe('validação do lote', () => {
    const valid = (): Op => ({ entity: 'producer', op: 'upsert', id: randomUUID(), updatedAt: iso(new Date()), data: {} });

    it('recusa lote vazio e lote com mais de 50 operações', async () => {
      await push(tech, []).expect(400);
      const res = await push(tech, Array.from({ length: 51 }, valid)).expect(400);
      expect(JSON.stringify(res.body)).toContain('no máximo 50 operações');
    });

    it('recusa id que não é UUID v4 e entidade desconhecida', async () => {
      const res = await push(tech, [{ ...valid(), id: '123' }]).expect(400);
      expect(JSON.stringify(res.body)).toContain('UUID v4');
      await push(tech, [{ ...valid(), entity: 'user' as never }]).expect(400);
    });

    it('recusa alteração com data no futuro (relógio do aparelho adiantado), sem derrubar o lote', async () => {
      const ok = { ...valid(), data: { name: 'Produtor Relógio', cpf: makeCpf(950), community: 'Vila Feitosa' } };
      const future = { ...valid(), updatedAt: iso(new Date(Date.now() + 60 * 60_000)) };
      const res = await push(tech, [future, ok]).expect(200);
      expect(res.body.results[0]).toMatchObject({ status: 'error', retry: false });
      expect(res.body.results[0].message).toContain('data e a hora do aparelho');
      expect(res.body.results[1].status).toBe('applied');
    });

    it('erro de validação dos dados volta em português na própria operação', async () => {
      const res = await push(tech, [{ ...valid(), data: { name: '', cpf: '111.111.111-11', community: 'X' } }]).expect(200);
      expect(res.body.results[0].status).toBe('error');
      expect(res.body.results[0].message).toMatch(/CPF inválido|Informe o nome/);
    });
  });

  describe('cadastro feito offline: produtor, propriedade, visita e feição', () => {
    const ids = { producer: randomUUID(), property: randomUUID(), visit: randomUUID(), feature: randomUUID() };
    let batch: Op[];

    beforeAll(() => {
      const at = iso(minutesAgo(30));
      batch = [
        { entity: 'producer', op: 'upsert', id: ids.producer, updatedAt: at, data: { name: 'Maria Offline', cpf: makeCpf(951), community: 'Serra Dourada', consent: true } },
        { entity: 'property', op: 'upsert', id: ids.property, updatedAt: at, data: { producerId: ids.producer, name: 'Sítio Sem Sinal', areaHa: 12.5, locality: 'Serra Dourada' } },
        { entity: 'feature', op: 'upsert', id: ids.feature, updatedAt: at, data: { propertyId: ids.property, type: 'PLOT', name: 'Talhão 1', geometry: PLOT } },
        {
          entity: 'visit', op: 'upsert', id: ids.visit, updatedAt: at,
          data: { producerId: ids.producer, propertyId: ids.property, visitedOn: '2026-11-10', diagnosis: 'Solo compactado', actionPlan: 'Subsolagem', location: { latitude: -6.5, longitude: -49.88, accuracy: 8 } },
        },
      ];
    });

    it('aplica tudo, na ordem, com os ids gerados no aparelho', async () => {
      const res = await push(tech, batch).expect(200);
      expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
      expect(res.body.summary).toEqual({ applied: 4, duplicate: 0, rejected: 0, error: 0 });

      const [producer, property, feature, visit] = res.body.results.map((r: { record: unknown }) => r.record);
      expect(producer).toMatchObject({ id: ids.producer, name: 'Maria Offline', deletedAt: null });
      expect(producer.cpf).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/); // nunca completo
      expect(producer.consentAt).not.toBeNull();
      expect(property).toMatchObject({ id: ids.property, producerId: ids.producer, areaHa: 12.5 });
      expect(feature).toMatchObject({ id: ids.feature, propertyId: ids.property, type: 'PLOT', version: 1 });
      expect(feature.areaHa).toBeGreaterThan(1); // calculada pelo PostGIS
      expect(visit).toMatchObject({ id: ids.visit, producerId: ids.producer, visitedOn: '2026-11-10', photos: [] });
      expect(visit).not.toHaveProperty('signature');
    });

    it('grava na auditoria como as rotas do painel', async () => {
      expect(await auditCount('PRODUCER_CREATED', ids.producer)).toBe(1);
      expect(await auditCount('PROPERTY_CREATED', ids.property)).toBe(1);
      expect(await auditCount('VISIT_CREATED', ids.visit)).toBe(1);
      expect(await auditCount('PROPERTY_FEATURE_CREATED', ids.feature)).toBe(1);
    });

    it('reenviar o mesmo lote não duplica nada (resposta perdida no campo)', async () => {
      const res = await push(tech, batch).expect(200);
      expect(res.body.summary).toEqual({ applied: 0, duplicate: 4, rejected: 0, error: 0 });
      expect(await prisma.producer.count({ where: { id: ids.producer } })).toBe(1);
      expect(await prisma.visit.count({ where: { producerId: ids.producer } })).toBe(1);
      expect(await prisma.propertyFeature.count({ where: { propertyId: ids.property } })).toBe(1);
      expect(await auditCount('PRODUCER_CREATED', ids.producer)).toBe(1);
      expect(await auditCount('VISIT_CREATED', ids.visit)).toBe(1);
      expect(await prisma.auditLog.count({ where: { action: 'SYNC_CONFLICT' } })).toBe(0);
    });

    it('não aceita trocar o CPF nem o produtor da propriedade', async () => {
      const at = iso(new Date());
      const res = await push(tech, [
        { entity: 'producer', op: 'upsert', id: ids.producer, updatedAt: at, data: { cpf: makeCpf(952) } },
        { entity: 'property', op: 'upsert', id: ids.property, updatedAt: at, data: { producerId: randomUUID() } },
      ]).expect(200);
      expect(res.body.results[0]).toMatchObject({ status: 'error', retry: false });
      expect(res.body.results[0].message).toContain('CPF não pode ser alterado');
      expect(res.body.results[1].message).toContain('trocar o produtor');
    });

    it('visita com fotos no lote é recusada com orientação (fotos vão depois)', async () => {
      const res = await push(tech, [
        { entity: 'visit', op: 'upsert', id: randomUUID(), updatedAt: iso(new Date()), data: { ...batch[3].data, photos: ['data:image/jpeg;base64,AAAA'] } },
      ]).expect(200);
      expect(res.body.results[0].status).toBe('error');
      expect(res.body.results[0].message).toContain('fotos da visita são enviadas depois');
    });

    it('só feições podem ser excluídas pelo aplicativo', async () => {
      const res = await push(tech, [{ entity: 'producer', op: 'delete', id: ids.producer, updatedAt: iso(new Date()) }]).expect(200);
      expect(res.body.results[0].status).toBe('error');
      expect(await prisma.producer.findUniqueOrThrow({ where: { id: ids.producer } })).toMatchObject({ deletedAt: null });
    });
  });

  describe('criar e editar o mesmo registro offline, no mesmo lote', () => {
    it('a edição vale e não é tratada como conflito', async () => {
      const id = randomUUID();
      const res = await push(tech, [
        { entity: 'producer', op: 'upsert', id, updatedAt: iso(minutesAgo(20)), data: { name: 'João Rascunho', cpf: makeCpf(953), community: 'Vila Bom Jesus' } },
        { entity: 'producer', op: 'upsert', id, updatedAt: iso(minutesAgo(19)), data: { name: 'João Definitivo' } },
      ]).expect(200);
      expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied']);
      expect(res.body.results[1].conflict).toBeUndefined();
      expect((await prisma.producer.findUniqueOrThrow({ where: { id } })).name).toBe('João Definitivo');
      expect(await auditCount('SYNC_CONFLICT', id)).toBe(0);
    });
  });

  describe('conflito: vence o updatedAt mais recente', () => {
    let id: string;
    let base: string; // versão que o aparelho recebeu
    let seed = 1000;

    beforeEach(async () => {
      id = randomUUID();
      const created = await push(tech, [
        { entity: 'producer', op: 'upsert', id, updatedAt: iso(minutesAgo(60)), data: { name: 'Ana Base', cpf: makeCpf(seed++), community: 'Planalto' } },
      ]).expect(200);
      base = created.body.results[0].record.updatedAt;
    });

    it('sem alteração concorrente, aplica e não registra conflito', async () => {
      const res = await push(tech, [{ entity: 'producer', op: 'upsert', id, updatedAt: iso(new Date()), baseUpdatedAt: base, data: { phone: '(94) 99999-0000' } }]).expect(200);
      expect(res.body.results[0]).toMatchObject({ status: 'applied', record: { phone: '(94) 99999-0000' } });
      expect(await auditCount('SYNC_CONFLICT', id)).toBe(0);
    });

    it('o painel alterou depois da edição feita no campo: vence o servidor e o conflito fica registrado', async () => {
      const editedOffline = iso(new Date(Date.now() - 2000)); // editado no campo antes da alteração do painel
      await api().patch(`/producers/${id}`).set(as(coord)).send({ name: 'Ana do Painel' }).expect(200);

      const res = await push(tech, [{ entity: 'producer', op: 'upsert', id, updatedAt: editedOffline, baseUpdatedAt: base, data: { name: 'Ana do Campo' } }]).expect(200);
      expect(res.body.results[0]).toMatchObject({ status: 'rejected', record: { id, name: 'Ana do Painel' } });
      expect((await prisma.producer.findUniqueOrThrow({ where: { id } })).name).toBe('Ana do Painel');

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'SYNC_CONFLICT', entityId: id } });
      expect(log.details).toMatchObject({ winner: 'server', fields: ['name'], discarded: { name: 'Ana do Campo' }, baseUpdatedAt: base });
    });

    it('a edição do campo é mais recente que a do painel: vence o aparelho e o valor perdido fica registrado', async () => {
      await api().patch(`/producers/${id}`).set(as(coord)).send({ community: 'Planalto de Cima' }).expect(200);
      const editedLater = iso(new Date(Date.now() + 1000)); // dentro da tolerância de relógio
      const res = await push(tech, [{ entity: 'producer', op: 'upsert', id, updatedAt: editedLater, baseUpdatedAt: base, data: { community: 'Vale do Sossego' } }]).expect(200);
      expect(res.body.results[0]).toMatchObject({ status: 'applied', conflict: true, record: { community: 'Vale do Sossego' } });

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'SYNC_CONFLICT', entityId: id } });
      expect(log.details).toMatchObject({ winner: 'client', fields: ['community'], discarded: { community: 'Planalto de Cima' } });
    });

    it('dados iguais aos do servidor não geram conflito (reenvio de edição já aplicada)', async () => {
      await api().patch(`/producers/${id}`).set(as(coord)).send({ name: 'Ana Igual' }).expect(200);
      const res = await push(tech, [{ entity: 'producer', op: 'upsert', id, updatedAt: iso(minutesAgo(5)), baseUpdatedAt: base, data: { name: 'Ana Igual' } }]).expect(200);
      expect(res.body.results[0].status).toBe('duplicate');
      expect(await auditCount('SYNC_CONFLICT', id)).toBe(0);
    });
  });

  describe('feições: edição e exclusão', () => {
    let propertyId: string;

    beforeAll(async () => {
      const producerId = randomUUID();
      propertyId = randomUUID();
      await push(tech, [
        { entity: 'producer', op: 'upsert', id: producerId, updatedAt: iso(minutesAgo(10)), data: { name: 'Pedro Mapa', cpf: makeCpf(2001), community: 'Ourilândia' } },
        { entity: 'property', op: 'upsert', id: propertyId, updatedAt: iso(minutesAgo(10)), data: { producerId, name: 'Fazenda Mapa', areaHa: 30, locality: 'Ourilândia' } },
      ]).expect(200);
    });

    it('edita a geometria (nova versão, área recalculada) e exclui; reenvio da exclusão não faz nada', async () => {
      const id = randomUUID();
      const created = await push(tech, [{ entity: 'feature', op: 'upsert', id, updatedAt: iso(minutesAgo(3)), data: { propertyId, type: 'PLOT', geometry: PLOT } }]).expect(200);
      const v1 = created.body.results[0].record;

      const edited = await push(tech, [{ entity: 'feature', op: 'upsert', id, updatedAt: iso(minutesAgo(2)), baseUpdatedAt: v1.updatedAt, data: { geometry: PLOT_BIGGER } }]).expect(200);
      expect(edited.body.results[0]).toMatchObject({ status: 'applied', record: { version: 2 } });
      expect(edited.body.results[0].record.areaHa).toBeGreaterThan(v1.areaHa * 3);

      const del: Op = { entity: 'feature', op: 'delete', id, updatedAt: iso(minutesAgo(1)), baseUpdatedAt: edited.body.results[0].record.updatedAt };
      const removed = await push(tech, [del]).expect(200);
      expect(removed.body.results[0].status).toBe('applied');
      expect(removed.body.results[0].record.deletedAt).not.toBeNull();
      expect((await push(tech, [del]).expect(200)).body.results[0].status).toBe('duplicate');
      expect(await prisma.propertyFeatureVersion.count({ where: { featureId: id } })).toBe(3); // criada, alterada, excluída
    });

    it('técnico não exclui feição desenhada por outro técnico (permissão na API)', async () => {
      const id = randomUUID();
      const created = await push(tech, [{ entity: 'feature', op: 'upsert', id, updatedAt: iso(minutesAgo(1)), data: { propertyId, type: 'APP', geometry: PLOT } }]).expect(200);
      const res = await push(tech2, [{ entity: 'feature', op: 'delete', id, updatedAt: iso(new Date()), baseUpdatedAt: created.body.results[0].record.updatedAt }]).expect(200);
      expect(res.body.results[0]).toMatchObject({ status: 'error', retry: false });
      expect(res.body.results[0].message).toContain('Só a coordenação ou quem desenhou');
      expect((await prisma.propertyFeature.findUniqueOrThrow({ where: { id } })).deletedAt).toBeNull();
    });

    it('geometria inválida volta com a mensagem do módulo geo', async () => {
      const bowtie = { type: 'Polygon', coordinates: [[[-49.88, -6.5], [-49.879, -6.501], [-49.879, -6.5], [-49.88, -6.501], [-49.88, -6.5]]] };
      const res = await push(tech, [{ entity: 'feature', op: 'upsert', id: randomUUID(), updatedAt: iso(new Date()), data: { propertyId, type: 'PLOT', geometry: bowtie } }]).expect(200);
      expect(res.body.results[0].status).toBe('error');
      expect(res.body.results[0].message).toMatch(/inválid|cruza/i);
    });
  });

  describe('pull', () => {
    it('sincronização completa traz o que existe, sem CPF completo e sem bytes de foto ou assinatura', async () => {
      const { all } = await pullAll(tech);
      const total = await prisma.producer.count({ where: { organizationId: ORG_A } });
      expect(all.producers).toHaveLength(total);
      for (const p of all.producers) expect(String(p.cpf ?? '')).not.toMatch(/\d{11}/);
      expect(all.properties).toHaveLength(await prisma.property.count({ where: { organizationId: ORG_A } }));
      expect(all.visits).toHaveLength(await prisma.visit.count({ where: { organizationId: ORG_A } }));
      expect(all.features).toHaveLength(await prisma.propertyFeature.count({ where: { organizationId: ORG_A } })); // inclusive excluídas
      const active = all.features.find((f) => !f.deletedAt);
      expect((active?.geometry as { type: string }).type).toBe('MultiPolygon');
      expect(JSON.stringify(all.visits)).not.toContain('signature');
    });

    it('página pequena: percorre tudo sem repetir nem perder registro', async () => {
      const big = await pullAll(tech, '', 500);
      const small = await pullAll(tech, '', 2);
      for (const k of Object.keys(big.all)) {
        const a = small.all[k].map((r) => r.id);
        expect(new Set(a).size).toBe(a.length);
        expect(a.sort()).toEqual(big.all[k].map((r) => r.id).sort());
      }
    });

    it('incremental: só o que mudou depois do cursor, inclusive exclusões (sem dados do excluído)', async () => {
      const { cursor } = await pullAll(tech);
      expect((await pullAll(tech, cursor)).all.producers).toHaveLength(0);

      const featureId = randomUUID();
      const property = await prisma.property.findFirstOrThrow({ where: { organizationId: ORG_A } });
      const created = await push(tech, [{ entity: 'feature', op: 'upsert', id: featureId, updatedAt: iso(minutesAgo(1)), data: { propertyId: property.id, type: 'WATER', geometry: PLOT } }]).expect(200);
      const afterCreate = await pullAll(tech, cursor);
      expect(afterCreate.all.features.map((f) => f.id)).toEqual([featureId]);

      await push(tech, [{ entity: 'feature', op: 'delete', id: featureId, updatedAt: iso(new Date()), baseUpdatedAt: created.body.results[0].record.updatedAt }]).expect(200);
      const afterDelete = await pullAll(tech, afterCreate.cursor);
      expect(afterDelete.all.features).toHaveLength(1);
      expect(afterDelete.all.features[0]).toMatchObject({ id: featureId, propertyId: property.id });
      expect(afterDelete.all.features[0].deletedAt).not.toBeNull();
      expect(afterDelete.all.features[0]).not.toHaveProperty('geometry');
    });

    it('marcador inválido: 400 com orientação em português', async () => {
      const res = await api().get('/sync/pull').query({ since: 'abc' }).set(as(tech)).expect(400);
      expect(JSON.stringify(res.body)).toContain('sincronização completa');
      await api().get('/sync/pull').query({ limit: 501 }).set(as(tech)).expect(400);
    });
  });

  describe('isolamento por organização', () => {
    let orgB: string;
    let tokenB: string;

    beforeAll(async () => {
      orgB = (await prisma.organization.create({ data: { name: 'Secretaria de Teste B' } })).id;
      const user = await prisma.user.create({
        data: { name: 'Técnico B', email: 'tecnico.b.sync@agrointegra.demo', role: 'TECHNICIAN', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4) },
      });
      await prisma.organizationMembership.create({ data: { userId: user.id, organizationId: orgB, role: 'TECHNICIAN' } });
      tokenB = await tokenFor(app, 'tecnico.b.sync@agrointegra.demo');
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { organizationId: orgB } });
      await prisma.property.deleteMany({ where: { organizationId: orgB } });
      await prisma.producer.deleteMany({ where: { organizationId: orgB } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: orgB } });
      await prisma.organization.delete({ where: { id: orgB } });
    });

    it('o pull da outra organização não traz nada da organização A', async () => {
      const { all } = await pullAll(tokenB);
      for (const k of Object.keys(all)) expect(all[k]).toHaveLength(0);
    });

    it('o push grava na organização de quem envia', async () => {
      const id = randomUUID();
      const propertyId = randomUUID();
      const res = await push(tokenB, [
        { entity: 'producer', op: 'upsert', id, updatedAt: iso(new Date()), data: { name: 'Produtor B', cpf: makeCpf(3001), community: 'B' } },
        { entity: 'property', op: 'upsert', id: propertyId, updatedAt: iso(new Date()), data: { producerId: id, name: 'Sítio B', areaHa: 1, locality: 'B' } },
      ]).expect(200);
      expect(res.body.summary.applied).toBe(2);
      expect((await prisma.producer.findUniqueOrThrow({ where: { id } })).organizationId).toBe(orgB);
      expect((await prisma.property.findUniqueOrThrow({ where: { id: propertyId } })).organizationId).toBe(orgB);
      const pulled = await pullAll(tokenB);
      expect(pulled.all.producers.map((p) => p.id)).toEqual([id]);
    });

    it('não alcança registro da organização A pelo id, nem para ler nem para alterar', async () => {
      const victim = await prisma.producer.findFirstOrThrow({ where: { organizationId: ORG_A } });
      const victimProperty = await prisma.property.findFirstOrThrow({ where: { organizationId: ORG_A } });
      const res = await push(tokenB, [
        { entity: 'producer', op: 'upsert', id: victim.id, updatedAt: iso(new Date()), data: { name: 'Invadido', cpf: makeCpf(3002), community: 'B' } },
        { entity: 'producer', op: 'upsert', id: victim.id, updatedAt: iso(new Date()), baseUpdatedAt: iso(victim.updatedAt), data: { name: 'Invadido' } },
        { entity: 'property', op: 'upsert', id: randomUUID(), updatedAt: iso(new Date()), data: { producerId: victim.id, name: 'X', areaHa: 1, locality: 'X' } },
        { entity: 'feature', op: 'upsert', id: randomUUID(), updatedAt: iso(new Date()), data: { propertyId: victimProperty.id, type: 'PLOT', geometry: PLOT } },
      ]).expect(200);
      expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['error', 'error', 'error', 'error']);
      expect(res.body.results[0].message).toBe('Este identificador já está em uso por outro registro.');
      expect(JSON.stringify(res.body)).not.toContain(victim.name);
      expect((await prisma.producer.findUniqueOrThrow({ where: { id: victim.id } })).name).toBe(victim.name);
    });
  });
});
