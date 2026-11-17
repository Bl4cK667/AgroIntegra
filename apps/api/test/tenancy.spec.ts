// Testes unitários do contexto de organização (AsyncLocalStorage). Sem banco.
import { Body, Controller, ForbiddenException, Get, INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/configure-app';
import { NO_ORGANIZATION, TenancyService } from '../src/tenancy/tenancy.service';
import { TenancyModule } from '../src/tenancy/tenancy.module';
import { lazy } from './fake-auth-db';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TenancyService', () => {
  const t = new TenancyService();

  it('organizationId() lança 403 sem contexto ou sem organização', () => {
    expect(() => t.organizationId()).toThrow(ForbiddenException);
    expect(() => t.organizationId()).toThrow(NO_ORGANIZATION);
    t.run({}, () => expect(() => t.organizationId()).toThrow(ForbiddenException));
    expect(t.current()).toBeUndefined();
  });

  it('run isola contextos concorrentes, inclusive através de await', async () => {
    const seen: string[] = [];
    await Promise.all(
      ['org-a', 'org-b', 'org-c'].map((org, i) =>
        t.run({}, async () => {
          t.set({ organizationId: org, userId: `u-${org}` });
          await sleep(10 - i * 3);
          seen.push(`${org}=${t.organizationId()}/${t.userId()}`);
        }),
      ),
    );
    expect(seen.sort()).toEqual(['org-a=org-a/u-org-a', 'org-b=org-b/u-org-b', 'org-c=org-c/u-org-c']);
  });

  it('run cria cópia: contexto interno não vaza para o externo', async () => {
    const ctx = { organizationId: 'org-a' };
    await t.run(ctx, async () => {
      await t.run({ organizationId: 'org-b' }, async () => expect(t.organizationId()).toBe('org-b'));
      expect(t.organizationId()).toBe('org-a');
      const snapshot = t.current() as { organizationId?: string };
      snapshot.organizationId = 'adulterado';
      expect(t.organizationId()).toBe('org-a');
    });
    expect(ctx).toEqual({ organizationId: 'org-a' });
  });

  it('thenable preguiçoso (PrismaPromise) começa DENTRO do contexto do run', async () => {
    const readOrg = () => lazy(() => t.current()?.organizationId ?? null);
    // Controle: o mesmo thenable "aguardado" fora do run não enxerga organização.
    const outside = t.run({ organizationId: 'org-x' }, () => ({ op: readOrg() })).op;
    await expect(Promise.resolve(outside)).resolves.toBeNull();

    await expect(t.run({ organizationId: 'org-a' }, () => readOrg())).resolves.toBe('org-a');
    // Concorrência: cada um começa na própria organização.
    const results = await Promise.all(['org-1', 'org-2', 'org-3'].map((org) => t.run({ organizationId: org }, () => readOrg())));
    expect(results).toEqual(['org-1', 'org-2', 'org-3']);
    // Rejeição propaga; retorno síncrono continua síncrono.
    await expect(t.run({}, () => lazy(() => { throw new Error('falhou'); }))).rejects.toThrow('falhou');
    expect(t.run({ organizationId: 'org-s' }, () => t.organizationId())).toBe('org-s');
    expect(t.current()).toBeUndefined();
  });

  it('set falha fechado fora de contexto e ao trocar de organização na mesma requisição', () => {
    expect(() => t.set({ organizationId: 'x' })).toThrow(/fora de um contexto/);
    t.run({}, () => {
      t.set({ organizationId: 'org-a' });
      t.set({ organizationId: 'org-a', userId: 'u' });
      expect(() => t.set({ organizationId: 'org-b' })).toThrow(/Troca de organização/);
      expect(t.current()).toEqual({ organizationId: 'org-a', userId: 'u' });
    });
  });
});

@Controller('probe')
class ProbeController {
  constructor(private readonly tenancy: TenancyService) {}

  // Simula o guard preenchendo o contexto e um serviço lendo depois de I/O assíncrono.
  @Post()
  async post(@Body() body: { org: string }) {
    this.tenancy.set({ organizationId: body.org });
    await sleep(5);
    return { org: this.tenancy.organizationId() };
  }

  @Get()
  get() {
    return { current: this.tenancy.current() ?? null };
  }
}

@Module({ imports: [TenancyModule], controllers: [ProbeController] })
class ProbeModule {}

describe('Middleware de tenancy no app', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, {});
    await app.init();
  });

  afterAll(() => app.close());

  it('contexto sobrevive ao body-parser JSON e urlencoded e é isolado entre requisições paralelas', async () => {
    const server = app.getHttpServer();
    const results = await Promise.all([
      ...['org-1', 'org-2', 'org-3', 'org-4'].map((org) => request(server).post('/probe').send({ org })),
      request(server).post('/probe').type('form').send('org=org-form'),
    ]);
    expect(results.map((r) => r.body.org)).toEqual(['org-1', 'org-2', 'org-3', 'org-4', 'org-form']);
  });

  it('cada requisição começa com contexto vazio (nada herdado da anterior)', async () => {
    await request(app.getHttpServer()).post('/probe').send({ org: 'org-x' });
    const res = await request(app.getHttpServer()).get('/probe').expect(200);
    expect(res.body.current).toEqual({});
  });
});
