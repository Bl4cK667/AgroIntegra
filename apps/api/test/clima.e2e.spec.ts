import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { AppModule } from '../src/app.module';
import { CLIMA_CONFIG, ClimaConfig } from '../src/clima/clima.config';
import { CLIMA_FETCH, FetchLike } from '../src/clima/http-json';
import { configureApp } from '../src/configure-app';
import { makeCpf, resetData, tokenFor } from './fixtures';
import { TestDatabase } from './test-database';

// Nenhuma chamada sai para a internet: as fontes são simuladas com respostas reais gravadas,
// com as datas deslocadas para começar hoje (no fuso do município).

const ORG_A = '00000000-0000-4000-8000-000000000001';
const TZ = 'America/Belem';
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures', 'clima', name), 'utf8'));

const dayIso = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
};
const toBr = (iso: string) => iso.split('-').reverse().join('/');

function inmetFromToday() {
  const raw = fixture('inmet-1502152.json')['1502152'];
  const shifted: Record<string, unknown> = {};
  Object.keys(raw).forEach((k, i) => (shifted[toBr(dayIso(i))] = raw[k]));
  return { '1502152': shifted };
}
function openMeteoFromToday() {
  const raw = fixture('open-meteo-daily.json');
  raw.daily.time = raw.daily.time.map((_: string, i: number) => dayIso(i));
  return raw;
}
const IBGE_PA = [
  { 'municipio-id': 1502152, 'municipio-nome': 'Canaã dos Carajás' },
  { 'municipio-id': 1505536, 'municipio-nome': 'Parauapebas' },
];

const config: ClimaConfig = {
  inmetBaseUrl: 'https://inmet.teste',
  ibgeBaseUrl: 'https://ibge.teste',
  openMeteo: { enabled: true, baseUrl: 'https://open-meteo.teste', apiKey: null },
  defaultMunicipality: { ibgeCode: '1502152', name: 'Canaã dos Carajás/PA' },
  cacheMinutes: 180,
  failureBackoffMinutes: 10,
  timeoutMs: 1000,
  retryDelaysMs: [0, 0],
  timezone: TZ,
};

describe('Clima: previsão por propriedade e por município', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let coord: string;
  let techId: string;
  const calls: string[] = [];
  const down = new Set<string>(); // hosts "fora do ar"

  const fakeFetch: FetchLike = async (url) => {
    calls.push(url);
    const host = new URL(url).host;
    if (down.has(host)) return { ok: false, status: 503, json: async () => ({}) };
    if (host === 'inmet.teste') {
      // Mesma previsão gravada para os dois municípios do teste; outro código vem vazio (formato inesperado).
      const code = url.split('/').pop()!;
      const body = ['1502152', '1505536'].includes(code) ? { [code]: inmetFromToday()['1502152'] } : {};
      return { ok: true, status: 200, json: async () => body };
    }
    if (host === 'ibge.teste') return { ok: true, status: 200, json: async () => IBGE_PA };
    if (host === 'open-meteo.teste') return { ok: true, status: 200, json: async () => openMeteoFromToday() };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const count = (host: string) => calls.filter((u) => new URL(u).host === host).length;

  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function property(seed: number, extra: Record<string, unknown>) {
    const producer = await prisma.producer.create({
      data: { organizationId: ORG_A, name: `Produtor Clima ${seed}`, searchName: `produtor clima ${seed}`, cpf: makeCpf(seed), community: 'Vila', createdById: techId },
    });
    return prisma.property.create({
      data: { organizationId: ORG_A, producerId: producer.id, name: `Sítio Clima ${seed}`, areaHa: 5, locality: 'Vila', createdById: techId, ...extra },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], providers: [TestDatabase] })
      .overrideProvider(CLIMA_FETCH)
      .useValue(fakeFetch)
      .overrideProvider(CLIMA_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(TestDatabase);
    await prisma.weatherForecast.deleteMany();
    await resetData(prisma);
    coord = await tokenFor(app, 'coordenacao@agrointegra.demo');
    techId = (await prisma.user.findUniqueOrThrow({ where: { email: 'tecnico@agrointegra.demo' } })).id;
  });

  beforeEach(async () => {
    await prisma.weatherForecast.deleteMany();
    calls.length = 0;
    down.clear();
  });

  afterAll(async () => {
    await prisma.weatherForecast.deleteMany();
    await app.close();
  });

  it('exige login', async () => {
    await api().get('/clima/municipalities/1502152').expect(401);
  });

  it('propriedade com cidade e coordenada: INMET do município + Open-Meteo no ponto, com fonte, local, data e crédito', async () => {
    const p = await property(5001, { city: 'Canaã dos Carajás', state: 'PA', latitude: -6.496612, longitude: -49.878634 });
    const res = await api().get(`/clima/properties/${p.id}`).set(as(coord)).expect(200);

    expect(res.body.municipality).toEqual({ ibgeCode: '1502152', name: 'Canaã dos Carajás/PA', fromRegistration: true });
    expect(res.body.warnings).toEqual([]);
    const [inmet, point] = res.body.forecasts;
    expect(inmet).toMatchObject({ source: 'INMET', sourceLabel: 'INMET', place: 'Canaã dos Carajás/PA', stale: false, warning: null });
    expect(inmet.attribution).toContain('INMET');
    expect(inmet.days).toHaveLength(5);
    expect(inmet.days[0].date).toBe(dayIso(0));
    expect(inmet.days[0].periods).toHaveLength(3);
    expect(new Date(inmet.fetchedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);

    expect(point).toMatchObject({ source: 'OPEN_METEO', sourceLabel: 'Open-Meteo', stale: false });
    expect(point.attribution).toContain('CC BY 4.0');
    expect(point.place).toBe('Ponto da propriedade (-6,5; -49,88)');
    expect(point.days).toHaveLength(16);
    expect(point.days[0].precipitationMm).toBe(2.5);

    // A coordenada vai arredondada para a fonte (não o ponto exato da propriedade).
    const omUrl = calls.find((u) => u.includes('open-meteo.teste'))!;
    expect(omUrl).toContain('latitude=-6.5&longitude=-49.88');
  });

  it('dentro da validade, não consulta a fonte de novo', async () => {
    const p = await property(5002, { city: 'Canaã dos Carajás', state: 'PA', latitude: -6.5, longitude: -49.88 });
    await api().get(`/clima/properties/${p.id}`).set(as(coord)).expect(200);
    const before = { inmet: count('inmet.teste'), om: count('open-meteo.teste') };
    await api().get(`/clima/properties/${p.id}`).set(as(coord)).expect(200);
    await api().get('/clima/municipalities/1502152').set(as(coord)).expect(200);
    expect({ inmet: count('inmet.teste'), om: count('open-meteo.teste') }).toEqual(before);
    expect(await prisma.weatherForecast.count({ where: { organizationId: ORG_A } })).toBe(2);
  });

  it('fonte fora do ar depois da validade: último valor válido, com aviso de desatualizado', async () => {
    await api().get('/clima/municipalities/1502152').set(as(coord)).expect(200);
    const old = new Date(Date.now() - 4 * 60 * 60_000);
    await prisma.weatherForecast.updateMany({ data: { fetchedAt: old } });
    down.add('inmet.teste');

    const res = await api().get('/clima/municipalities/1502152').set(as(coord)).expect(200);
    expect(res.body.stale).toBe(true);
    expect(res.body.warning).toMatch(/^Previsão desatualizada: o INMET não respondeu\. Mostrando os dados de /);
    expect(new Date(res.body.fetchedAt).getTime()).toBe(old.getTime());
    expect(count('inmet.teste')).toBe(4); // 1 da primeira consulta + 3 tentativas com a fonte fora do ar

    const row = await prisma.weatherForecast.findFirstOrThrow({ where: { source: 'INMET' } });
    expect(row.lastError).toContain('HTTP 503');

    // Logo depois da falha, não insiste na fonte: devolve o guardado sem nova chamada.
    await api().get('/clima/municipalities/1502152').set(as(coord)).expect(200);
    expect(count('inmet.teste')).toBe(4);
  });

  // Os testes de falha sem nada guardado usam Parauapebas (1505536): a falha fica lembrada por
  // 1 minuto e não pode afetar os testes de Canaã dos Carajás.
  it('fonte fora do ar e nada guardado: 503 com mensagem em português, e não insiste logo em seguida', async () => {
    down.add('inmet.teste');
    const res = await api().get('/clima/municipalities/1505536').set(as(coord)).expect(503);
    expect(res.body.message).toBe('Previsão do INMET indisponível: INMET respondeu HTTP 503. Tente de novo em alguns minutos.');
    expect(count('inmet.teste')).toBe(3);
    await api().get('/clima/municipalities/1505536').set(as(coord)).expect(503);
    expect(count('inmet.teste')).toBe(3);
  });

  it('se só o INMET falhar, a previsão no ponto ainda aparece, com o aviso', async () => {
    const p = await property(5003, { city: 'Parauapebas', state: 'PA', latitude: -6.07, longitude: -49.9 });
    down.add('inmet.teste');
    const res = await api().get(`/clima/properties/${p.id}`).set(as(coord)).expect(200);
    expect(res.body.forecasts.map((f: { source: string }) => f.source)).toEqual(['OPEN_METEO']);
    expect(res.body.warnings.join(' ')).toContain('Previsão do INMET indisponível');
  });

  it('sem cidade no cadastro: usa o município padrão; sem coordenada: avisa como ter a previsão no ponto', async () => {
    const p = await property(5004, {});
    const res = await api().get(`/clima/properties/${p.id}`).set(as(coord)).expect(200);
    expect(res.body.municipality).toEqual({ ibgeCode: '1502152', name: 'Canaã dos Carajás/PA', fromRegistration: false });
    expect(res.body.forecasts.map((f: { source: string }) => f.source)).toEqual(['INMET']);
    expect(res.body.warnings).toEqual([
      'A propriedade não tem cidade e UF no cadastro.',
      'Usando a previsão do município padrão (Canaã dos Carajás/PA).',
      'Cadastre a localização da propriedade (ou demarque o perímetro) para ver a previsão no ponto, com chuva em mm.',
    ]);
  });

  it('cidade com grafia diferente do IBGE: avisa e usa o padrão; acentos e maiúsculas não atrapalham', async () => {
    const typo = await property(5005, { city: 'Canaa dos Carajaz', state: 'PA' });
    const r1 = await api().get(`/clima/properties/${typo.id}`).set(as(coord)).expect(200);
    expect(r1.body.warnings[0]).toBe('O município "Canaa dos Carajaz/PA" não foi encontrado no IBGE; confira a grafia no cadastro.');

    const plain = await property(5006, { city: 'CANAA DOS CARAJAS', state: 'PA' });
    const r2 = await api().get(`/clima/properties/${plain.id}`).set(as(coord)).expect(200);
    expect(r2.body.municipality.fromRegistration).toBe(true);
  });

  it('valida o código IBGE e a propriedade', async () => {
    const bad = await api().get('/clima/municipalities/15').set(as(coord)).expect(400);
    expect(bad.body.message).toContain('7 dígitos');
    await api().get('/clima/properties/00000000-0000-4000-8000-00000000abcd').set(as(coord)).expect(404);
  });

  describe('isolamento por organização', () => {
    let orgB: string;
    let tokenB: string;

    beforeAll(async () => {
      orgB = (await prisma.organization.create({ data: { name: 'Secretaria Clima B' } })).id;
      const user = await prisma.user.create({
        data: { name: 'Técnico Clima B', email: 'tecnico.clima.b@agrointegra.demo', role: 'TECHNICIAN', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4) },
      });
      await prisma.organizationMembership.create({ data: { userId: user.id, organizationId: orgB, role: 'TECHNICIAN' } });
      tokenB = await tokenFor(app, 'tecnico.clima.b@agrointegra.demo');
    });

    afterAll(async () => {
      await prisma.weatherForecast.deleteMany({ where: { organizationId: orgB } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: orgB } });
      await prisma.organization.delete({ where: { id: orgB } });
    });

    it('não vê a propriedade da organização A', async () => {
      const p = await property(5007, { city: 'Canaã dos Carajás', state: 'PA' });
      await api().get(`/clima/properties/${p.id}`).set(as(tokenB)).expect(404);
    });

    it('cada organização tem o próprio registro da previsão', async () => {
      await api().get('/clima/municipalities/1502152').set(as(coord)).expect(200);
      await api().get('/clima/municipalities/1502152').set(as(tokenB)).expect(200);
      expect(await prisma.weatherForecast.count({ where: { organizationId: ORG_A } })).toBe(1);
      expect(await prisma.weatherForecast.count({ where: { organizationId: orgB } })).toBe(1);
    });
  });
});
