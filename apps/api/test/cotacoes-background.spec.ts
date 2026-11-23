import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConabImportService } from '../src/cotacoes/conab-import.service';
import { cotacoesConfigFromEnv } from '../src/cotacoes/cotacoes.config';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cotações: falhas na importação automática', () => {
  let scheduler: SchedulerRegistry;
  let service: ConabImportService;
  let log: jest.SpyInstance;

  beforeEach(() => {
    scheduler = new SchedulerRegistry();
    log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    service?.onModuleDestroy();
    jest.restoreAllMocks();
  });

  function create(importOnStart: boolean) {
    const findFirst = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const prisma = { marketPriceImport: { findFirst } } as unknown as PrismaService;
    service = new ConabImportService(prisma, scheduler, {
      ...cotacoesConfigFromEnv({}), importOnStart, cron: '0 0 0 1 1 *',
    }, jest.fn());
    return findFirst;
  }

  it('falha de banco na inicialização é registrada sem rejeição não tratada', async () => {
    const findFirst = create(true);
    expect(() => service.onApplicationBootstrap()).not.toThrow();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cotacoes_background_failed'));
    expect(scheduler.doesExist('cron', 'cotacoes-conab')).toBe(true);
  });

  it('falha de banco no cron é tratada e permite nova tentativa', async () => {
    const findFirst = create(false);
    service.onApplicationBootstrap();
    const job = scheduler.getCronJob('cotacoes-conab');
    await job.fireOnTick();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cotacoes_background_failed'));
    await job.fireOnTick();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});
