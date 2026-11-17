// Testes unitários de CORS, cabeçalhos, rate limit de login e erro genérico.
// Usam um app Nest mínimo (sem AppModule, sem banco).
import { BadRequestException, Body, Controller, Get, HttpCode, INestApplication, Logger, Module, Post, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail, IsString } from 'class-validator';
import request from 'supertest';
import { INTERNAL_ERROR } from '../src/common/all-exceptions.filter';
import { createLoginRateLimiter, createRequestRateLimiter, registrationRateLimitOptions, TOO_MANY_REQUESTS, HttpRequest, HttpResponse, loginRateLimitOptions, resolveCorsOrigins, resolveTrustProxy, TOO_MANY_ATTEMPTS } from '../src/common/http-security';
import { configureApp } from '../src/configure-app';

class FakeLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

@Controller()
class FakeController {
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() dto: FakeLoginDto) {
    if (dto.password !== 'certa') throw new UnauthorizedException('E-mail ou senha inválidos.');
    return { ok: true };
  }

  @Post('auth/registration')
  @HttpCode(200)
  preview() {
    return { ok: true };
  }

  @Post('auth/register')
  @HttpCode(201)
  register() {
    return { ok: true };
  }

  @Post('auth/registrations-extra')
  @HttpCode(200)
  outra() {
    return { ok: true };
  }

  @Get('boom')
  boom() {
    throw new Error('relation "User" does not exist; senha=segredo');
  }

  @Get('regra')
  regra() {
    throw new BadRequestException('Mensagem de negócio visível.');
  }
}

@Module({ controllers: [FakeController] })
class FakeModule {}

async function makeApp(env: Record<string, string | undefined>) {
  const moduleRef = await Test.createTestingModule({ imports: [FakeModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, env);
  await app.init();
  return app;
}

describe('Configuração HTTP', () => {
  it('CORS: padrão localhost:3000, lista separada por vírgula e recusa "*"', () => {
    expect(resolveCorsOrigins({})).toEqual(['http://localhost:3000']);
    expect(resolveCorsOrigins({ WEB_ORIGIN: 'https://painel.exemplo.gov.br/, http://localhost:3000' })).toEqual([
      'https://painel.exemplo.gov.br',
      'http://localhost:3000',
    ]);
    expect(() => resolveCorsOrigins({ WEB_ORIGIN: '*' })).toThrow(/"\*"/);
    expect(() => resolveCorsOrigins({ WEB_ORIGIN: 'painel' })).toThrow(/inválida/);
  });

  it('TRUST_PROXY e limites de login validam números', () => {
    expect(resolveTrustProxy({})).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY: '1' })).toBe(1);
    expect(() => resolveTrustProxy({ TRUST_PROXY: 'true' })).toThrow();
    expect(loginRateLimitOptions({})).toEqual({ maxFailures: 10, maxFailuresPerIp: 50, windowMs: 900_000 });
    expect(() => loginRateLimitOptions({ AUTH_LOGIN_MAX_FAILURES: '0' })).toThrow();
  });
});

describe('App com configureApp', () => {
  let app: INestApplication;
  let errorSpy: jest.SpyInstance;

  beforeAll(async () => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    app = await makeApp({
      WEB_ORIGIN: 'https://painel.exemplo.gov.br',
      AUTH_LOGIN_MAX_FAILURES: '3',
      AUTH_LOGIN_WINDOW_SECONDS: '60',
      AUTH_REGISTRATION_MAX_REQUESTS: '3',
    });
  });

  afterAll(async () => {
    errorSpy.mockRestore();
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('CORS libera só a origem configurada e expõe Content-Disposition', async () => {
    const ok = await api().get('/regra').set('Origin', 'https://painel.exemplo.gov.br');
    expect(ok.headers['access-control-allow-origin']).toBe('https://painel.exemplo.gov.br');
    expect(ok.headers['access-control-expose-headers']).toContain('Content-Disposition');
    const other = await api().get('/regra').set('Origin', 'https://malicioso.exemplo');
    expect(other.headers['access-control-allow-origin']).not.toBe('https://malicioso.exemplo');
  });

  it('envia cabeçalhos de segurança e esconde x-powered-by', async () => {
    const res = await api().get('/regra');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('erros HTTP mantêm a mensagem; erros internos viram 500 genérico e são registrados', async () => {
    const regra = await api().get('/regra').expect(400);
    expect(regra.body).toMatchObject({ statusCode: 400, message: 'Mensagem de negócio visível.' });

    const boom = await api().get('/boom?cpf=12345678909').expect(500);
    expect(boom.body).toEqual({ statusCode: 500, message: INTERNAL_ERROR });
    expect(JSON.stringify(boom.body)).not.toMatch(/relation|segredo|stack/);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0].map(String).join(' ');
    expect(logged).toContain('GET /boom');
    expect(logged).toContain('Error');
    expect(logged).not.toMatch(/12345678909|relation|segredo|at .*\.ts/);
  });

  it('validação continua retornando 400 com as mensagens do class-validator', async () => {
    const res = await api().post('/auth/login').send({ email: 'x' }).expect(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('cadastro: bucket único por IP para /auth/registration e /auth/register; outras rotas não contam', async () => {
    await api().post('/auth/registration').send({}).expect(200);
    await api().post('/auth/register').send({}).expect(201);
    await api().post('/auth/registration').send({}).expect(200);
    const blocked = await api().post('/auth/register').send({}).expect(429);
    expect(blocked.body).toEqual({ statusCode: 429, message: TOO_MANY_REQUESTS });
    await api().post('/auth/registration').send({}).expect(429);
    await api().post('/auth/registrations-extra').send({}).expect(200);
    await api().post('/auth/login').send({ email: 'livre@agrointegra.demo', password: 'certa' }).expect(200);
  });

  it('bloqueia após N falhas por IP+e-mail, sem afetar outro e-mail nem logins certos', async () => {
    const email = 'alvo@agrointegra.demo';
    for (let i = 0; i < 3; i++) await api().post('/auth/login').send({ email, password: 'errada' }).expect(401);
    const blocked = await api().post('/auth/login').send({ email: ' ALVO@agrointegra.demo ', password: 'certa' }).expect(429);
    expect(blocked.body).toEqual({ statusCode: 429, message: TOO_MANY_ATTEMPTS });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    await api().post('/auth/login').send({ email: 'outro@agrointegra.demo', password: 'certa' }).expect(200);
    for (let i = 0; i < 5; i++) await api().post('/auth/login').send({ email: 'ok@agrointegra.demo', password: 'certa' }).expect(200);
  });
});

describe('Rate limit do cadastro por convite', () => {
  it('opções padrão e validação', () => {
    expect(registrationRateLimitOptions({})).toEqual({ maxRequests: 20, windowMs: 900_000 });
    expect(() => registrationRateLimitOptions({ AUTH_REGISTRATION_MAX_REQUESTS: '0' })).toThrow();
    expect(() => registrationRateLimitOptions({ AUTH_REGISTRATION_WINDOW_SECONDS: 'x' })).toThrow();
  });

  it('conta toda requisição (inclusive sucesso) antes de chegar ao controller, por IP, com janela e teto de memória', () => {
    let clock = 0;
    const limiter = createRequestRateLimiter({ maxRequests: 2, windowMs: 1000, maxKeys: 10, now: () => clock });
    const run = (ip: string, method = 'POST') => {
      let passed = false;
      const res = { statusCode: 200, headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v; }, status(c: number) { this.statusCode = c; return this; }, json() {}, on() {} };
      limiter({ method, ip }, res as never, () => (passed = true));
      return { passed, res };
    };
    expect(run('1.1.1.1').passed).toBe(true);
    expect(run('1.1.1.1').passed).toBe(true);
    const blocked = run('1.1.1.1');
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.headers['Retry-After']).toBe('1');
    expect(run('2.2.2.2').passed).toBe(true);
    expect(run('1.1.1.1', 'OPTIONS').passed).toBe(true);
    clock = 1001;
    expect(run('1.1.1.1').passed).toBe(true);
    for (let i = 0; i < 100; i++) run(`10.0.0.${i}`);
    expect(limiter.stats().ips).toBeLessThanOrEqual(10);
  });
});

describe('Rate limiter de login (unitário)', () => {
  type Fake = HttpResponse & { body?: unknown; headers: Record<string, string>; close: (status: number, finished?: boolean) => void };

  function fakeRes(): Fake {
    const listeners: (() => void)[] = [];
    const res: Fake = {
      statusCode: 200,
      headers: {},
      writableFinished: false,
      setHeader(name, value) {
        res.headers[name] = value;
      },
      status(code) {
        res.statusCode = code;
        return res;
      },
      json(body) {
        res.body = body;
      },
      on(_event, listener) {
        listeners.push(listener);
      },
      close(status, finished = true) {
        res.statusCode = status;
        res.writableFinished = finished;
        listeners.forEach((l) => l());
      },
    };
    return res;
  }

  let clock = 0;
  const make = (over: Partial<Parameters<typeof createLoginRateLimiter>[0]> = {}) =>
    createLoginRateLimiter({ maxFailures: 3, maxFailuresPerIp: 5, windowMs: 1000, now: () => clock, ...over });
  const req = (email: string, ip = '10.0.0.1'): HttpRequest => ({ method: 'POST', ip, body: { email } });

  // Executa o middleware; devolve a resposta e se chegou ao controller.
  function hit(limiter: ReturnType<typeof make>, r: HttpRequest) {
    const res = fakeRes();
    let passed = false;
    limiter(r, res, () => {
      passed = true;
    });
    return { res, passed };
  }

  beforeEach(() => {
    clock = 0;
  });

  it('rajada paralela não passa do limite: tentativa conta antes do controller', () => {
    const limiter = make();
    const inFlight = Array.from({ length: 10 }, () => hit(limiter, req('alvo@x.com')));
    expect(inFlight.filter((h) => h.passed)).toHaveLength(3);
    expect(inFlight.filter((h) => h.res.statusCode === 429)).toHaveLength(7);
  });

  it('login certo e erro de validação devolvem a tentativa; 401 e conexão abortada não', () => {
    const limiter = make();
    for (let i = 0; i < 10; i++) hit(limiter, req('ok@x.com')).res.close(200);
    hit(limiter, req('ok@x.com')).res.close(400);
    expect(hit(limiter, req('ok@x.com')).passed).toBe(true);

    const l2 = make();
    hit(l2, req('a@x.com')).res.close(401);
    hit(l2, req('a@x.com')).res.close(200, false); // abortada
    hit(l2, req('a@x.com')).res.close(401);
    const blocked = hit(l2, req('a@x.com'));
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(Number(blocked.res.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('bucket por IP impede contornar o limite trocando o e-mail', () => {
    const limiter = make();
    for (let i = 0; i < 5; i++) hit(limiter, req(`e${i}@x.com`)).res.close(401);
    expect(hit(limiter, req('novo@x.com')).res.statusCode).toBe(429);
    // Outro IP não é afetado.
    expect(hit(limiter, req('novo@x.com', '10.0.0.2')).passed).toBe(true);
  });

  it('janela expira e libera novamente', () => {
    const limiter = make();
    for (let i = 0; i < 3; i++) hit(limiter, req('a@x.com')).res.close(401);
    expect(hit(limiter, req('a@x.com')).passed).toBe(false);
    clock = 1001;
    expect(hit(limiter, req('a@x.com')).passed).toBe(true);
  });

  it('memória tem teto real mesmo sem chaves expiradas', () => {
    const limiter = make({ maxKeys: 100, maxFailuresPerIp: 1_000_000 });
    for (let i = 0; i < 1000; i++) hit(limiter, req(`u${i}@x.com`, `10.1.${i >> 8}.${i & 255}`)).res.close(401);
    const { pairs, ips } = limiter.stats();
    expect(pairs).toBeLessThanOrEqual(100);
    expect(ips).toBeLessThanOrEqual(100);
  });

  it('ignora métodos diferentes de POST', () => {
    const limiter = make({ maxFailures: 1, maxFailuresPerIp: 1 });
    for (let i = 0; i < 5; i++) expect(hit(limiter, { method: 'OPTIONS', ip: '10.0.0.1' }).passed).toBe(true);
  });
});
