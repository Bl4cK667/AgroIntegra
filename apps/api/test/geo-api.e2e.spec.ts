import { INestApplication } from '@nestjs/common';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import bcrypt from 'bcryptjs';
import JSZip from 'jszip';
import request from 'supertest';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';
import { TestDatabase } from './test-database';

// O bundle CommonJS do shpjs é feito para navegador e usa o global "self".
(globalThis as { self?: unknown }).self ??= globalThis;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shp = require('shpjs'); // mesma biblioteca que o painel usa para importar Shapefile

const ORG_A = '00000000-0000-4000-8000-000000000001';
type Pos = [number, number];
const ring = (lng: number, lat: number, size: number): Pos[] => [[lng, lat], [lng + size, lat], [lng + size, lat - size], [lng, lat - size], [lng, lat]];
const polygon = (lng: number, lat: number, size: number) => ({ type: 'Polygon', coordinates: [ring(lng, lat, size)] });
const SQUARE = polygon(-38.5, -12.97, 0.001); // ≈ 1,2003 ha
const BOWTIE = { type: 'Polygon', coordinates: [[[-38.5, -12.97], [-38.499, -12.971], [-38.499, -12.97], [-38.5, -12.971], [-38.5, -12.97]]] };
const HOLE: Pos[] = [[-38.4995, -12.9705], [-38.4985, -12.9705], [-38.4985, -12.9715], [-38.4995, -12.9715], [-38.4995, -12.9705]];

// Conjunto de vértices de um anel (a ordem/sentido pode mudar entre formatos).
const vertexSet = (r: number[][]) => [...new Set(r.map(([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`))].sort();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function binary(res: any, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('Geo: API HTTP', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let coord: string;
  let tech: string;
  let tech2: string;
  let techId: string;
  const p: Record<'demarcated' | 'pointOnly' | 'noLocation' | 'work', string> = { demarcated: '', pointOnly: '', noLocation: '', work: '' };
  let programId: string;

  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function property(seed: number, name: string, community: string, extra: Record<string, unknown> = {}) {
    const producer = await prisma.producer.create({
      data: { organizationId: ORG_A, name: `Produtor ${name}`, searchName: `produtor ${seed}`, cpf: makeCpf(seed), community, createdById: techId },
    });
    const prop = await prisma.property.create({
      data: { organizationId: ORG_A, producerId: producer.id, name, areaHa: 10, locality: community, createdById: techId, ...extra },
    });
    return { producerId: producer.id, id: prop.id };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    await resetData(prisma);
    coord = await tokenFor(app, 'coordenacao@agrointegra.demo');
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');
    techId = (await prisma.user.findUniqueOrThrow({ where: { email: 'tecnico@agrointegra.demo' } })).id;
    const second = await prisma.user.create({
      data: { name: 'Técnica Dois', email: 'tecnico.geo2@agrointegra.demo', role: 'TECHNICIAN', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4) },
    });
    await prisma.organizationMembership.create({ data: { userId: second.id, organizationId: ORG_A, role: 'TECHNICIAN' } });
    tech2 = await tokenFor(app, 'tecnico.geo2@agrointegra.demo');

    const demarcated = await property(800, 'Sítio Riacho Verde', 'Riacho Verde', { mainActivity: 'Leite' });
    const pointOnly = await property(801, 'Fazenda Baixio', 'Baixio', { mainActivity: 'Mandioca', latitude: -12.99, longitude: -38.52 });
    const noLocation = await property(802, 'Chácara Sem Mapa', 'Baixio');
    const work = await property(803, 'Sítio Exportação', 'Serrote');
    Object.assign(p, { demarcated: demarcated.id, pointOnly: pointOnly.id, noLocation: noLocation.id, work: work.id });

    await api().post(`/properties/${p.demarcated}/features`).set(as(tech)).send({ type: 'PERIMETER', geometry: SQUARE }).expect(201);
    await prisma.visit.create({
      data: { organizationId: ORG_A, producerId: demarcated.producerId, propertyId: p.demarcated, technicianId: techId, visitedOn: new Date('2026-11-10'), diagnosis: 'd', actionPlan: 'a' },
    });
    await prisma.serviceRequest.create({
      data: { organizationId: ORG_A, producerId: pointOnly.producerId, propertyId: p.pointOnly, subject: 'Análise de solo', createdById: techId },
    });
    const program = await prisma.program.create({
      data: {
        organizationId: ORG_A, name: 'Programa Sementes', description: 'Teste', slots: 10, goalQuantity: 10, unit: 'kits',
        budgetCents: 100000, startsOn: new Date('2026-01-01'), endsOn: new Date('2026-12-31'),
      },
    });
    programId = program.id;
    await prisma.enrollment.create({ data: { organizationId: ORG_A, programId, producerId: pointOnly.producerId, enrolledOn: new Date('2026-02-01') } });
  });

  afterAll(() => app.close());

  it('exige login em todas as rotas do módulo', async () => {
    await api().get('/properties/geojson').expect(401);
    await api().get(`/properties/${p.work}/features`).expect(401);
    await api().post('/features/validate').send({ type: 'PLOT', geometry: SQUARE }).expect(401);
  });

  describe('mapa territorial', () => {
    const ids = (body: { features: { id: string }[] }) => body.features.map((f) => f.id).sort();

    it('demarcada sai como polígono, só com lat/lng sai como ponto, sem local fica de fora (e é contada)', async () => {
      const res = await api().get('/properties/geojson').set(as(coord)).expect(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(ids(res.body)).toEqual([p.demarcated, p.pointOnly].sort());
      expect(res.body.meta).toMatchObject({ count: 2, truncated: false, withoutLocation: 2 }); // sem mapa + a de exportação
      const d = res.body.features.find((f: { id: string }) => f.id === p.demarcated);
      expect(d.geometry.type).toBe('MultiPolygon');
      expect(d.properties).toMatchObject({ demarcated: true, declaredAreaHa: 10, community: 'Riacho Verde', lastVisitOn: '2026-11-10', openRequests: 0 });
      expect(d.properties.calculatedAreaHa).toBeCloseTo(1.2003, 3);
      const pt = res.body.features.find((f: { id: string }) => f.id === p.pointOnly);
      expect(pt.geometry).toEqual({ type: 'Point', coordinates: [-38.52, -12.99] });
      expect(pt.properties).toMatchObject({ demarcated: false, calculatedAreaHa: null, openRequests: 1 });
    });

    it('a página do produtor passa a mostrar a área demarcada da propriedade', async () => {
      const producerId = (await prisma.property.findUniqueOrThrow({ where: { id: p.demarcated } })).producerId;
      const res = await api().get(`/producers/${producerId}`).set(as(tech)).expect(200);
      const prop = res.body.properties.find((x: { id: string }) => x.id === p.demarcated);
      expect(prop).toMatchObject({ areaHa: 10, demarcated: true });
      expect(prop.calculatedAreaHa).toBeCloseTo(1.2003, 3);
      const list = await api().get('/properties').set(as(tech)).expect(200);
      expect(list.body.items.find((x: { id: string }) => x.id === p.pointOnly)).toMatchObject({ demarcated: false, calculatedAreaHa: null });
    });

    it('nunca devolve CPF', async () => {
      const res = await api().get('/properties/geojson').set(as(coord)).expect(200);
      for (const seed of [800, 801]) expect(JSON.stringify(res.body)).not.toContain(makeCpf(seed));
    });

    it('filtra por comunidade, atividade, programa, técnico, situação da solicitação e recorte', async () => {
      const q = async (query: string) => ids((await api().get(`/properties/geojson?${query}`).set(as(coord)).expect(200)).body);
      expect(await q('community=Baixio')).toEqual([p.pointOnly]);
      expect(await q('mainActivity=Leite')).toEqual([p.demarcated]);
      expect(await q(`programId=${programId}`)).toEqual([p.pointOnly]);
      expect(await q(`technicianId=${techId}`)).toEqual([p.demarcated]);
      expect(await q('requestStatus=OPEN')).toEqual([p.pointOnly]);
      expect(await q('requestStatus=NEW')).toEqual([p.pointOnly]);
      expect(await q('requestStatus=DONE')).toEqual([]);
      expect(await q('bbox=-38.501,-12.972,-38.498,-12.969')).toEqual([p.demarcated]);
      const limited = await api().get('/properties/geojson?limit=1').set(as(coord)).expect(200);
      expect(limited.body.meta).toMatchObject({ count: 1, truncated: true, limit: 1 });
    });

    it('recusa parâmetros inválidos com mensagem clara', async () => {
      const bad = async (query: string) => (await api().get(`/properties/geojson?${query}`).set(as(coord)).expect(400)).body.message;
      expect(String(await bad('bbox=1,2,3'))).toMatch(/bbox inválido/);
      expect(String(await bad('bbox=-38,-12,-39,-13'))).toMatch(/mínimo deve ser menor/);
      expect(String(await bad('requestStatus=PERDIDA'))).toMatch(/Situação inválida/);
      expect(String(await bad('limit=0'))).toBeTruthy();
      expect(String(await bad('associacao=x'))).toMatch(/associacao/); // filtro inexistente
    });

    it('opções dos filtros vêm do que existe na organização', async () => {
      const res = await api().get('/properties/geojson/filters').set(as(coord)).expect(200);
      expect(res.body.communities).toEqual(['Baixio', 'Riacho Verde', 'Serrote']);
      expect(res.body.mainActivities).toEqual(['Leite', 'Mandioca']);
      expect(res.body.programs).toEqual([{ id: programId, name: 'Programa Sementes' }]);
      expect(res.body.technicians.map((t: { name: string }) => t.name)).toEqual(['Rafael Lins Moreira', 'Técnica Dois']);
      expect(res.body.requestStatuses).toEqual(['OPEN', 'NEW', 'IN_REVIEW', 'SCHEDULED', 'DONE']);
    });
  });

  describe('busca por proximidade', () => {
    it('ponto dentro do perímetro tem distância 0; o raio limita o resultado', async () => {
      const inside = await api().get('/properties/near?lat=-12.9705&lng=-38.4995&radius=100').set(as(tech)).expect(200);
      expect(inside.body.items).toEqual([expect.objectContaining({ id: p.demarcated, distanceM: 0, demarcated: true })]);
      const wide = await api().get('/properties/near?lat=-12.9705&lng=-38.4995&radius=5000').set(as(tech)).expect(200);
      expect(wide.body.items.map((i: { id: string }) => i.id)).toEqual([p.demarcated, p.pointOnly]);
      expect(wide.body.items[1].distanceM).toBeGreaterThan(2000);
      expect(JSON.stringify(wide.body)).not.toContain(makeCpf(800));
    });

    it('lat/lng trocadas e raio grande demais são recusados', async () => {
      const swapped = await api().get('/properties/near?lat=-38.4995&lng=-12.9705').set(as(tech)).expect(400);
      expect(String(swapped.body.message)).toMatch(/lat inválida|fora do Brasil/);
      await api().get('/properties/near?lat=-12.97&lng=-38.5&radius=999999').set(as(tech)).expect(400);
    });
  });

  describe('feições pela API', () => {
    it('cria, lê, altera e mostra o histórico', async () => {
      const created = await api()
        .post(`/properties/${p.work}/features`)
        .set(as(tech))
        .send({ type: 'PLOT', name: 'Talhão 1', geometry: polygon(-38.6, -12.9, 0.001) })
        .expect(201);
      expect(created.body).toMatchObject({ type: 'Feature', geometry: { type: 'MultiPolygon' }, properties: { featureType: 'PLOT', name: 'Talhão 1', version: 1 } });
      const id = created.body.id;
      await api().get(`/features/${id}`).set(as(tech)).expect(200);
      const changed = await api().patch(`/features/${id}`).set(as(tech)).send({ name: 'Talhão Norte', expectedVersion: 1 }).expect(200);
      expect(changed.body.properties).toMatchObject({ name: 'Talhão Norte', version: 2 });
      await api().patch(`/features/${id}`).set(as(tech)).send({ name: 'x', expectedVersion: 1 }).expect(409);
      const history = await api().get(`/features/${id}/history`).set(as(tech)).expect(200);
      expect(history.body.map((h: { change: string }) => h.change)).toEqual(['CREATED', 'UPDATED']);
      const list = await api().get(`/properties/${p.work}/features`).set(as(tech)).expect(200);
      expect(list.body.features.map((f: { id: string }) => f.id)).toContain(id);
    });

    it('valida o corpo: tipo, geometria, campos extras e geometria inválida', async () => {
      const post = (body: object) => api().post(`/properties/${p.work}/features`).set(as(tech)).send(body);
      expect(String((await post({ type: 'POCO', geometry: SQUARE }).expect(400)).body.message)).toMatch(/Tipo de feição inválido/);
      expect(String((await post({ type: 'PLOT' }).expect(400)).body.message)).toMatch(/geometria em GeoJSON/);
      await post({ type: 'PLOT', geometry: SQUARE, organizationId: 'outra' }).expect(400);
      expect((await post({ type: 'PLOT', geometry: BOWTIE }).expect(400)).body.message).toMatch(/se cruza/);
      await api().post(`/properties/nao-e-uuid/features`).set(as(tech)).send({ type: 'PLOT', geometry: SQUARE }).expect(400);
    });

    it('validate só propõe a correção', async () => {
      const res = await api().post('/features/validate').set(as(tech)).send({ type: 'PLOT', geometry: BOWTIE }).expect(200);
      expect(res.body).toMatchObject({ valid: false, message: expect.stringMatching(/se cruza/), suggestion: { type: 'MultiPolygon' } });
    });

    it('excluir: só a coordenação ou quem desenhou', async () => {
      const draw = async (token: string) =>
        (await api().post(`/properties/${p.work}/features`).set(as(token)).send({ type: 'IMPROVEMENT', geometry: { type: 'Point', coordinates: [-38.6, -12.9] } }).expect(201)).body.id;
      const byCoord = await draw(coord);
      const byTech = await draw(tech);
      const res = await api().delete(`/features/${byCoord}`).set(as(tech)).expect(403);
      expect(res.body.message).toMatch(/coordenação ou quem desenhou/);
      await api().delete(`/features/${byTech}`).set(as(tech2)).expect(403);
      await api().delete(`/features/${byTech}`).set(as(tech)).expect(200);
      await api().delete(`/features/${byCoord}`).set(as(coord)).expect(200);
      const other = await draw(tech2);
      await api().delete(`/features/${other}`).set(as(coord)).expect(200);
      await api().delete(`/features/${other}`).set(as(coord)).expect(404);
    });
  });

  describe('importação (GeoJSON convertido no navegador)', () => {
    const url = () => `/properties/${p.work}/features/import`;
    const items = [
      { type: 'PERIMETER', name: 'Área do imóvel (CAR)', geometry: polygon(-38.7, -12.8, 0.002) },
      { type: 'APP', name: 'APP do córrego', geometry: BOWTIE },
      { type: 'ROAD', geometry: { type: 'LineString', coordinates: [[-12.8, -38.7], [-12.8, -38.69]] } }, // lat/lng trocadas
    ];

    it('dryRun devolve o relatório por feição, com área prévia e correção sugerida, sem gravar', async () => {
      const before = await prisma.propertyFeature.count();
      const res = await api().post(`${url()}?dryRun=true`).set(as(tech)).send({ features: items }).expect(200);
      expect(res.body.summary).toEqual({ total: 3, ok: 1, invalid: 2, conflict: 0 });
      const [ok, bow, swapped] = res.body.items;
      expect(ok).toMatchObject({ status: 'ok', featureType: 'PERIMETER', name: 'Área do imóvel (CAR)' });
      expect(ok.areaHa).toBeGreaterThan(4.7);
      expect(bow).toMatchObject({ status: 'invalid', message: expect.stringMatching(/se cruza/), suggestion: { type: 'MultiPolygon' } });
      expect(swapped).toMatchObject({ status: 'invalid', message: expect.stringMatching(/fora do Brasil/) });
      expect(await prisma.propertyFeature.count()).toBe(before);
    });

    it('sem dryRun e com problema: 422 com o relatório e nada gravado', async () => {
      const before = await prisma.propertyFeature.count();
      const res = await api().post(url()).set(as(tech)).send({ features: items }).expect(422);
      expect(res.body.message).toMatch(/Nada foi importado/);
      expect(res.body.items).toHaveLength(3);
      expect(await prisma.propertyFeature.count()).toBe(before);
    });

    it('dois perímetros no mesmo arquivo são conflito', async () => {
      const two = [items[0], { ...items[0], name: 'Outro' }];
      const res = await api().post(`${url()}?dryRun=true`).set(as(tech)).send({ features: two }).expect(200);
      expect(res.body.items.map((i: { status: string }) => i.status)).toEqual(['conflict', 'conflict']);
    });

    it('tudo válido: grava numa transação, com auditoria de origem "import"', async () => {
      const res = await api()
        .post(url())
        .set(as(tech))
        .send({ features: [items[0], { type: 'PLOT', name: 'Talhão São José', geometry: polygon(-38.6995, -12.8005, 0.0005) }] })
        .expect(201);
      expect(res.body.summary).toMatchObject({ total: 2, ok: 2 });
      const ids = res.body.items.map((i: { featureId: string }) => i.featureId);
      expect(ids.every(Boolean)).toBe(true);
      const audits = await prisma.auditLog.findMany({ where: { entityId: { in: ids }, action: 'PROPERTY_FEATURE_CREATED' } });
      expect(audits.map((a) => (a.details as { source?: string }).source)).toEqual(['import', 'import']);
      // A propriedade agora tem perímetro: importar outro é conflito.
      const again = await api().post(`${url()}?dryRun=true`).set(as(tech)).send({ features: [items[0]] }).expect(200);
      expect(again.body.items[0]).toMatchObject({ status: 'conflict', message: expect.stringMatching(/já tem um perímetro/) });
    });
  });

  describe('exportação', () => {
    beforeAll(async () => {
      // A propriedade de trabalho já tem perímetro e talhões (importados e criados acima).
      // Acrescenta reserva legal com furo, estrada e sede (ponto).
      const add = (body: object) => api().post(`/properties/${p.work}/features`).set(as(tech)).send(body).expect(201);
      await add({ type: 'LEGAL_RESERVE', name: 'Reserva com clareira', geometry: { type: 'Polygon', coordinates: [ring(-38.5, -12.97, 0.002), HOLE] } });
      await add({ type: 'ROAD', name: 'Estrada vicinal', geometry: { type: 'LineString', coordinates: [[-38.7, -12.8], [-38.69, -12.8]] } });
      await add({ type: 'HEADQUARTERS', name: 'Sede', geometry: { type: 'Point', coordinates: [-38.699, -12.801] } });
    });

    const exported = (format: string) =>
      api().get(`/properties/${p.work}/features/export?format=${format}`).set(as(tech)).buffer(true).parse(binary).expect(200);

    it('GeoJSON: FeatureCollection com nome de arquivo sem acento', async () => {
      const res = await exported('geojson');
      expect(res.headers['content-type']).toMatch(/application\/geo\+json/);
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="sitio_exportacao_\d{4}-\d{2}-\d{2}\.geojson"$/);
      const fc = JSON.parse((res.body as Buffer).toString('utf8'));
      expect(fc.type).toBe('FeatureCollection');
      expect(fc.features.map((f: { properties: { featureType: string } }) => f.properties.featureType).sort()).toEqual(
        ['HEADQUARTERS', 'LEGAL_RESERVE', 'PERIMETER', 'PLOT', 'PLOT', 'ROAD'].sort(),
      );
    });

    it('KML e KMZ: lidos de volta pelo togeojson com as mesmas geometrias (inclusive o furo)', async () => {
      const kmlText = (await exported('kml')).body.toString('utf8');
      const kmz = await JSZip.loadAsync((await exported('kmz')).body as Buffer);
      const kmzText = await kmz.file('doc.kml')!.async('string');
      expect(kmzText).toBe(kmlText);
      type Parsed = { features: { properties: Record<string, unknown> | null; geometry: { type: string; coordinates: unknown } | null }[] };
      const parsed = kmlToGeoJson(
        new DOMParser().parseFromString(kmlText, 'text/xml') as unknown as Parameters<typeof kmlToGeoJson>[0],
      ) as unknown as Parsed;
      const reserve = parsed.features.find((f) => f.properties?.name === 'Reserva com clareira')!;
      expect(reserve.geometry?.type).toBe('Polygon');
      const rings = (reserve.geometry as { coordinates: number[][][] }).coordinates;
      expect(rings).toHaveLength(2);
      expect(vertexSet(rings[0])).toEqual(vertexSet(ring(-38.5, -12.97, 0.002)));
      expect(vertexSet(rings[1])).toEqual(vertexSet(HOLE));
      const talhao = parsed.features.find((f) => f.properties?.name === 'Talhão São José')!;
      expect(talhao.properties).toMatchObject({ tipo: 'Talhão' });
    });

    it('Shapefile: zip com um shapefile por tema em SIRGAS 2000, lido de volta pelo shpjs', async () => {
      const res = await exported('shp');
      expect(res.headers['content-type']).toMatch(/application\/zip/);
      const zip = await JSZip.loadAsync(res.body as Buffer);
      const names = Object.keys(zip.files).sort();
      const layer = (suffix: string) => names.find((n) => n.endsWith(suffix));
      for (const theme of ['AREA_IMOVEL', 'RESERVA_LEGAL', 'TALHAO', 'ESTRADA', 'SEDE_PONTO']) {
        for (const ext of ['shp', 'shx', 'dbf', 'prj', 'cpg']) expect(layer(`_${theme}.${ext}`)).toBeDefined();
      }
      expect(await zip.file(layer('_AREA_IMOVEL.prj')!)!.async('string')).toContain('GCS_SIRGAS_2000');
      expect(await zip.file('LEIAME.txt')!.async('string')).toMatch(/SIRGAS 2000.*EPSG:4674/);

      const collections = await shp.parseZip(res.body);
      const byLayer = (theme: string) => (collections as { fileName: string; features: { geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }[] }[])
        .find((c) => c.fileName.endsWith(`_${theme}`))!;
      const reserve = byLayer('RESERVA_LEGAL').features[0];
      expect(reserve.properties).toMatchObject({ TIPO: 'LEGAL_RESERVE', NOME: 'Reserva com clareira' });
      const rings = reserve.geometry.coordinates as number[][][];
      expect(rings).toHaveLength(2);
      expect(vertexSet(rings[0])).toEqual(vertexSet(ring(-38.5, -12.97, 0.002)));
      expect(vertexSet(rings[1])).toEqual(vertexSet(HOLE));
      // "Talhão 1" foi renomeado para "Talhão Norte"; "Talhão São José" veio da importação (UTF-8 no .dbf).
      expect(byLayer('TALHAO').features.map((f) => f.properties.NOME).sort()).toEqual(['Talhão Norte', 'Talhão São José']);
      expect(byLayer('ESTRADA').features[0].geometry.type).toBe('LineString');
      // O shpjs converte SIRGAS 2000 → WGS 84 via proj4 (sem deslocamento): só sobra ruído de ponto flutuante.
      const sede = byLayer('SEDE_PONTO').features[0].geometry;
      expect(sede.type).toBe('Point');
      const [lng, lat] = sede.coordinates as number[];
      expect(lng).toBeCloseTo(-38.699, 9);
      expect(lat).toBeCloseTo(-12.801, 9);
      const area = byLayer('AREA_IMOVEL').features[0].properties.AREA_HA as number;
      expect(area).toBeGreaterThan(4.7);
    });

    it('exportação entra na auditoria; propriedade sem feições dá 422; formato inválido dá 400', async () => {
      const audits = await prisma.auditLog.findMany({ where: { action: 'PROPERTY_FEATURES_EXPORTED', entityId: p.work } });
      expect(audits.map((a) => (a.details as { format: string }).format).sort()).toEqual(['geojson', 'kml', 'kmz', 'shp']);
      const empty = await api().get(`/properties/${p.noLocation}/features/export?format=kml`).set(as(tech)).expect(422);
      expect(empty.body.message).toMatch(/Nada para exportar/);
      await api().get(`/properties/${p.work}/features/export?format=dwg`).set(as(tech)).expect(400);
    });
  });

  it('OpenAPI documenta as rotas do módulo geo', async () => {
    const res = await api().get('/docs/openapi.json').expect(200);
    const paths = Object.keys(res.body.paths);
    for (const path of [
      '/properties/geojson', '/properties/near', '/properties/{propertyId}/features', '/properties/{propertyId}/features/import',
      '/properties/{propertyId}/features/export', '/features/validate', '/features/{id}', '/features/{id}/history',
    ]) {
      expect(paths).toContain(path);
    }
    const schemas = res.body.components.schemas;
    expect(schemas.PropertyFeatureType.enum).toEqual(['PERIMETER', 'PLOT', 'APP', 'LEGAL_RESERVE', 'HEADQUARTERS', 'IMPROVEMENT', 'WATER', 'ROAD']);
    expect(Object.keys(schemas.CreateFeatureDto.properties)).toEqual(['id', 'type', 'name', 'geometry']);
  });
});
