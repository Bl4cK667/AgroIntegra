import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DEMO_PASSWORD } from '../prisma/seed-users';
import { AppModule } from '../src/app.module';
import type { FetchLike } from '../src/common/external-http';
import { ConabImportService } from '../src/cotacoes/conab-import.service';
import { COTACOES_CONFIG, COTACOES_FETCH, CotacoesConfig } from '../src/cotacoes/cotacoes.config';
import { configureApp } from '../src/configure-app';
import { resetData, tokenFor } from './fixtures';
import { TestDatabase } from './test-database';

// Nenhum download real: a CONAB é simulada com arquivos no mesmo formato (Latin-1, ";", vírgula
// decimal), com semanas relativas a hoje.

const ORG_A = '00000000-0000-4000-8000-000000000001';
const DAY = 86_400_000;
const br = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('-');
const week = (daysAgo: number) => {
  const end = new Date(Date.now() - daysAgo * DAY);
  return `${br(new Date(end.getTime() - 4 * DAY))} - ${br(end)}`;
};
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

const UF_HEADER = 'produto;classificao_produto;id_produto;uf;regiao;ano;mes;data_inicial_final_semana;semana;dsc_nivel_comercializacao;valor_produto_kg';
const MUN_HEADER = 'produto;classificao_produto;id_produto;nom_municipio;cod_ibge;uf;regiao;ano;mes;data_inicial_final_semana;semana;dsc_nivel_comercializacao;valor_produto_kg';
const R = 'PREÇO RECEBIDO P/ PR';

const UF_FILE = [
  UF_HEADER,
  `BOI                ;GORDO     ;4193;PA ;NORTE;2026;11;${week(5)}  ;2;${R};25,22`,
  `BOI                ;GORDO     ;4193;PA ;NORTE;2026;11;${week(12)} ;1;${R};25,16`,
  `BOI                ;GORDO     ;4193;PA ;NORTE;2026;10;${week(19)} ;4;${R};25,15`,
  `LEITE DE VACA      ;IN NATURA ;6542;PA ;NORTE;2026;10;${week(30)} ;2;${R};2,35`,
  `LEITE DE VACA      ;IN NATURA ;6542;PA ;NORTE;2026;10;${week(37)} ;1;${R};2,38`,
  `ABACAXI            ;PÉROLA    ;6320;PA ;NORTE;2026;11;${week(5)}  ;2;VAREJO              ;8,45`,
  `BOI                ;GORDO     ;4193;MT ;CENTRO-OESTE;2026;11;${week(5)};2;${R};24,00`,
].join('\r\n');
const MUN_FILE = [
  MUN_HEADER,
  `BOI ;GORDO ;4193;MARABÁ-PA     ;1504208 ;PA ;NORTE;2026;11;${week(6)} ;2;${R};24,90`,
  `BOI ;GORDO ;4193;PARAGOMINAS-PA;1505502 ;PA ;NORTE;2026;9;${week(60)} ;1;${R};20,33`,
].join('\r\n');

const LAST_MODIFIED = 'Wed, 18 Nov 2026 12:00:06 GMT';

const config: CotacoesConfig = {
  conabBaseUrl: 'https://conab.teste/arquivos',
  ufs: ['PA'],
  includeMunicipalities: true,
  scheduleEnabled: false,
  cron: '0 30 10 * * *',
  timezone: 'America/Belem',
  importOnStart: false,
  staleDays: 21,
  timeoutMs: 1000,
  retryDelaysMs: [0, 0],
};

describe('Cotações: CONAB e preços locais', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let coord: string;
  let tech: string;
  let tech2: string;
  let down = false;
  const requests: { url: string; ifModifiedSince?: string }[] = [];

  const fakeFetch: FetchLike = async (url, init) => {
    requests.push({ url, ifModifiedSince: init.headers['if-modified-since'] });
    if (down) return { ok: false, status: 503, json: async () => ({}) };
    if (init.headers['if-modified-since'] === LAST_MODIFIED) return { ok: false, status: 304, json: async () => ({}) };
    const body = url.endsWith('PrecosSemanalUF.txt') ? UF_FILE : url.endsWith('PrecosSemanalMunicipio.txt') ? MUN_FILE : null;
    if (body === null) return { ok: false, status: 404, json: async () => ({}) };
    const buf = Buffer.from(body, 'latin1');
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      headers: { get: (name: string) => (name.toLowerCase() === 'last-modified' ? LAST_MODIFIED : null) },
    };
  };

  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const product = (body: { products: { key: string }[] }, key: string) => body.products.find((p) => p.key === key) as unknown as Record<string, never>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], providers: [TestDatabase] })
      .overrideProvider(COTACOES_FETCH)
      .useValue(fakeFetch)
      .overrideProvider(COTACOES_CONFIG)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(TestDatabase);
    await prisma.marketPrice.deleteMany();
    await prisma.marketPriceImport.deleteMany();
    await resetData(prisma);
    coord = await tokenFor(app, 'coordenacao@agrointegra.demo');
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');
    const second = await prisma.user.create({
      data: { name: 'Técnica Cotações', email: 'tecnico.cot2@agrointegra.demo', role: 'TECHNICIAN', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4) },
    });
    await prisma.organizationMembership.create({ data: { userId: second.id, organizationId: ORG_A, role: 'TECHNICIAN' } });
    tech2 = await tokenFor(app, 'tecnico.cot2@agrointegra.demo');
  });

  afterAll(async () => {
    await prisma.localPrice.deleteMany();
    await prisma.marketPrice.deleteMany();
    await prisma.marketPriceImport.deleteMany();
    await app.close();
  });

  it('exige login; importar na hora é só da coordenação', async () => {
    await api().get('/cotacoes').expect(401);
    await api().post('/cotacoes/import').set(as(tech)).expect(403);
  });

  describe('importação da CONAB', () => {
    it('importa só o preço recebido do Pará, por UF e por município', async () => {
      const res = await api().post('/cotacoes/import').set(as(coord)).expect(200);
      expect(res.body).toEqual([
        { file: 'UF', status: 'SUCCESS', rows: 5, message: '5 preços semanais importados.' },
        { file: 'MUNICIPIO', status: 'SUCCESS', rows: 2, message: '2 preços semanais importados.' },
      ]);
      expect(await prisma.marketPrice.count()).toBe(7);
      expect(await prisma.marketPrice.count({ where: { uf: 'MT' } })).toBe(0);
    });

    it('importar de novo não duplica nada', async () => {
      await api().post('/cotacoes/import').set(as(coord)).expect(200);
      expect(await prisma.marketPrice.count()).toBe(7);
    });

    it('a rotina agendada só baixa se o arquivo mudou (If-Modified-Since)', async () => {
      requests.length = 0;
      const results = await app.get(ConabImportService).importAll('teste');
      expect(results.map((r) => r.status)).toEqual(['NOT_MODIFIED', 'NOT_MODIFIED']);
      expect(requests.every((r) => r.ifModifiedSince === LAST_MODIFIED)).toBe(true);
    });

    it('CONAB fora do ar: registra a falha e mantém os preços já importados', async () => {
      down = true;
      try {
        const res = await api().post('/cotacoes/import').set(as(coord)).expect(200);
        expect(res.body[0]).toMatchObject({ file: 'UF', status: 'FAILED', message: 'CONAB respondeu HTTP 503.' });
        expect(await prisma.marketPrice.count()).toBe(7);
        const overview = await api().get('/cotacoes').set(as(tech)).expect(200);
        expect(overview.body.imports.lastError).toBe('CONAB respondeu HTTP 503.');
        expect(overview.body.imports.lastSuccessAt).not.toBeNull();
      } finally {
        down = false;
      }
    });
  });

  describe('painel de cotações', () => {
    it('boi gordo em R$/@, com praça, semana, variação e fonte', async () => {
      const res = await api().get('/cotacoes').set(as(tech)).expect(200);
      const boi = product(res.body, 'BOI_GORDO') as unknown as {
        unit: string;
        state: Record<string, unknown>[];
        municipalities: Record<string, unknown>[];
      };
      expect(boi.unit).toBe('R$/@');
      expect(boi.state).toEqual([
        {
          source: 'CONAB',
          scope: 'STATE',
          place: 'Pará',
          weekStart: iso(9),
          weekEnd: iso(5),
          value: 378.3,
          unit: 'R$/@',
          previousValue: 377.4,
          changePct: 0.2,
          stale: false,
          warning: null,
        },
      ]);
      // Paragominas (dado de 60 dias atrás) não aparece; Marabá (6 dias) aparece.
      expect(boi.municipalities.map((m) => m.place)).toEqual(['Marabá/PA']);
      expect(boi.municipalities[0]).toMatchObject({ value: 373.5, scope: 'MUNICIPALITY' });
      expect(res.body.sources.conab).toContain('CONAB');
    });

    it('preço da UF com mais de 3 semanas aparece com aviso de desatualizado', async () => {
      const res = await api().get('/cotacoes').set(as(tech)).expect(200);
      const leite = product(res.body, 'LEITE') as unknown as { state: { stale: boolean; warning: string; value: number }[] };
      expect(leite.state[0]).toMatchObject({ stale: true, value: 2.35 });
      expect(leite.state[0].warning).toBe(`Cotação desatualizada: o último dado da CONAB para Pará é da semana até ${iso(30).split('-').reverse().join('/')}.`);
    });

    it('produto sem dado fica sem cotação (não inventa número)', async () => {
      const res = await api().get('/cotacoes').set(as(tech)).expect(200);
      expect(product(res.body, 'SOJA')).toMatchObject({ state: [], municipalities: [], local: null });
    });

    it('histórico: média da UF primeiro, depois as praças, em ordem de semana', async () => {
      const res = await api().get('/cotacoes/products/BOI_GORDO/history?weeks=12').set(as(tech)).expect(200);
      // No histórico entram também praças sem dado recente (Paragominas, 60 dias atrás): é série passada.
      expect(res.body.series.map((s: { place: string }) => s.place)).toEqual(['Pará', 'Marabá/PA', 'Paragominas/PA']);
      expect(res.body.series[0].points.map((p: { value: number }) => p.value)).toEqual([377.25, 377.4, 378.3]);
      await api().get('/cotacoes/products/INEXISTENTE/history').set(as(tech)).expect(404);
    });
  });

  describe('preços locais', () => {
    let localId: string;

    it('técnico lança preço de produto acompanhado: unidade do produto, autor e auditoria', async () => {
      const res = await api()
        .post('/cotacoes/local')
        .set(as(tech))
        .send({ productKey: 'BOI_GORDO', unit: 'R$/kg', price: 310.5, place: 'Frigorífico de Canaã', observedOn: iso(1) })
        .expect(201);
      expect(res.body).toMatchObject({ productKey: 'BOI_GORDO', productName: 'Boi gordo', unit: 'R$/@', price: 310.5, place: 'Frigorífico de Canaã', observedOn: iso(1) });
      expect(res.body.createdBy.name).toBeTruthy();
      localId = res.body.id;
      expect(await prisma.auditLog.count({ where: { action: 'LOCAL_PRICE_CREATED', entityId: localId } })).toBe(1);

      const overview = await api().get('/cotacoes').set(as(coord)).expect(200);
      expect(product(overview.body, 'BOI_GORDO')).toMatchObject({ local: { id: localId, price: 310.5, source: 'LOCAL' } });
    });

    it('outro produto exige nome e unidade; data no futuro é recusada', async () => {
      const noName = await api().post('/cotacoes/local').set(as(tech)).send({ price: 10, place: 'Feira', observedOn: iso(0) }).expect(400);
      expect(noName.body.message).toContain('informe o nome do produto');
      const future = await api().post('/cotacoes/local').set(as(tech)).send({ productKey: 'LEITE', price: 2.5, place: 'Laticínio', observedOn: iso(-3) }).expect(400);
      expect(future.body.message).toBe('A data do preço não pode ser no futuro.');
      const ok = await api().post('/cotacoes/local').set(as(tech)).send({ productName: 'Queijo coalho', unit: 'R$/kg', price: 38, place: 'Feira de Canaã', observedOn: iso(0) }).expect(201);
      expect(ok.body).toMatchObject({ productKey: null, productName: 'Queijo coalho', unit: 'R$/kg' });
    });

    it('lista paginada, do mais recente para o mais antigo', async () => {
      const res = await api().get('/cotacoes/local?pageSize=1').set(as(coord)).expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
      expect(res.body.items[0].productName).toBe('Queijo coalho');
    });

    it('excluir: outro técnico não pode; a coordenação pode; some da lista e fica na auditoria', async () => {
      const denied = await api().delete(`/cotacoes/local/${localId}`).set(as(tech2)).expect(403);
      expect(denied.body.message).toBe('Só a coordenação ou quem lançou o preço pode excluí-lo.');
      await api().delete(`/cotacoes/local/${localId}`).set(as(coord)).expect(200);
      const list = await api().get('/cotacoes/local?productKey=BOI_GORDO').set(as(tech)).expect(200);
      expect(list.body.total).toBe(0);
      expect(await prisma.localPrice.count({ where: { id: localId, deletedAt: { not: null } } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { action: 'LOCAL_PRICE_DELETED', entityId: localId } })).toBe(1);
    });
  });

  describe('isolamento por organização', () => {
    let orgB: string;
    let tokenB: string;

    beforeAll(async () => {
      orgB = (await prisma.organization.create({ data: { name: 'Secretaria Cotações B' } })).id;
      const user = await prisma.user.create({
        data: { name: 'Técnico Cotações B', email: 'tecnico.cot.b@agrointegra.demo', role: 'TECHNICIAN', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4) },
      });
      await prisma.organizationMembership.create({ data: { userId: user.id, organizationId: orgB, role: 'TECHNICIAN' } });
      tokenB = await tokenFor(app, 'tecnico.cot.b@agrointegra.demo');
    });

    afterAll(async () => {
      await prisma.localPrice.deleteMany({ where: { organizationId: orgB } });
      await prisma.auditLog.deleteMany({ where: { organizationId: orgB } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: orgB } });
      await prisma.organization.delete({ where: { id: orgB } });
    });

    it('vê os preços públicos da CONAB, mas não os preços locais da organização A', async () => {
      const res = await api().get('/cotacoes').set(as(tokenB)).expect(200);
      expect((product(res.body, 'BOI_GORDO') as unknown as { state: unknown[] }).state).toHaveLength(1);
      const local = await api().get('/cotacoes/local').set(as(tokenB)).expect(200);
      expect(local.body.total).toBe(0);
      const aPrice = await prisma.localPrice.findFirstOrThrow({ where: { organizationId: ORG_A, deletedAt: null } });
      await api().delete(`/cotacoes/local/${aPrice.id}`).set(as(tokenB)).expect(404);
    });

    it('o preço local lançado na organização B fica na B', async () => {
      const res = await api().post('/cotacoes/local').set(as(tokenB)).send({ productKey: 'LEITE', price: 2.4, place: 'Laticínio B', observedOn: iso(0) }).expect(201);
      expect((await prisma.localPrice.findUniqueOrThrow({ where: { id: res.body.id } })).organizationId).toBe(orgB);
      const a = await api().get('/cotacoes/local').set(as(coord)).expect(200);
      expect(a.body.items.map((i: { id: string }) => i.id)).not.toContain(res.body.id);
    });
  });
});
