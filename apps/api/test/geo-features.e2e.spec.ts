import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, INestApplication, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../src/auth/current-user.decorator';
import { GeoFeaturesService } from '../src/geo/geo-features.service';
import { TenancyService } from '../src/tenancy/tenancy.service';
import { createTestApp, makeCpf, resetData } from './fixtures';
import { TestDatabase } from './test-database';

const ORG_A = '00000000-0000-4000-8000-000000000001';

// Quadrado de 0,001° × 0,001° perto de Salvador (BA). Valores de referência calculados FORA do
// PostGIS, no elipsoide WGS 84 a -12,97°: 1° de longitude = 108.497,6 m; 1° de latitude = 110.630,2 m.
const ring = (size: number) => [[-38.5, -12.97], [-38.5 + size, -12.97], [-38.5 + size, -12.97 - size], [-38.5, -12.97 - size], [-38.5, -12.97]];
const SQUARE = { type: 'Polygon', coordinates: [ring(0.001)] };
const SQUARE_HA = 1.2003; // 108,4976 m × 110,6302 m
const SQUARE_PERIMETER_M = 438.26;
const BIGGER = { type: 'Polygon', coordinates: [ring(0.002)] };
const BIGGER_HA = 4.8013; // 216,995 m × 221,260 m
const BOWTIE = { type: 'Polygon', coordinates: [[[-38.5, -12.97], [-38.499, -12.971], [-38.499, -12.97], [-38.5, -12.971], [-38.5, -12.97]]] };
const ROAD = { type: 'LineString', coordinates: [[-38.5, -12.97], [-38.499, -12.97]] };
const ROAD_M = 108.5;

// Tolerância de 0,5% (meta do planejamento entre referência e servidor).
const near = (value: number | null, expected: number) => {
  expect(value).not.toBeNull();
  expect(Math.abs((value as number) - expected) / expected).toBeLessThan(0.005);
};

describe('Geo: feições da propriedade (PostGIS)', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let geo: GeoFeaturesService;
  let tenancy: TenancyService;
  let user: AuthUser;
  let propertyId: string;

  const inOrg = <T>(organizationId: string, fn: () => Promise<T>) => tenancy.run({ organizationId, userId: user.id }, fn);
  const asA = <T>(fn: () => Promise<T>) => inOrg(ORG_A, fn);

  async function createProperty(organizationId: string, seed: number) {
    const producer = await prisma.producer.create({
      data: { organizationId, name: `Produtor Geo ${seed}`, searchName: `produtor geo ${seed}`, cpf: makeCpf(seed), community: 'Teste', createdById: user.id },
    });
    return prisma.property.create({
      data: { organizationId, producerId: producer.id, name: `Sítio Mapa ${seed}`, areaHa: new Prisma.Decimal(1.5), locality: 'Teste', createdById: user.id },
    });
  }

  const property = () => prisma.property.findUniqueOrThrow({ where: { id: propertyId } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    geo = app.get(GeoFeaturesService);
    tenancy = app.get(TenancyService);
    await resetData(prisma);
    const tech = await prisma.user.findUniqueOrThrow({ where: { email: 'tecnico@agrointegra.demo' } });
    user = { id: tech.id, name: tech.name, email: tech.email, role: 'TECHNICIAN', organizationId: ORG_A, navStyle: 'topbar', theme: null };
    propertyId = (await createProperty(ORG_A, 700)).id;
  });

  afterAll(() => app.close());

  describe('perímetro e área calculada', () => {
    let perimeterId: string;

    it('grava Polygon como MultiPolygon e o banco calcula área (ha) e perímetro (m)', async () => {
      const f = await asA(() => geo.create({ propertyId, type: 'PERIMETER', name: 'Perímetro', geometry: SQUARE }, user));
      perimeterId = f.id;
      expect(f.geometry.type).toBe('MultiPolygon');
      near(f.properties.areaHa, SQUARE_HA);
      near(f.properties.perimeterM, SQUARE_PERIMETER_M);
      expect(f.properties.lengthM).toBeNull();
      expect(f.properties.version).toBe(1);
    });

    it('preenche a área calculada da propriedade sem tocar na área declarada', async () => {
      const p = await property();
      near(Number(p.calculatedAreaHa), SQUARE_HA);
      near(Number(p.calculatedPerimeterM), SQUARE_PERIMETER_M);
      expect(Number(p.areaHa)).toBe(1.5);
    });

    it('não aceita um segundo perímetro ativo na mesma propriedade', async () => {
      await expect(asA(() => geo.create({ propertyId, type: 'PERIMETER', geometry: BIGGER }, user))).rejects.toThrow(ConflictException);
    });

    it('alterar a geometria gera nova versão e atualiza a área da propriedade', async () => {
      const f = await asA(() => geo.update(perimeterId, { geometry: BIGGER, expectedVersion: 1 }, user));
      expect(f.properties.version).toBe(2);
      near(f.properties.areaHa, BIGGER_HA);
      near(Number((await property()).calculatedAreaHa), BIGGER_HA);
      const history = await asA(() => geo.history(perimeterId));
      expect(history.map((h) => [h.version, h.change])).toEqual([[1, 'CREATED'], [2, 'UPDATED']]);
      near(history[0].areaHa, SQUARE_HA);
      expect(history[1].changedBy).toEqual({ id: user.id, name: user.name });
    });

    it('recusa salvar sobre uma versão desatualizada', async () => {
      await expect(asA(() => geo.update(perimeterId, { name: 'Outro', expectedVersion: 1 }, user))).rejects.toThrow(/versão 2/);
    });

    it('exclusão lógica: some das consultas, fica no histórico e limpa a área calculada', async () => {
      await asA(() => geo.remove(perimeterId, user));
      await expect(asA(() => geo.findOne(perimeterId))).rejects.toThrow(NotFoundException);
      await expect(asA(() => geo.update(perimeterId, { name: 'x' }, user))).rejects.toThrow(NotFoundException);
      const history = await asA(() => geo.history(perimeterId));
      expect(history.map((h) => h.change)).toEqual(['CREATED', 'UPDATED', 'DELETED']);
      const p = await property();
      expect(p.calculatedAreaHa).toBeNull();
      expect(p.calculatedPerimeterM).toBeNull();
      expect(Number(p.areaHa)).toBe(1.5);
      // Excluído o anterior, um novo perímetro pode ser desenhado.
      await expect(asA(() => geo.create({ propertyId, type: 'PERIMETER', geometry: SQUARE }, user))).resolves.toBeDefined();
    });

    it('cada operação entra na auditoria', async () => {
      const actions = await prisma.auditLog.findMany({ where: { entityId: perimeterId }, orderBy: { createdAt: 'asc' } });
      expect(actions.map((a) => a.action)).toEqual(['PROPERTY_FEATURE_CREATED', 'PROPERTY_FEATURE_UPDATED', 'PROPERTY_FEATURE_DELETED']);
      expect(actions.every((a) => a.userId === user.id && a.organizationId === ORG_A)).toBe(true);
    });
  });

  describe('outros tipos de feição', () => {
    it('estrada tem comprimento em metros; sede em ponto não tem métricas', async () => {
      const road = await asA(() => geo.create({ propertyId, type: 'ROAD', name: 'Estrada vicinal', geometry: ROAD }, user));
      expect(road.geometry.type).toBe('MultiLineString');
      near(road.properties.lengthM, ROAD_M);
      expect(road.properties.areaHa).toBeNull();

      const hq = await asA(() => geo.create({ propertyId, type: 'HEADQUARTERS', geometry: { type: 'Point', coordinates: [-38.4995, -12.9705] } }, user));
      expect(hq.geometry).toEqual({ type: 'Point', coordinates: [-38.4995, -12.9705] });
      expect([hq.properties.areaHa, hq.properties.perimeterM, hq.properties.lengthM]).toEqual([null, null, null]);
    });

    it('lista as feições ativas da propriedade como FeatureCollection, perímetro primeiro', async () => {
      const fc = await asA(() => geo.listByProperty(propertyId));
      expect(fc.type).toBe('FeatureCollection');
      expect(fc.features.map((f) => f.properties.featureType)).toEqual(['PERIMETER', 'HEADQUARTERS', 'ROAD']);
    });
  });

  describe('validação com mensagem em português', () => {
    it('polígono em forma de laço é rejeitado com o motivo e o local', async () => {
      const attempt = asA(() => geo.create({ propertyId, type: 'PLOT', geometry: BOWTIE }, user));
      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(asA(() => geo.create({ propertyId, type: 'PLOT', geometry: BOWTIE }, user))).rejects.toThrow(/se cruza.*perto de latitude/);
    });

    it('recusa forma errada para o tipo, poucos vértices e lat/lng trocadas', async () => {
      await expect(asA(() => geo.create({ propertyId, type: 'ROAD', geometry: SQUARE }, user))).rejects.toThrow('Estrada aceita apenas linha');
      const flat = { type: 'Polygon', coordinates: [[[-38.5, -12.97], [-38.499, -12.97], [-38.5, -12.97]]] };
      await expect(asA(() => geo.create({ propertyId, type: 'PLOT', geometry: flat }, user))).rejects.toThrow('pelo menos 3 vértices');
      const swapped = { type: 'Polygon', coordinates: [ring(0.001).map(([lng, lat]) => [lat, lng])] };
      await expect(asA(() => geo.create({ propertyId, type: 'PLOT', geometry: swapped }, user))).rejects.toThrow('fora do Brasil');
    });

    it('propriedade inexistente dá 404', async () => {
      await expect(asA(() => geo.create({ propertyId: randomUUID(), type: 'PLOT', geometry: SQUARE }, user))).rejects.toThrow(NotFoundException);
    });

    it('ST_MakeValid só propõe a correção, sem gravar nada', async () => {
      const before = await prisma.propertyFeature.count();
      const fix = await asA(() => geo.suggestFix('PLOT', BOWTIE));
      expect(fix.valid).toBe(false);
      expect(fix.message).toMatch(/se cruza/);
      expect(fix.suggestion?.type).toBe('MultiPolygon');
      expect(fix.suggestion?.coordinates.length).toBe(2); // o laço vira dois triângulos
      expect(await prisma.propertyFeature.count()).toBe(before);
      await expect(asA(() => geo.suggestFix('PLOT', SQUARE))).resolves.toEqual({ valid: true, message: null, suggestion: null });
    });
  });

  describe('preparado para offline: UUID do aparelho e idempotência', () => {
    it('reenviar a criação com o mesmo UUID não duplica a feição, o histórico nem a auditoria', async () => {
      const id = randomUUID();
      const input = { id, propertyId, type: 'PLOT' as const, name: 'Talhão 1', geometry: SQUARE };
      const first = await asA(() => geo.create(input, user));
      const again = await asA(() => geo.create(input, user));
      expect(first.id).toBe(id);
      expect(again).toEqual(first);
      expect(await prisma.propertyFeatureVersion.count({ where: { featureId: id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entityId: id, action: 'PROPERTY_FEATURE_CREATED' } })).toBe(1);
    });

    it('UUID mal formado ou reaproveitado em outra feição é recusado', async () => {
      await expect(asA(() => geo.create({ id: 'abc', propertyId, type: 'PLOT', geometry: SQUARE }, user))).rejects.toThrow('UUID v4');
      const id = randomUUID();
      await asA(() => geo.create({ id, propertyId, type: 'PLOT', geometry: SQUARE }, user));
      await expect(asA(() => geo.create({ id, propertyId, type: 'APP', geometry: SQUARE }, user))).rejects.toThrow(ConflictException);
    });
  });

  describe('isolamento por organização', () => {
    it('feição de outra organização não aparece, não muda e não tem o id reaproveitado', async () => {
      const orgB = await prisma.organization.create({ data: { name: 'Organização de teste B (geo)' } });
      try {
        const propB = await createProperty(orgB.id, 701);
        const featureB = await inOrg(orgB.id, () => geo.create({ propertyId: propB.id, type: 'PERIMETER', geometry: SQUARE }, user));
        expect(await prisma.propertyFeature.count({ where: { id: featureB.id, organizationId: orgB.id } })).toBe(1);

        await expect(asA(() => geo.findOne(featureB.id))).rejects.toThrow(NotFoundException);
        await expect(asA(() => geo.history(featureB.id))).rejects.toThrow(NotFoundException);
        await expect(asA(() => geo.listByProperty(propB.id))).rejects.toThrow(NotFoundException);
        await expect(asA(() => geo.update(featureB.id, { name: 'invasão' }, user))).rejects.toThrow(NotFoundException);
        await expect(asA(() => geo.remove(featureB.id, user))).rejects.toThrow(NotFoundException);
        await expect(asA(() => geo.create({ propertyId: propB.id, type: 'PLOT', geometry: SQUARE }, user))).rejects.toThrow(NotFoundException);
        await expect(asA(() => geo.create({ id: featureB.id, propertyId, type: 'PERIMETER', geometry: SQUARE }, user))).rejects.toThrow(ConflictException);

        const untouched = await inOrg(orgB.id, () => geo.findOne(featureB.id));
        expect(untouched.properties.version).toBe(1);
        expect(untouched.properties.name).toBeNull();
      } finally {
        await prisma.auditLog.deleteMany({ where: { organizationId: orgB.id } });
        await prisma.property.deleteMany({ where: { organizationId: orgB.id } });
        await prisma.producer.deleteMany({ where: { organizationId: orgB.id } });
        await prisma.organization.delete({ where: { id: orgB.id } });
      }
    });
  });

  describe('rede de segurança no banco (escrita fora da API)', () => {
    it('área digitada direto no banco é ignorada: a trigger recalcula', async () => {
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "PropertyFeature" ("organizationId", id, "propertyId", type, geom, "areaHa", "createdById", "updatedById")
        VALUES (${ORG_A}, ${id}, ${propertyId}, 'PLOT', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(SQUARE)}), 4326)), 999, ${user.id}, ${user.id})`;
      const [row] = await prisma.$queryRaw<{ areaHa: Prisma.Decimal; version: number }[]>`
        SELECT "areaHa", version FROM "PropertyFeature" WHERE id = ${id}`;
      near(Number(row.areaHa), SQUARE_HA);
      expect(row.version).toBe(1);
    });

    it('CHECK recusa geometria do tipo errado e geometria inválida', async () => {
      const insert = (type: string, geojson: object) => prisma.$executeRaw`
        INSERT INTO "PropertyFeature" ("organizationId", id, "propertyId", type, geom, "createdById", "updatedById")
        VALUES (${ORG_A}, ${randomUUID()}, ${propertyId}, ${type}::"PropertyFeatureType",
                ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geojson)}), 4326)), ${user.id}, ${user.id})`;
      await expect(insert('ROAD', SQUARE)).rejects.toThrow(/PropertyFeature_geom_check/);
      await expect(insert('PLOT', BOWTIE)).rejects.toThrow(/PropertyFeature_geom_check/);
    });

    it('tipo, propriedade e organização não mudam; histórico não é reescrito', async () => {
      const f = await asA(() => geo.create({ propertyId, type: 'APP', geometry: SQUARE }, user));
      await expect(prisma.$executeRaw`UPDATE "PropertyFeature" SET type = 'PLOT' WHERE id = ${f.id}`).rejects.toThrow(/não podem ser alterados/);
      await expect(prisma.$executeRaw`UPDATE "PropertyFeatureVersion" SET name = 'adulterado' WHERE "featureId" = ${f.id}`).rejects.toThrow(
        /histórico da demarcação não pode ser alterado/,
      );
    });
  });
});
